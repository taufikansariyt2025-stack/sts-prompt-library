"use client";

import { useCallback, useRef, useState } from "react";

type State = "idle" | "copied" | "error";

/**
 * Clipboard write with a temporary "copied" state.
 *
 * Falls back to a hidden textarea + execCommand, which is still the only path
 * that works on older iOS Safari and in non-secure contexts.
 */
export function useCopy(resetAfterMs = 2000) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      if (timer.current) clearTimeout(timer.current);

      const succeeded = await write(text);
      setState(succeeded ? "copied" : "error");

      timer.current = setTimeout(() => setState("idle"), resetAfterMs);
      return succeeded;
    },
    [resetAfterMs],
  );

  return { copy, state, isCopied: state === "copied" };
}

async function write(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";
    document.body.appendChild(textarea);
    textarea.select();
    const succeeded = document.execCommand("copy");
    document.body.removeChild(textarea);
    return succeeded;
  } catch {
    return false;
  }
}
