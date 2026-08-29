import { z } from "zod";

import { guardAdmin } from "@/lib/api/guard";
import { badRequest, ok, parseBody, serverError } from "@/lib/api/respond";
import { renameTagAcrossPrompts } from "@/lib/firebase/mutations";
import { listTagsWithCounts } from "@/lib/firebase/queries";
import { SLUG } from "@/lib/schemas/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;
  try {
    return ok(await listTagsWithCounts());
  } catch (error) {
    return serverError("admin/tags GET", error);
  }
}

const renameSchema = z.strictObject({
  from: z.string().regex(SLUG).max(40),
  /** Empty removes the tag everywhere. */
  to: z.union([z.string().regex(SLUG).max(40), z.literal("")]),
});

/**
 * PATCH /api/admin/tags — rename or delete a tag across every prompt.
 *
 * Tags live on the prompt documents rather than in their own collection, so
 * renaming means rewriting each prompt that carries it. Renaming onto an
 * existing tag merges the two, which is the behaviour people expect.
 */
export async function PATCH(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  const parsed = await parseBody(request, renameSchema);
  if (!parsed.ok) return parsed.response;
  if (parsed.data.from === parsed.data.to) return badRequest("That's the same tag.");

  try {
    const updated = await renameTagAcrossPrompts(
      guard.session,
      parsed.data.from,
      parsed.data.to,
    );
    return ok({ updated });
  } catch (error) {
    return serverError("admin/tags PATCH", error);
  }
}
