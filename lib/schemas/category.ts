import { z } from "zod";

import { previewMediaSchema } from "@/lib/schemas/media";
import { SLUG } from "@/lib/schemas/prompt";

export const categoryInputSchema = z.strictObject({
  slug: z.string().regex(SLUG, "Lowercase letters, numbers and hyphens only").max(60),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(200).default(""),
  /** Lucide icon name, e.g. "package". */
  icon: z.string().trim().min(1).max(40).default("folder"),
  /** OKLCH string so it composes with the rest of the token system. */
  accentColor: z.string().trim().min(3).max(60).default("oklch(0.548 0.216 286)"),
  coverImage: previewMediaSchema.optional(),
  order: z.number().int().nonnegative().default(0),
  isVisible: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export const categoryUpdateSchema = categoryInputSchema.partial();

export type Category = CategoryInput & {
  id: string;
  /** Denormalised so listings render without a second query. */
  promptCount: number;
  createdAt: string;
  updatedAt: string;
};

export const tagSchema = z.strictObject({
  slug: z.string().regex(SLUG).max(40),
  label: z.string().trim().min(1).max(40),
});

export type Tag = z.infer<typeof tagSchema> & { id: string; count: number };
