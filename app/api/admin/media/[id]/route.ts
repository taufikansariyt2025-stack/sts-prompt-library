import { guardAdmin } from "@/lib/api/guard";
import { badRequest, notFound, ok, serverError } from "@/lib/api/respond";
import { audit } from "@/lib/firebase/mutations";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, countPromptsUsingMedia, getMediaAsset } from "@/lib/firebase/queries";
import { deleteObject } from "@/lib/r2/object";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request, ctx: RouteContext<"/api/admin/media/[id]">) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  try {
    const asset = await getMediaAsset(id);
    if (!asset) return notFound("That file no longer exists.");

    // Deleting an in-use asset would leave a broken image on a live prompt.
    const inUse = await countPromptsUsingMedia(asset.url);
    if (inUse > 0) {
      return badRequest(
        `${inUse} prompt${inUse === 1 ? "" : "s"} still use this image. Replace it there first.`,
      );
    }

    await deleteObject(asset.r2Key);
    await adminDb().collection(COLLECTIONS.media).doc(id).delete();
    await audit(guard.session, "media.delete", id, { r2Key: asset.r2Key });

    return ok({ id });
  } catch (error) {
    return serverError("admin/media DELETE", error);
  }
}
