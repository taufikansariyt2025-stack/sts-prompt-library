import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PromptEditor } from "@/components/admin/prompt-editor";
import { getPromptById, listCategories } from "@/lib/firebase/queries";

export const metadata: Metadata = { title: "Edit prompt" };
export const dynamic = "force-dynamic";

export default async function EditPromptPage({
  params,
}: PageProps<"/admin/prompts/[id]">) {
  const { id } = await params;

  const [prompt, categories] = await Promise.all([
    getPromptById(id),
    listCategories({ visibleOnly: false }),
  ]);

  if (!prompt) notFound();

  return <PromptEditor categories={categories} prompt={prompt} />;
}
