import type { Metadata } from "next";

import { SavedClient } from "@/components/prompt/saved-client";
import { listPrompts } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Saved",
  description: "Prompts you've saved on this device.",
  robots: { index: false, follow: true },
};

export default async function SavedPage() {
  const prompts = await safeQuery(() => listPrompts({ limit: 300 }), []);

  return (
    <div className="container-page py-6 md:py-10">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight md:text-3xl">Saved</h1>
      <p className="mb-6 text-sm text-fg-muted">
        Stored on this device only — no account needed.
      </p>
      <SavedClient prompts={prompts} />
    </div>
  );
}
