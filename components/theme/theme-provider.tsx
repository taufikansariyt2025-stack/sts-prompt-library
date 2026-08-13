"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * next-themes injects a small synchronous script into the document head that
 * sets `class="dark"` before first paint, which is what prevents the
 * flash-of-wrong-theme. See PRD §15.1.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      // Suppresses the cross-fade that would otherwise animate every colour
      // token at once when switching themes.
      disableTransitionOnChange
      storageKey="sts-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
