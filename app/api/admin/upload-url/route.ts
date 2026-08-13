import { guardAdmin } from "@/lib/api/guard";
import { badRequest, ok, parseBody, serverError } from "@/lib/api/respond";
import { isR2Configured } from "@/lib/env";
import { buildObjectKey, presignUpload, r2PublicUrl } from "@/lib/r2/presign";
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_LOGO_MIME,
  MAX_LOGO_BYTES,
  MAX_PREVIEW_BYTES,
  uploadRequestSchema,
} from "@/lib/schemas/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload-url
 *
 * Issues a short-lived presigned PUT so the browser uploads straight to R2.
 * The file never passes through this server: no body-size limit, no function
 * duration cost, no memory pressure. We only sign and later verify.
 */
export async function POST(request: Request) {
  const guard = await guardAdmin(request, "uploadUrl");
  if (!guard.ok) return guard.response;

  // Storage is optional to run the app — say so plainly instead of throwing.
  if (!isR2Configured()) {
    return badRequest(
      "Image storage isn't configured yet. Add the R2_* variables, or use a YouTube link for now.",
    );
  }

  const parsed = await parseBody(request, uploadRequestSchema);
  if (!parsed.ok) return parsed.response;

  const { mime, bytes, scope } = parsed.data;

  const isBranding = scope === "branding";
  const allowed: readonly string[] = isBranding ? ALLOWED_LOGO_MIME : ALLOWED_IMAGE_MIME;
  const maxBytes = isBranding ? MAX_LOGO_BYTES : MAX_PREVIEW_BYTES;

  if (!allowed.includes(mime)) {
    return badRequest(
      `That file type isn't allowed. Use ${allowed
        .map((m) => m.replace("image/", "").toUpperCase())
        .join(", ")}.`,
    );
  }

  if (bytes > maxBytes) {
    return badRequest(
      `That file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    );
  }

  try {
    const key = buildObjectKey(scope, mime);
    const uploadUrl = await presignUpload({ key, mime, bytes });

    return ok({ uploadUrl, key, publicUrl: r2PublicUrl(key), expiresInSeconds: 300 });
  } catch (error) {
    return serverError("admin/upload-url", error);
  }
}
