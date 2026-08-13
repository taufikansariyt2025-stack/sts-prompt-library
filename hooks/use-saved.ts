"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Device-local favourites — no account required.
 *
 * localStorage rather than IndexedDB: we only store IDs, and a synchronous read
 * lets `useSyncExternalStore` render the correct state on first paint with no
 * flash. Full offline copies of saved prompts move to IndexedDB when the
 * service worker lands.
 */

const KEY = "sts-saved";
const EVENT = "sts-saved-change";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode or quota exceeded — saving is a nicety, never block on it.
  }
  window.dispatchEvent(new Event(EVENT));
}

// Cached so getSnapshot returns a stable reference; returning a fresh array
// each call would loop forever.
let cache: string[] = [];
let cacheKey = "";

function getSnapshot(): string[] {
  const raw = localStorage.getItem(KEY) ?? "[]";
  if (raw !== cacheKey) {
    cacheKey = raw;
    cache = read();
  }
  return cache;
}

const EMPTY: string[] = [];
const getServerSnapshot = () => EMPTY;

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  // Keeps tabs in sync.
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useSaved() {
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }, []);

  const isSaved = useCallback((id: string) => saved.includes(id), [saved]);

  return { saved, toggle, isSaved, count: saved.length };
}
