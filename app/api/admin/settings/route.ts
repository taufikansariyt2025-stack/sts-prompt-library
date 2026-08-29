import { guardAdmin } from "@/lib/api/guard";
import { forbidden, ok, parseBody, serverError } from "@/lib/api/respond";
import { updateSiteSettings } from "@/lib/firebase/mutations";
import { canEditSettings } from "@/lib/schemas/user";
import { siteSettingsUpdateSchema } from "@/lib/schemas/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const guard = await guardAdmin(request);
  if (!guard.ok) return guard.response;

  if (!canEditSettings(guard.session.role)) {
    return forbidden("Editors can't change site settings.");
  }

  const parsed = await parseBody(request, siteSettingsUpdateSchema);
  if (!parsed.ok) return parsed.response;

  try {
    await updateSiteSettings(guard.session, parsed.data);
    return ok({ saved: true });
  } catch (error) {
    return serverError("admin/settings PATCH", error);
  }
}
