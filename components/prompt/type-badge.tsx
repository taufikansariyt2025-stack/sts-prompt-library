import { Clapperboard, ImageIcon } from "lucide-react";

import type { PromptType } from "@/lib/constants/site";
import { cn } from "@/lib/utils/cn";

export function TypeBadge({
  type,
  className,
  size = "md",
}: {
  type: PromptType;
  className?: string;
  size?: "sm" | "md";
}) {
  const isVideo = type === "video";
  const Icon = isVideo ? Clapperboard : ImageIcon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-[0.6875rem]" : "px-2.5 py-1 text-xs",
        isVideo ? "bg-video/12 text-video" : "bg-image/12 text-image",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {isVideo ? "Video" : "Image"}
    </span>
  );
}

export function MetaChip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-fg-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}
