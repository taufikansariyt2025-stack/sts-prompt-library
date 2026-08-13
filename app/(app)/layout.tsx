import { redirect } from "next/navigation";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { requireSession } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";
import { DEFAULT_SETTINGS } from "@/lib/schemas/settings";

/**
 * The gated library shell.
 *
 * Everything under this group requires an approved account — browse, search,
 * categories and every prompt page. `requireSession()` verifies the session
 * cookie against Firebase on each request; proxy.ts only does an optimistic
 * cookie-presence check to save a round trip.
 *
 * Reading the session cookie makes this subtree dynamic, which is why the
 * data layer is cached separately (lib/firebase/queries.ts) — otherwise every
 * visitor would cost a Firestore read.
 */
export const dynamic = "force-dynamic";

export default async function LibraryLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  if (!session) redirect("/login");

  const settings = await safeQuery(() => getSiteSettings(), DEFAULT_SETTINGS);

  return (
    <>
      <SiteHeader settings={settings} session={session} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} />
      <BottomNav />
    </>
  );
}
