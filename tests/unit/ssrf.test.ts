import { describe, expect, it, vi } from "vitest";

// `server-only` throws when imported outside a server component graph.
vi.mock("server-only", () => ({}));

const { guardUrl, isPrivateAddress } = await import("@/lib/security/ssrf-guard");

describe("isPrivateAddress", () => {
  it.each([
    ["127.0.0.1", "loopback"],
    ["10.0.0.5", "private class A"],
    ["172.16.4.1", "private class B"],
    ["172.31.255.255", "private class B upper bound"],
    ["192.168.1.1", "private class C"],
    ["169.254.169.254", "cloud metadata endpoint"],
    ["0.0.0.0", "this network"],
    ["100.64.0.1", "CGNAT"],
    ["224.0.0.1", "multicast"],
    ["::1", "IPv6 loopback"],
    ["fe80::1", "IPv6 link-local"],
    ["fc00::1", "IPv6 unique local"],
    ["::ffff:169.254.169.254", "IPv4-mapped metadata endpoint"],
    ["not-an-ip", "malformed"],
  ])("blocks %s (%s)", (ip) => {
    expect(isPrivateAddress(ip)).toBe(true);
  });

  it.each([
    ["8.8.8.8", "public DNS"],
    ["1.1.1.1", "public DNS"],
    ["172.32.0.1", "just outside the private class B range"],
    ["192.167.1.1", "just outside the private class C range"],
    ["2606:4700::1111", "public IPv6"],
  ])("allows %s (%s)", (ip) => {
    expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("guardUrl", () => {
  it("rejects non-HTTPS schemes", async () => {
    for (const url of [
      "http://example.com/a.jpg",
      "file:///etc/passwd",
      "ftp://example.com/a.jpg",
    ]) {
      expect((await guardUrl(url)).ok).toBe(false);
    }
  });

  it("rejects embedded credentials", async () => {
    const result = await guardUrl("https://user:pass@example.com/a.jpg");
    expect(result.ok).toBe(false);
  });

  it("rejects literal private IPs without a DNS lookup", async () => {
    expect((await guardUrl("https://169.254.169.254/latest/meta-data/")).ok).toBe(false);
    expect((await guardUrl("https://127.0.0.1/admin")).ok).toBe(false);
    expect((await guardUrl("https://[::1]/admin")).ok).toBe(false);
  });

  it("rejects malformed input", async () => {
    expect((await guardUrl("not a url")).ok).toBe(false);
  });

  it("allows a public literal IP", async () => {
    expect((await guardUrl("https://8.8.8.8/image.jpg")).ok).toBe(true);
  });
});
