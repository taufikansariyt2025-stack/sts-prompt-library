import { AlertTriangle, ExternalLink, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle, StatCard } from "@/components/ui/card";
import { countPrompts, listCategories, listPrompts } from "@/lib/firebase/queries";

export const metadata: Metadata = { title: "Dashboard" };

type Overview = {
  published: number;
  drafts: number;
  categories: number;
  missingPreview: number;
  uncategorised: number;
  recent: { id: string; title: string; slug: string; updatedAt: string }[];
};

async function loadOverview(): Promise<Overview | null> {
  try {
    const [published, drafts, categories, all] = await Promise.all([
      countPrompts("published"),
      countPrompts("draft"),
      listCategories({ visibleOnly: false }),
      listPrompts({ status: "draft", limit: 200 }),
    ]);

    return {
      published,
      drafts,
      categories: categories.length,
      missingPreview: all.filter((p) => !p.preview).length,
      uncategorised: all.filter((p) => !p.categoryId).length,
      recent: all.slice(0, 5).map((p) => ({
        id: p.id,
        title: p.title,
        slug: p.slug,
        updatedAt: p.updatedAt,
      })),
    };
  } catch {
    // Firebase not provisioned yet — render the setup state instead of a 500.
    return null;
  }
}

export default async function AdminDashboardPage() {
  const overview = await loadOverview();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Manage the STS Prompt Library.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/" target="_blank">
              View site <ExternalLink />
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/prompts/new">
              <Plus /> New prompt
            </Link>
          </Button>
        </div>
      </header>

      {overview === null ? <SetupNotice /> : <Overview data={overview} />}
    </div>
  );
}

function Overview({ data }: { data: Overview }) {
  const issues = [
    data.missingPreview > 0 && {
      label: `${data.missingPreview} prompt${data.missingPreview === 1 ? "" : "s"} without preview media`,
      href: "/admin/prompts?filter=no-preview",
    },
    data.uncategorised > 0 && {
      label: `${data.uncategorised} uncategorised prompt${data.uncategorised === 1 ? "" : "s"}`,
      href: "/admin/prompts?filter=uncategorised",
    },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Published" value={data.published} />
        <StatCard label="Drafts" value={data.drafts} />
        <StatCard label="Categories" value={data.categories} />
        <StatCard label="Total" value={data.published + data.drafts} />
      </div>

      {issues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {issues.map((issue) => (
              <div
                key={issue.href}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
              >
                <span className="flex items-center gap-2 text-sm text-fg-muted">
                  <AlertTriangle className="size-4 shrink-0 text-warning" />
                  {issue.label}
                </span>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={{ pathname: "/admin/prompts" }}>Review</Link>
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recent drafts</CardTitle>
        </CardHeader>
        <CardBody>
          {data.recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-fg-muted">
              No drafts. Everything is published.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((prompt) => (
                <li key={prompt.id}>
                  <Link
                    href={{ pathname: `/admin/prompts/${prompt.id}` }}
                    className="flex items-center justify-between gap-3 py-3 text-sm transition-colors hover:text-accent"
                  >
                    <span className="truncate font-medium">{prompt.title}</span>
                    <span className="shrink-0 text-xs text-fg-subtle">
                      {new Date(prompt.updatedAt).toLocaleDateString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </>
  );
}

/** Shown until Firebase credentials are in place. */
function SetupNotice() {
  const steps = [
    "Create a Firebase project and enable Firestore plus Authentication (Google and Email/Password).",
    "Create a Cloudflare R2 bucket and bind it to a custom domain.",
    "Copy .env.example to .env.local and fill in every value.",
    "Deploy the rules: firebase deploy --only firestore:rules,firestore:indexes",
    "Run pnpm set:admin <your-email> to grant yourself admin access.",
    "Run pnpm seed to create the categories and import the 60 source prompts.",
  ];

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader className="border-warning/20">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-warning" />
          Finish setup to see your data
        </CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-sm text-fg-muted">
          Firestore isn&rsquo;t reachable yet, so the dashboard has nothing to show.
          Work through these once and this panel becomes live:
        </p>
        <ol className="mt-4 space-y-2.5">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.6875rem] font-semibold text-fg-muted">
                {index + 1}
              </span>
              <span className="text-fg-muted">{step}</span>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}
