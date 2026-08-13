import { PromptCard } from "@/components/prompt/prompt-card";
import type { Prompt } from "@/lib/schemas/prompt";
import { cn } from "@/lib/utils/cn";

/**
 * CSS-columns masonry.
 *
 * The source content is dominated by 9:16 verticals mixed with 16:9, so a
 * fixed-ratio grid would either crop badly or leave large gaps. Columns handle
 * that natively, need no JS, and never shift after hydration — which a
 * measured absolute layout would.
 *
 * Trade-off: reading order runs down each column rather than across rows. For
 * a browse gallery with no inherent sequence that is acceptable.
 */
export function MasonryGrid({
  prompts,
  className,
  priorityCount = 4,
}: {
  prompts: Prompt[];
  className?: string;
  priorityCount?: number;
}) {
  return (
    <div
      className={cn(
        "columns-2 gap-3 [column-fill:_balance] lg:columns-3 lg:gap-5 xl:columns-4",
        className,
      )}
    >
      {prompts.map((prompt, index) => (
        <div key={prompt.id} className="mb-3 break-inside-avoid lg:mb-5">
          <PromptCard
            prompt={prompt}
            index={index + 1}
            priority={index < priorityCount}
          />
        </div>
      ))}
    </div>
  );
}
