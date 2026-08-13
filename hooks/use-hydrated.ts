"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * True once the component has hydrated on the client.
 *
 * Preferred over the `useState(false)` + `useEffect(() => setMounted(true))`
 * pattern, which triggers a cascading render and is rejected by the React
 * Compiler lint rules.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
