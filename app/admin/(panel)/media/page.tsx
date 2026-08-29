import type { Metadata } from "next";

import { MediaClient } from "@/components/admin/media-client";
import { Card, CardBody } from "@/components/ui/card";
import { isR2Configured } from "@/lib/env";
import { listMediaAssets } from "@/lib/firebase/queries";

export const metadata: Metadata = { title: "Media" };
export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const configured = isR2Configured();

  let assets;
  try {
    assets = configured ? await listMediaAssets() : [];
  } catch {
    assets = null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Media</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Images uploaded for previews. Stored privately and served through the
          app, so they&rsquo;re only visible to signed-in members.
        </p>
      </header>

      {!configured ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="text-sm text-fg-muted">
            Image storage isn&rsquo;t configured. Add the <code>R2_*</code>{" "}
            variables to enable uploads — until then, use YouTube links for
            previews.
          </CardBody>
        </Card>
      ) : assets === null ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="text-sm text-fg-muted">
            Firestore isn&rsquo;t reachable yet.
          </CardBody>
        </Card>
      ) : (
        <MediaClient initial={assets} />
      )}
    </div>
  );
}
