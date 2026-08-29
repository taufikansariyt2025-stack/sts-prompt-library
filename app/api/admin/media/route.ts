import { guardAdmin } from "@/lib/api/guard";
import { ok, serverError } from "@/lib/api/respond";
import { listMediaAssets } from "@/lib/firebase/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    return ok(await listMediaAssets());
  } catch (error) {
    return serverError("admin/media GET", error);
  }
}
