import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

import { SettingsClient } from "@/components/admin/settings-client";
import { Card, CardBody } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { getSiteSettings } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";
import { DEFAULT_SETTINGS } from "@/lib/schemas/settings";
import { canEditSettings } from "@/lib/schemas/user";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await requireAdmin();

  if (!session || !canEditSettings(session.role)) {
    return (
      <Card className="mx-auto max-w-lg border-warning/40 bg-warning/5">
        <CardBody className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-medium text-fg">Admins and owners only</p>
            <p className="mt-1 text-sm text-fg-muted">
              Editors can manage content but not site-wide settings.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const settings = await safeQuery(() => getSiteSettings(), DEFAULT_SETTINGS);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Branding and copy for the public site.
        </p>
      </header>

      <SettingsClient initial={settings} />
    </div>
  );
}
