import type { Metadata } from "next";

import { CategoriesClient } from "@/components/admin/categories-client";
import { Card, CardBody } from "@/components/ui/card";
import { listCategoriesForAdmin } from "@/lib/firebase/queries";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  let categories;
  try {
    categories = await listCategoriesForAdmin();
  } catch {
    categories = null;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-1 text-sm text-fg-muted">
          How prompts are grouped for browsing and filtering.
        </p>
      </header>

      {categories === null ? (
        <Card className="border-warning/40 bg-warning/5">
          <CardBody className="text-sm text-fg-muted">
            Firestore isn&rsquo;t reachable yet.
          </CardBody>
        </Card>
      ) : (
        <CategoriesClient initial={categories} />
      )}
    </div>
  );
}
