"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldHint, Input, Label, Textarea } from "@/components/ui/input";
import { Select, Switch } from "@/components/ui/select";
import type { PreviewMedia } from "@/lib/schemas/media";
import type { SiteSettings } from "@/lib/schemas/settings";

/**
 * Two logo uploads, not one.
 *
 * A single mark can't read correctly on both a near-white and a near-black
 * background, so the header swaps them by theme. Uploading only one is allowed —
 * it's then used for both.
 */
export function SettingsClient({ initial }: { initial: SiteSettings }) {
  const [draft, setDraft] = useState<SiteSettings>(initial);
  const [busy, setBusy] = useState(false);

  function setBranding(patch: Partial<SiteSettings["branding"]>) {
    setDraft((d) => ({ ...d, branding: { ...d.branding, ...patch } }));
  }
  function setUi(patch: Partial<SiteSettings["ui"]>) {
    setDraft((d) => ({ ...d, ui: { ...d.ui, ...patch } }));
  }
  function setSocial(patch: Partial<SiteSettings["social"]>) {
    setDraft((d) => ({ ...d, social: { ...d.social, ...patch } }));
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        toast.error(payload.error ?? "Couldn't save settings.");
        return;
      }
      toast.success("Settings saved");
    } catch {
      toast.error("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="siteName">Site name</Label>
            <Input
              id="siteName"
              value={draft.siteName}
              onChange={(e) => setDraft((d) => ({ ...d, siteName: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              value={draft.tagline}
              onChange={(e) => setDraft((d) => ({ ...d, tagline: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              maxLength={300}
            />
            <FieldHint>Used as the default meta description.</FieldHint>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logos</CardTitle>
        </CardHeader>
        <CardBody className="space-y-6">
          <div>
            <Label className="mb-2">Light-mode logo</Label>
            <FieldHint>Shown on light backgrounds, so it needs dark ink.</FieldHint>
            <div className="mt-2">
              <MediaPicker
                scope="branding"
                value={draft.branding.logoLight ?? undefined}
                onChange={(m) => setBranding({ logoLight: m as PreviewMedia })}
                alt={
                  draft.branding.logoLight?.kind === "image"
                    ? draft.branding.logoLight.alt
                    : ""
                }
                onAltChange={(alt) => {
                  if (draft.branding.logoLight?.kind !== "image") return;
                  setBranding({ logoLight: { ...draft.branding.logoLight, alt } });
                }}
              />
            </div>
          </div>

          <div>
            <Label className="mb-2">Dark-mode logo</Label>
            <FieldHint>Shown on dark backgrounds, so it needs light ink.</FieldHint>
            <div className="mt-2">
              <MediaPicker
                scope="branding"
                value={draft.branding.logoDark ?? undefined}
                onChange={(m) => setBranding({ logoDark: m as PreviewMedia })}
                alt={
                  draft.branding.logoDark?.kind === "image"
                    ? draft.branding.logoDark.alt
                    : ""
                }
                onAltChange={(alt) => {
                  if (draft.branding.logoDark?.kind !== "image") return;
                  setBranding({ logoDark: { ...draft.branding.logoDark, alt } });
                }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="accent">Accent colour</Label>
            <div className="flex items-center gap-2">
              <span
                className="size-9 shrink-0 rounded-lg border border-border"
                style={{ background: draft.branding.accentColor }}
              />
              <Input
                id="accent"
                value={draft.branding.accentColor}
                onChange={(e) => setBranding({ accentColor: e.target.value })}
              />
            </div>
            <FieldHint>OKLCH keeps the derived hover and soft shades coherent.</FieldHint>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Landing page</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="headline">Hero headline</Label>
            <Input
              id="headline"
              value={draft.ui.homeHeroHeadline}
              onChange={(e) => setUi({ homeHeroHeadline: e.target.value })}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subline">Hero subline</Label>
            <Textarea
              id="subline"
              rows={2}
              value={draft.ui.homeHeroSubline}
              onChange={(e) => setUi({ homeHeroSubline: e.target.value })}
              maxLength={220}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="theme">Default theme</Label>
            <Select
              id="theme"
              value={draft.ui.defaultTheme}
              onChange={(e) =>
                setUi({ defaultTheme: e.target.value as SiteSettings["ui"]["defaultTheme"] })
              }
            >
              <option value="system">Follow the device</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </Select>
          </div>
          <Switch
            id="announcement"
            checked={draft.ui.showAnnouncement}
            onCheckedChange={(v) => setUi({ showAnnouncement: v })}
            label="Show announcement bar"
            description="A single line above the header."
          />
          {draft.ui.showAnnouncement ? (
            <div className="space-y-1.5">
              <Label htmlFor="announcementText">Announcement text</Label>
              <Input
                id="announcementText"
                value={draft.ui.announcementText ?? ""}
                onChange={(e) => setUi({ announcementText: e.target.value })}
                maxLength={160}
              />
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Social links</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {(["website", "instagram", "youtube", "linkedin", "facebook", "x"] as const).map(
            (key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`social-${key}`} className="capitalize">
                  {key}
                </Label>
                <Input
                  id={`social-${key}`}
                  type="url"
                  value={draft.social[key] ?? ""}
                  onChange={(e) => setSocial({ [key]: e.target.value || undefined })}
                  placeholder="https://…"
                />
              </div>
            ),
          )}
        </CardBody>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={busy} size="lg" className="shadow-e3">
          {busy ? <Loader2 className="animate-spin" /> : <Check />} Save settings
        </Button>
      </div>
    </div>
  );
}
