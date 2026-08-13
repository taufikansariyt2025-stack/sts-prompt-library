import { guardAdmin } from "@/lib/api/guard";
import { badRequest, ok, parseBody, serverError } from "@/lib/api/respond";
import { createPrompt } from "@/lib/firebase/mutations";
import { listAllSlugs } from "@/lib/firebase/queries";
import { promptCreateSchema } from "@/lib/schemas/prompt";
import { uniqueSlug } from "@/lib/utils/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/prompts — create a prompt. */
export async function POST(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const parsed = await parseBody(request, promptCreateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    // Slugs must be unique — resolve collisions server-side rather than
    // trusting whatever the editor sent.
    const taken = await listAllSlugs();
    const slug = uniqueSlug(parsed.data.slug, taken);

    const id = await createPrompt(guard.session, { ...parsed.data, slug });
    return ok({ id, slug });
  } catch (error) {
    return serverError("admin/prompts POST", error);
  }
}

export async function GET() {
  return badRequest("Use the admin pages to list prompts.");
}
