import type { Metadata } from "next";

import { TagsClient } from "@/components/admin/tags-client";
import { Card, CardBody } from "@/components/ui/card";
import { listTagsWithCounts } from "@/lib/firebase/queries";

export const metadata: Metadata = { title: "Tags" };
export const dynamic = "force-dynamic";

export default async function AdminTagsPage() {
  let tags;
  try {
    tags = await listTagsWithCounts();
  } catch {
    tags = null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Tags</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Tags live on the prompts themselves, so this list is derived — a tag
          disappears once no prompt uses it. Renaming onto an existing tag merges
          the two.
        </p>
      </header>

      {tags === null ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="text-sm text-fg-muted">
            Firestore isn&rsquo;t reachable yet.
          </CardBody>
        </Card>
      ) : (
        <TagsClient initial={tags} />
      )}
    </div>
  );
}
