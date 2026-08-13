import sharp from "sharp";
import { z } from "zod";

import { guardAdmin } from "@/lib/api/guard";
import { badRequest, ok, parseBody, serverError } from "@/lib/api/respond";
import { guardUrl, MAX_REMOTE_BYTES, safeFetch } from "@/lib/security/ssrf-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.strictObject({
  url: z.url().max(2048),
});

/**
 * POST /api/admin/image-url
 *
 * Validates an external image URL before the admin can attach it: HTTPS only,
 * no private address ranges, no redirects, real image content, size capped.
 */
export async function POST(request: Request) {
  const guard = await guardAdmin(request, "imageProxy");
  if (!guard.ok) return guard.response;

  const parsed = await parseBody(request, bodySchema);
  if (!parsed.ok) return parsed.response;

  const guarded = await guardUrl(parsed.data.url);
  if (!guarded.ok) return badRequest(guarded.reason);

  try {
    const response = await safeFetch(parsed.data.url);
    if (!response) return badRequest("Couldn't reach that URL.");

    if (response.status >= 300 && response.status < 400) {
      return badRequest("That URL redirects. Use the final image URL directly.");
    }
    if (!response.ok) {
      return badRequest(`That URL returned ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return badRequest("That URL doesn't point to an image.");
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_REMOTE_BYTES) {
      return badRequest("That image is too large.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_REMOTE_BYTES) {
      return badRequest("That image is too large.");
    }

    // Read real dimensions from the bytes rather than trusting the header.
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) {
      return badRequest("Couldn't read that image.");
    }

    return ok({
      width: metadata.width,
      height: metadata.height,
      mime: contentType.split(";")[0]!.trim(),
      bytes: buffer.byteLength,
    });
  } catch (error) {
    return serverError("admin/image-url", error);
  }
}
