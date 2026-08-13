import type { Metadata } from "next";

import { PromptEditor } from "@/components/admin/prompt-editor";
import { Card, CardBody } from "@/components/ui/card";
import { listCategories } from "@/lib/firebase/queries";

export const metadata: Metadata = { title: "New prompt" };
export const dynamic = "force-dynamic";

export default async function NewPromptPage() {
  let categories;
  try {
    categories = await listCategories({ visibleOnly: false });
  } catch {
    categories = null;
  }

  if (categories === null) {
    return (
      <Card className="mx-auto max-w-lg border-warning/40 bg-warning/5">
        <CardBody className="text-sm text-fg-muted">
          Firestore isn&rsquo;t reachable yet. Finish the setup steps on the
          dashboard, then come back.
        </CardBody>
      </Card>
    );
  }

  return <PromptEditor categories={categories} />;
}
