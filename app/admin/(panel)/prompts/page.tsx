import { FileText, Plus, SquarePlay } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import NextImage from "next/image";

import { TypeBadge } from "@/components/prompt/type-badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { listPrompts } from "@/lib/firebase/queries";
import type { Prompt } from "@/lib/schemas/prompt";
import { shouldSkipOptimizer } from "@/lib/utils/media";

export const metadata: Metadata = { title: "Prompts" };
export const dynamic = "force-dynamic";

export default async function AdminPromptsPage() {
  let prompts: Prompt[] | null = null;
  try {
    const [published, drafts] = await Promise.all([
      listPrompts({ status: "published", limit: 200 }),
      listPrompts({ status: "draft", limit: 200 }),
    ]);
    prompts = [...drafts, ...published];
  } catch {
    prompts = null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prompts</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {prompts ? `${prompts.length} total` : "Manage your library"}
          </p>
        </div>
        <Button size="sm" asChild>
          <Link href="/admin/prompts/new">
            <Plus /> New prompt
          </Link>
        </Button>
      </header>

      {prompts === null ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="text-sm text-fg-muted">
            Firestore isn&rsquo;t reachable yet. Finish the setup steps on the
            dashboard first.
          </CardBody>
        </Card>
      ) : prompts.length === 0 ? (
        <Card>
          <CardBody className="py-16 text-center">
            <FileText className="mx-auto size-8 text-fg-subtle" />
            <h2 className="mt-4 text-base font-semibold">No prompts yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-fg-muted">
              Add your first prompt, or run <code className="font-mono">pnpm seed</code>{" "}
              to import the 60 prompts from the source document.
            </p>
            <Button className="mt-5" asChild>
              <Link href="/admin/prompts/new">
                <Plus /> New prompt
              </Link>
            </Button>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <ul className="divide-y divide-border">
            {prompts.map((prompt) => (
              <li key={prompt.id}>
                <Link
                  href={{ pathname: `/admin/prompts/${prompt.id}` }}
                  className="flex items-center gap-4 p-3 transition-colors hover:bg-surface-2"
                >
                  <Thumbnail prompt={prompt} />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">
                      {prompt.title || "Untitled"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                      {prompt.aiTool || "No tool"} · {prompt.categorySlug || "uncategorised"}
                    </p>
                  </div>

                  <TypeBadge type={prompt.type} size="sm" className="hidden sm:inline-flex" />

                  <span
                    className={
                      prompt.status === "published"
                        ? "shrink-0 rounded-full bg-success/12 px-2 py-0.5 text-[0.6875rem] font-medium text-success"
                        : "shrink-0 rounded-full bg-warning/12 px-2 py-0.5 text-[0.6875rem] font-medium text-warning"
                    }
                  >
                    {prompt.status === "published" ? "Published" : "Draft"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Thumbnail({ prompt }: { prompt: Prompt }) {
  const preview = prompt.preview;

  if (!preview) {
    return (
      <div className="grid size-12 shrink-0 place-items-center rounded-lg border border-dashed border-border bg-surface-2">
        <FileText className="size-4 text-fg-subtle" />
      </div>
    );
  }

  const src = preview.kind === "youtube" ? preview.thumbnailUrl : preview.url;

  return (
    <div className="media-frame relative size-12 shrink-0 rounded-lg">
      <NextImage
        src={src}
        alt=""
        fill
        sizes="48px"
        className="object-cover"
        unoptimized={
          preview.kind === "image" ? shouldSkipOptimizer(preview.url, preview.source) : false
        }
      />
      {preview.kind === "youtube" ? (
        <span className="absolute inset-0 grid place-items-center bg-black/30">
          <SquarePlay className="size-4 text-white" />
        </span>
      ) : null}
    </div>
  );
}
