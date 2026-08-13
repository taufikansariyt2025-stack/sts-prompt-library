import type { Metadata } from "next";

import { SearchClient } from "@/components/prompt/search-client";
import { listPrompts } from "@/lib/firebase/queries";
import { safeQuery } from "@/lib/firebase/safe";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Search",
  description: "Search the AI prompt library by keyword, tool or tag.",
  alternates: { canonical: "/search" },
};

export default async function SearchPage() {
  const prompts = await safeQuery(() => listPrompts({ limit: 300 }), []);

  return (
    <div className="container-page py-6 md:py-10">
      <h1 className="mb-5 text-2xl font-semibold tracking-tight md:text-3xl">Search</h1>
      <SearchClient prompts={prompts} />
    </div>
  );
}
