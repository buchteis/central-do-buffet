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

/** Compara os campos informados com o termo já normalizado (aceita CPF/CNPJ/telefone com ou sem máscara). */
export function matchesQuery(nq: string, ...fields: unknown[]): boolean {
  if (!nq) return true;
  const digits = nq.replace(/\D/g, "");
  return fields.some((f) => {
    if (f === null || f === undefined) return false;
    const raw = String(f);
    if (normalizeSearch(raw).includes(nq)) return true;
    if (digits.length >= 3) {
      const d = raw.replace(/\D/g, "");
      if (d && d.includes(digits)) return true;
    }
    return false;
  });
}

/** Hook com o termo global normalizado + função de match para filtrar listas. */
export function useSearchFilter() {
  const query = normalizeSearch(useGlobalSearch());
  return {
    query,
    match: (...fields: unknown[]) => matchesQuery(query, ...fields),
  };
}
