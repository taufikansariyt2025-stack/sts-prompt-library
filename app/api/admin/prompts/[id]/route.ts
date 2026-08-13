import { guardAdmin } from "@/lib/api/guard";
import { notFound, ok, parseBody, serverError } from "@/lib/api/respond";
import { deletePrompt, updatePrompt } from "@/lib/firebase/mutations";
import { getPromptById, listAllSlugs } from "@/lib/firebase/queries";
import { promptUpdateSchema } from "@/lib/schemas/prompt";
import { uniqueSlug } from "@/lib/utils/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PATCH /api/admin/prompts/[id] — partial update (the editor autosaves). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/admin/prompts/[id]">) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  const parsed = await parseBody(request, promptUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const existing = await getPromptById(id);
    if (!existing) return notFound("That prompt no longer exists.");

    const patch = { ...parsed.data };

    // Keep slugs unique, but never rewrite a slug to itself.
    if (patch.slug && patch.slug !== existing.slug) {
      const taken = await listAllSlugs();
      taken.delete(existing.slug);
      patch.slug = uniqueSlug(patch.slug, taken);
    }

    await updatePrompt(guard.session, id, patch, {
      slug: existing.slug,
      categorySlug: existing.categorySlug,
      categoryId: existing.categoryId,
      status: existing.status,
    });

    return ok({ id, slug: patch.slug ?? existing.slug });
  } catch (error) {
    return serverError("admin/prompts PATCH", error);
  }
}

/** DELETE /api/admin/prompts/[id] */
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/admin/prompts/[id]">,
) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const { id } = await ctx.params;

  try {
    const existing = await getPromptById(id);
    if (!existing) return notFound("That prompt no longer exists.");

    await deletePrompt(guard.session, id, {
      slug: existing.slug,
      categorySlug: existing.categorySlug,
      categoryId: existing.categoryId,
    });

    return ok({ id });
  } catch (error) {
    return serverError("admin/prompts DELETE", error);
  }
}
