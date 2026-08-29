import { guardAdmin } from "@/lib/api/guard";
import { ok, parseBody, serverError } from "@/lib/api/respond";
import { createCategory } from "@/lib/firebase/mutations";
import { listCategoriesForAdmin } from "@/lib/firebase/queries";
import { categoryInputSchema } from "@/lib/schemas/category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    return ok(await listCategoriesForAdmin());
  } catch (error) {
    return serverError("admin/categories GET", error);
  }
}

export async function POST(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const parsed = await parseBody(request, categoryInputSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const id = await createCategory(guard.session, parsed.data);
    return ok({ id, ...parsed.data });
  } catch (error) {
    return serverError("admin/categories POST", error);
  }
}
