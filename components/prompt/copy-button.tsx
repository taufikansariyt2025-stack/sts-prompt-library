"use client";

import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { useCopy } from "@/hooks/use-copy";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function CopyButton({
  text,
  label = "Copy prompt",
  copiedLabel = "Copied",
  promptId,
  className,
  variant = "primary",
  size = "md",
  full,
  iconOnly = false,
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  /** When present, a copy is counted. Fire-and-forget; never blocks the copy. */
  promptId?: string;
  className?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  full?: boolean;
  iconOnly?: boolean;
}) {
  const { copy, isCopied } = useCopy();

  async function handleCopy() {
    const succeeded = await copy(text);

    if (!succeeded) {
      toast.error("Couldn't copy. Select the text and copy manually.");
      return;
    }

    toast.success(copiedLabel);

    if (promptId) {
      // sendBeacon survives the page being navigated away from.
      const payload = JSON.stringify({ promptId, event: "copy" });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/metric", new Blob([payload], { type: "application/json" }));
      } else {
        void fetch("/api/metric", {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    }
  }

  return (
    <Button
      onClick={handleCopy}
      variant={variant}
      size={iconOnly ? "icon-sm" : size}
      full={full}
      aria-label={iconOnly ? label : undefined}
      className={cn(isCopied && "!bg-success !text-white", className)}
    >
      {isCopied ? <Check /> : <Copy />}
      {iconOnly ? null : isCopied ? copiedLabel : label}
    </Button>
  );
}
