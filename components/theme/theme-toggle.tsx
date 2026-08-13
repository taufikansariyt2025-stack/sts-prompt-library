"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils/cn";

const OPTIONS = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] as const;

/**
 * Three-way segmented control: System / Light / Dark.
 *
 * Renders a placeholder until mounted — `theme` is unknowable on the server,
 * and rendering a guess would cause a hydration mismatch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = useHydrated();

  if (!mounted) {
    return (
      <div
        className={cn("h-9 w-[7.5rem] rounded-full bg-surface-2", className)}
        aria-hidden
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-2 p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              "grid size-8 place-items-center rounded-full transition-colors duration-150",
              active
                ? "bg-surface text-fg shadow-e1"
                : "text-fg-subtle hover:text-fg-muted",
            )}
          >
            <Icon className="size-4" strokeWidth={2} />
          </button>
        );
      })}
    </div>
  );
}
