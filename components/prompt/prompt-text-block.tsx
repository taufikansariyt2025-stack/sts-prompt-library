"use client";

import { ChevronDown, Code2 } from "lucide-react";
import { useState } from "react";

import { CopyButton } from "@/components/prompt/copy-button";
import { cn } from "@/lib/utils/cn";

/**
 * The prompt body, rendered as a code panel.
 *
 * Plain text node with `white-space: pre-wrap` — never HTML. That is both the
 * XSS-safe choice and the correct one, because the source prompts carry
 * timestamps, shot labels and `[bracket]` tokens that must survive verbatim.
 * See CLAUDE.md rule #3.
 */
export function PromptTextBlock({
  text,
  title = "Copy-paste prompt",
  promptId,
  collapsible = true,
  maxHeight = 460,
  className,
}: {
  text: string;
  title?: string;
  promptId?: string;
  collapsible?: boolean;
  maxHeight?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Rough threshold — avoids measuring on every render just to decide whether
  // a collapse affordance is needed.
  const isLong = collapsible && text.length > 900;
  const collapsed = isLong && !expanded;

  return (
    <section className={cn("space-y-2.5", className)}>
      <div className="flex items-center gap-3">
        <span className="eyebrow flex shrink-0 items-center gap-1.5">
          <Code2 className="size-3 text-accent" />
          {title}
        </span>
        <span className="h-px flex-1 bg-border" />
        <span className="font-mono text-[0.6875rem] tabular-nums text-fg-subtle">
          {text.length.toLocaleString()} ch
        </span>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-border bg-surface-2">
        {/* Accent rail marks this as the payload, not chrome. */}
        <span className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-accent/70 via-accent/25 to-transparent" />

        <div className="absolute right-2.5 top-2.5 z-10">
          <CopyButton
            text={text}
            label="Copy"
            promptId={promptId}
            variant="primary"
            size="sm"
            className="shadow-e2"
          />
        </div>

        <div
          className="overflow-y-auto p-4 pr-4 pt-12"
          style={collapsed ? { maxHeight } : undefined}
        >
          <p className="prompt-text text-fg">{text}</p>
        </div>

        {collapsed ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-28 items-end justify-center bg-gradient-to-t from-surface-2 via-surface-2/90 to-transparent">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="pointer-events-auto mb-3 flex items-center gap-1.5 rounded-full border border-border bg-surface px-3.5 py-1.5 text-xs font-medium text-fg-muted shadow-e2 transition-colors duration-200 hover:border-accent/50 hover:text-fg"
            >
              Show full prompt
              <ChevronDown className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
