import { FieldValue } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { guardAdmin } from "@/lib/api/guard";
import { badRequest, ok, parseBody, serverError } from "@/lib/api/respond";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/queries";
import { isR2Configured } from "@/lib/env";
import { r2PublicUrl, verifyUploaded } from "@/lib/r2/presign";
import { MAX_PREVIEW_BYTES, uploadCompleteSchema } from "@/lib/schemas/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload-complete
 *
 * Confirms the object actually exists in R2 before registering it. Skipping
 * this would let a client register media that was never uploaded.
 */
export async function POST(request: Request) {
  const guard = await guardAdmin(request, "uploadUrl");
  if (!guard.ok) return guard.response;

  if (!isR2Configured()) {
    return badRequest("Image storage isn't configured yet.");
  }

  const parsed = await parseBody(request, uploadCompleteSchema);
  if (!parsed.ok) return parsed.response;

  const { r2Key, width, height, blurDataURL, originalName } = parsed.data;

  // Keys we issue always match this shape. Anything else is a forged key.
  if (!/^(prompts|categories|branding)\/\d{4}\/\d{2}\/[A-Za-z0-9_-]{12}\.[a-z]{3,4}$/.test(r2Key)) {
    return badRequest("Invalid storage key.");
  }

  try {
    const verified = await verifyUploaded(r2Key, { maxBytes: MAX_PREVIEW_BYTES });
    if (!verified.ok) return badRequest(verified.reason);

    const id = nanoid(12);
    const url = r2PublicUrl(r2Key);

    await adminDb()
      .collection(COLLECTIONS.media)
      .doc(id)
      .set({
        r2Key,
        url,
        mime: verified.mime,
        bytes: verified.bytes,
        width,
        height,
        blurDataURL,
        // Display only — never used to build the key.
        originalName: originalName.slice(0, 255),
        usedBy: [],
        uploadedAt: FieldValue.serverTimestamp(),
      });

    return ok({
      id,
      r2Key,
      url,
      mime: verified.mime,
      bytes: verified.bytes,
      width,
      height,
      blurDataURL,
    });
  } catch (error) {
    return serverError("admin/upload-complete", error);
  }
}
