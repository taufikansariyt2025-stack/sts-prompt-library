import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { guardAdmin } from "@/lib/api/guard";
import { badRequest, ok, serverError } from "@/lib/api/respond";
import { isR2Configured } from "@/lib/env";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/queries";
import { buildObjectKey, mediaUrlForKey } from "@/lib/r2/presign";
import { putObject } from "@/lib/r2/object";
import {
  ALLOWED_IMAGE_MIME,
  ALLOWED_LOGO_MIME,
  MAX_LOGO_BYTES,
  MAX_PREVIEW_BYTES,
} from "@/lib/schemas/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload — receives the file and stores it in R2.
 *
 * This replaces the presigned-PUT flow. That flow is the better pattern on
 * serverless (bytes never touch the function), but it requires the bucket to
 * accept cross-origin PUTs from the browser, which means configuring CORS and
 * a public origin. Routing the upload through the app removes that setup
 * entirely and keeps the bucket completely private — worth it here, where the
 * app is a long-running container rather than a size-capped lambda and uploads
 * are a handful of admin images.
 *
 * The size cap below is what keeps that trade-off safe.
 */
export async function POST(request: Request) {
  const guard = await guardAdmin(request, "uploadUrl");
  if (!guard.ok) return guard.response;

  if (!isR2Configured()) {
    return badRequest(
      "Image storage isn't configured yet. Add the R2_* variables, or use a YouTube link for now.",
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const scopeRaw = String(form.get("scope") ?? "prompts");

    if (!(file instanceof File)) return badRequest("No file was uploaded.");

    const scope =
      scopeRaw === "categories" || scopeRaw === "branding" ? scopeRaw : "prompts";

    const isBranding = scope === "branding";
    const allowed: readonly string[] = isBranding ? ALLOWED_LOGO_MIME : ALLOWED_IMAGE_MIME;
    const maxBytes = isBranding ? MAX_LOGO_BYTES : MAX_PREVIEW_BYTES;

    if (!allowed.includes(file.type)) {
      return badRequest(
        `That file type isn't allowed. Use ${allowed
          .map((m) => m.replace("image/", "").toUpperCase())
          .join(", ")}.`,
      );
    }

    if (file.size > maxBytes) {
      return badRequest(
        `That file is too large. The limit is ${Math.round(maxBytes / 1024 / 1024)} MB.`,
      );
    }

    const width = Number(form.get("width") ?? 0);
    const height = Number(form.get("height") ?? 0);
    const blurDataURL = String(form.get("blurDataURL") ?? "").slice(0, 4000);
    const originalName = String(form.get("originalName") ?? "").slice(0, 255);

    // The key is never derived from the filename — a random id removes path
    // traversal, collisions and content-sniffing tricks in one move.
    const key = buildObjectKey(scope, file.type);
    const body = Buffer.from(await file.arrayBuffer());

    // Trust the bytes, not the declared size.
    if (body.byteLength > maxBytes) return badRequest("That file is too large.");

    await putObject({ key, body, contentType: file.type });

    const id = nanoid(12);
    const url = mediaUrlForKey(key);

    await adminDb()
      .collection(COLLECTIONS.media)
      .doc(id)
      .set({
        r2Key: key,
        url,
        mime: file.type,
        bytes: body.byteLength,
        width,
        height,
        blurDataURL,
        originalName,
        usedBy: [],
        uploadedAt: FieldValue.serverTimestamp(),
      });

    return ok({
      id,
      r2Key: key,
      url,
      mime: file.type,
      bytes: body.byteLength,
      width,
      height,
      blurDataURL,
    });
  } catch (error) {
    return serverError("admin/upload", error);
  }
}
