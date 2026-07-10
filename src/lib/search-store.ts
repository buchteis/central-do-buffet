import { useSyncExternalStore } from "react";

let value = "";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setGlobalSearch(v: string) {
  value = v;
  listeners.forEach((l) => l());
}

export function useGlobalSearch(): string {
  return useSyncExternalStore(
    subscribe,
    () => value,
    () => "",
  );
}

export function normalizeSearch(s: string): string {
  return (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
