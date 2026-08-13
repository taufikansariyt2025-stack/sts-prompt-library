import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { getSiteSettings } from "@/lib/firebase/queries";
import { DEFAULT_SETTINGS } from "@/lib/schemas/settings";

/**
 * Public shell.
 *
 * Note there is no `dynamic = "force-dynamic"` here and nothing reads
 * `headers()` — that is deliberate. Public pages must stay statically
 * renderable so they can be served from the edge (PRD §17).
 */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  let settings = DEFAULT_SETTINGS;
  try {
    settings = await getSiteSettings();
  } catch {
    // Branding falls back to compile-time defaults rather than failing the page.
  }

  return (
    <>
      <SiteHeader settings={settings} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter settings={settings} />
      <BottomNav />
    </>
  );
}
