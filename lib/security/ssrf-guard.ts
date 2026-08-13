import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * SSRF protection for server-side fetches of user-supplied URLs.
 *
 * Without this, an admin (or anyone who reaches the endpoint) could point us at
 * `http://169.254.169.254/` and read cloud instance metadata, or probe internal
 * services that are only reachable from the server.
 *
 * Defence is layered: scheme check → hostname resolution → IP range check →
 * no redirect following → size and time caps.
 */

export type GuardResult = { ok: true } | { ok: false; reason: string };

/** IPv4 ranges that must never be reachable from a user-supplied URL. */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // malformed — refuse
  }
  const [a, b] = parts as [number, number, number, number];

  return (
    a === 0 || // 0.0.0.0/8    "this network"
    a === 10 || // 10.0.0.0/8   private
    a === 127 || // 127.0.0.0/8  loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 private
    (a === 192 && b === 168) || // 192.168.0.0/16 private
    (a === 192 && b === 0) || // 192.0.0.0/24  IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmarking
    a >= 224 // multicast + reserved
  );
}

function isPrivateIPv6(ip: string): boolean {
  const normalised = ip.toLowerCase().replace(/^\[|\]$/g, "");

  if (normalised === "::" || normalised === "::1") return true; // unspecified, loopback
  if (normalised.startsWith("fe80")) return true; // link-local
  if (/^f[cd]/.test(normalised)) return true; // fc00::/7 unique local

  // IPv4-mapped (::ffff:169.254.169.254) must be checked as IPv4.
  const mapped = normalised.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]);

  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateIPv4(ip);
  if (version === 6) return isPrivateIPv6(ip);
  return true; // not an IP at all — refuse
}

/**
 * Validates a user-supplied URL before we fetch it.
 * Resolves DNS so a hostname pointing at 127.0.0.1 is caught too.
 */
export async function guardUrl(input: string): Promise<GuardResult> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "That isn't a valid URL." };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "Only HTTPS URLs are allowed." };
  }

  if (url.username || url.password) {
    return { ok: false, reason: "URLs with credentials aren't allowed." };
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  // A literal IP in the URL still has to pass the range check.
  if (isIP(hostname)) {
    return isPrivateAddress(hostname)
      ? { ok: false, reason: "That address isn't allowed." }
      : { ok: true };
  }

  // Resolve the name — this is what catches a hostname aimed at an internal IP.
  try {
    const results = await lookup(hostname, { all: true });
    if (results.length === 0) {
      return { ok: false, reason: "Couldn't resolve that host." };
    }
    if (results.some((r) => isPrivateAddress(r.address))) {
      return { ok: false, reason: "That address isn't allowed." };
    }
  } catch {
    return { ok: false, reason: "Couldn't resolve that host." };
  }

  return { ok: true };
}

export const FETCH_TIMEOUT_MS = 10_000;
export const MAX_REMOTE_BYTES = 15 * 1024 * 1024;

/**
 * Fetches a guarded URL without following redirects — a redirect is a classic
 * way to bypass a one-time check, so callers re-guard the target explicitly.
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
      headers: { ...init.headers, "User-Agent": "STSPromptLibrary/1.0" },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
