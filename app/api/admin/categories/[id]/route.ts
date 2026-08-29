import { guardAdmin } from "@/lib/api/guard";
import { badRequest, notFound, ok, parseBody, serverError } from "@/lib/api/respond";
import { deleteCategory, updateCategory } from "@/lib/firebase/mutations";
import { countPromptsInCategory, getCategoryById } from "@/lib/firebase/queries";
import { categoryUpdateSchema } from "@/lib/schemas/category";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/admin/categories/[id]">,
) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;
  const parsed = await parseBody(request, categoryUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const existing = await getCategoryById(id);
    if (!existing) return notFound("That category no longer exists.");

    await updateCategory(guard.session, id, parsed.data, existing.slug);
    return ok({ id });
  } catch (error) {
    return serverError("admin/categories PATCH", error);
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/admin/categories/[id]">,
) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  try {
    const existing = await getCategoryById(id);
    if (!existing) return notFound("That category no longer exists.");

    // Deleting a category that still holds prompts would orphan them — the
    // prompts would keep a categoryId pointing at nothing and vanish from
    // every listing. Make the caller reassign first.
    const inUse = await countPromptsInCategory(id);
    if (inUse > 0) {
      return badRequest(
        `${inUse} prompt${inUse === 1 ? "" : "s"} still use this category. Move them first.`,
      );
    }

    await deleteCategory(guard.session, id, existing.slug);
    return ok({ id });
  } catch (error) {
    return serverError("admin/categories DELETE", error);
  }
}
