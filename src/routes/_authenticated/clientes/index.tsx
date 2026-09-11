import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Plus, Users, Upload, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDateBR } from "@/lib/format";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { useSearchFilter } from "@/lib/search-store";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// Paleta de tons leves e coloridos para cada letra
const LETTER_COLORS: Record<string, { bg: string; text: string; hover: string; badge: string }> = {
  A: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", hover: "hover:bg-red-100 dark:hover:bg-red-900/60", badge: "bg-red-200/60 text-red-800 dark:bg-red-900/80 dark:text-red-200" },
  B: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", hover: "hover:bg-orange-100 dark:hover:bg-orange-900/60", badge: "bg-orange-200/60 text-orange-800 dark:bg-orange-900/80 dark:text-orange-200" },
  C: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", hover: "hover:bg-amber-100 dark:hover:bg-amber-900/60", badge: "bg-amber-200/60 text-amber-800 dark:bg-amber-900/80 dark:text-amber-200" },
  D: { bg: "bg-yellow-50 dark:bg-yellow-950/40", text: "text-yellow-800 dark:text-yellow-300", hover: "hover:bg-yellow-100 dark:hover:bg-yellow-900/60", badge: "bg-yellow-200/60 text-yellow-900 dark:bg-yellow-900/80 dark:text-yellow-200" },
  E: { bg: "bg-lime-50 dark:bg-lime-950/40", text: "text-lime-800 dark:text-lime-300", hover: "hover:bg-lime-100 dark:hover:bg-lime-900/60", badge: "bg-lime-200/60 text-lime-900 dark:bg-lime-900/80 dark:text-lime-200" },
  F: { bg: "bg-green-50 dark:bg-green-950/40", text: "text-green-700 dark:text-green-300", hover: "hover:bg-green-100 dark:hover:bg-green-900/60", badge: "bg-green-200/60 text-green-800 dark:bg-green-900/80 dark:text-green-200" },
  G: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/60", badge: "bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200" },
  H: { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", hover: "hover:bg-teal-100 dark:hover:bg-teal-900/60", badge: "bg-teal-200/60 text-teal-800 dark:bg-teal-900/80 dark:text-teal-200" },
  I: { bg: "bg-cyan-50 dark:bg-cyan-950/40", text: "text-cyan-700 dark:text-cyan-300", hover: "hover:bg-cyan-100 dark:hover:bg-cyan-900/60", badge: "bg-cyan-200/60 text-cyan-800 dark:bg-cyan-900/80 dark:text-cyan-200" },
  J: { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300", hover: "hover:bg-sky-100 dark:hover:bg-sky-900/60", badge: "bg-sky-200/60 text-sky-800 dark:bg-sky-900/80 dark:text-sky-200" },
  K: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", hover: "hover:bg-blue-100 dark:hover:bg-blue-900/60", badge: "bg-blue-200/60 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200" },
  L: { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", hover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/60", badge: "bg-indigo-200/60 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200" },
  M: { bg: "bg-violet-50 dark:bg-violet-950/40", text: "text-violet-700 dark:text-violet-300", hover: "hover:bg-violet-100 dark:hover:bg-violet-900/60", badge: "bg-violet-200/60 text-violet-800 dark:bg-violet-900/80 dark:text-violet-200" },
  N: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", hover: "hover:bg-purple-100 dark:hover:bg-purple-900/60", badge: "bg-purple-200/60 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200" },
  O: { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-700 dark:text-fuchsia-300", hover: "hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/60", badge: "bg-fuchsia-200/60 text-fuchsia-800 dark:bg-fuchsia-900/80 dark:text-fuchsia-200" },
  P: { bg: "bg-pink-50 dark:bg-pink-950/40", text: "text-pink-700 dark:text-pink-300", hover: "hover:bg-pink-100 dark:hover:bg-pink-900/60", badge: "bg-pink-200/60 text-pink-800 dark:bg-pink-900/80 dark:text-pink-200" },
  Q: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", hover: "hover:bg-rose-100 dark:hover:bg-rose-900/60", badge: "bg-rose-200/60 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200" },
  R: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", hover: "hover:bg-red-100 dark:hover:bg-red-900/60", badge: "bg-red-200/60 text-red-800 dark:bg-red-900/80 dark:text-red-200" },
  S: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-700 dark:text-orange-300", hover: "hover:bg-orange-100 dark:hover:bg-orange-900/60", badge: "bg-orange-200/60 text-orange-800 dark:bg-orange-900/80 dark:text-orange-200" },
  T: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", hover: "hover:bg-emerald-100 dark:hover:bg-emerald-900/60", badge: "bg-emerald-200/60 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200" },
  U: { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", hover: "hover:bg-teal-100 dark:hover:bg-teal-900/60", badge: "bg-teal-200/60 text-teal-800 dark:bg-teal-900/80 dark:text-teal-200" },
  V: { bg: "bg-sky-50 dark:bg-sky-950/40", text: "text-sky-700 dark:text-sky-300", hover: "hover:bg-sky-100 dark:hover:bg-sky-900/60", badge: "bg-sky-200/60 text-sky-800 dark:bg-sky-900/80 dark:text-sky-200" },
  W: { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", hover: "hover:bg-indigo-100 dark:hover:bg-indigo-900/60", badge: "bg-indigo-200/60 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200" },
  X: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", hover: "hover:bg-purple-100 dark:hover:bg-purple-900/60", badge: "bg-purple-200/60 text-purple-800 dark:bg-purple-900/80 dark:text-purple-200" },
  Y: { bg: "bg-fuchsia-50 dark:bg-fuchsia-950/40", text: "text-fuchsia-700 dark:text-fuchsia-300", hover: "hover:bg-fuchsia-100 dark:hover:bg-fuchsia-900/60", badge: "bg-fuchsia-200/60 text-fuchsia-800 dark:bg-fuchsia-900/80 dark:text-fuchsia-200" },
  Z: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", hover: "hover:bg-rose-100 dark:hover:bg-rose-900/60", badge: "bg-rose-200/60 text-rose-800 dark:bg-rose-900/80 dark:text-rose-200" },
  "#": { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-700 dark:text-slate-300", hover: "hover:bg-slate-200 dark:hover:bg-slate-700/60", badge: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200" },
};

function initialLetter(name: unknown): string {
  const s = String(name ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  const first = s.charAt(0);
  return /[A-Z]/.test(first) ? first : "#";
}

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — Central do Buffet" }] }),
  component: ClientsPage,
});

function ClientsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { query: gq, match } = useSearchFilter();
  const [letter, setLetter] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState(false);

  const letterKeys = useMemo(() => [...ALPHABET, "#"], []);

  const { data: clients, isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente excluído");
      setConfirmId(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("clients").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`${ids.length} cliente(s) excluído(s)`);
      setSelected(new Set());
      setConfirmBulk(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const searched = useMemo(
    () =>
      (clients ?? []).filter((c) => {
        const local = q.trim().toLowerCase();
        const localOk =
          !local ||
          [c.name, c.phone, c.whatsapp, c.email, c.cpf, c.city, c.address]
            .some((v) => String(v ?? "").toLowerCase().includes(local)) ||
          [c.phone, c.whatsapp, c.cpf].some(
            (v) => local.replace(/\D/g, "") && String(v ?? "").replace(/\D/g, "").includes(local.replace(/\D/g, "")),
          );
        return (
          localOk &&
          match(c.name, c.phone, c.whatsapp, c.email, c.cpf, c.city, c.address, c.notes, c.origem, c.status)
        );
      }),
    [clients, q, match, gq],
  );

  const countsByLetter = useMemo(() => {
    const m = new Map<string, number>();
    searched.forEach((c) => {
      const l = initialLetter(c.name);
      m.set(l, (m.get(l) ?? 0) + 1);
    });
    return m;
  }, [searched]);

  const filtered = useMemo(
    () => (letter ? searched.filter((c) => initialLetter(c.name) === letter) : searched),
    [searched, letter],
  );

  const confirming = (clients ?? []).find((c) => c.id === confirmId);
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (allVisibleSelected) {
      setSelected((s) => {
        const n = new Set(s);
        filtered.forEach((c) => n.delete(c.id));
        return n;
      });
    } else {
      setSelected((s) => {
        const n = new Set(s);
        filtered.forEach((c) => n.add(c.id));
        return n;
      });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients?.length ?? 0} cliente(s) cadastrado(s)
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => setConfirmBulk(true)}
              className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-destructive text-destructive-foreground text-xs font-bold shadow-lg shadow-destructive/20"
            >
              <Trash2 className="size-4" /> Excluir {selected.size} selecionado(s)
            </button>
          )}
          <Link
            to="/clientes/importar"
            className="inline-flex items-center gap-1 h-9 px-4 rounded-full border border-border text-xs font-bold hover:bg-accent"
          >
            <Upload className="size-4" /> Importar clientes
          </Link>
          <Link
            to="/clientes/novo"
            className="inline-flex items-center gap-1 h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg shadow-primary/20"
          >
            <Plus className="size-4" /> Novo cliente
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, telefone, e-mail…"
          className="w-full bg-muted/40 border border-border rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:bg-background transition"
        />
      </div>

      {/* --- CARDS A-Z COM TONS LEVES E COLORIDOS --- */}
      <div className="flex flex-wrap items-center gap-2 py-2">
        <button
          onClick={() => setLetter(null)}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all transform active:scale-95 shadow-sm ${
            letter === null
              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100"
              : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground border border-border"
          }`}
        >
          Todos{" "}
          <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10">
            {searched.length}
          </span>
        </button>

        {letterKeys.map((char) => {
          const count = countsByLetter.get(char) ?? 0;
          const isSelected = letter === char;
          const hasItems = count > 0;
          const palette = LETTER_COLORS[char] ?? LETTER_COLORS["#"];

          return (
            <button
              key={char}
              disabled={!hasItems}
              onClick={() => setLetter(isSelected ? null : char)}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-1.5 transform active:scale-95 ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-md ring-2 ring-offset-2 ring-primary scale-105"
                  : hasItems
                  ? `${palette.bg} ${palette.text} ${palette.hover} cursor-pointer shadow-sm`
                  : "bg-muted/30 text-muted-foreground/30 border border-transparent cursor-not-allowed opacity-40"
              }`}
            >
              <span>{char}</span>
              {hasItems && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    isSelected
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : palette.badge
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="size-8 mx-auto text-muted-foreground mb-3" />
            <div className="text-sm font-semibold">Nenhum cliente encontrado</div>
            <div className="text-xs text-muted-foreground mt-1">
              {letter
                ? `Nenhum cliente com a letra "${letter}".`
                : "Cadastre seu primeiro cliente para começar."}
            </div>
            <Link
              to="/clientes/novo"
              className="inline-flex items-center gap-1 mt-4 text-xs font-bold text-primary hover:underline"
            >
              <Plus className="size-3" /> Novo cliente
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                  <th className="pl-5 pr-2 py-3 w-8">
                    <Checkbox
                      checked={allVisibleSelected}
                      onCheckedChange={() => toggleAll()}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th className="px-3 py-3 font-bold">Nome</th>
                  <th className="px-4 py-3 font-bold hidden md:table-cell">Telefone</th>
                  <th className="px-4 py-3 font-bold hidden md:table-cell">E-mail</th>
                  <th className="px-4 py-3 font-bold">Cidade</th>
                  <th className="px-4 py-3 font-bold hidden lg:table-cell">Desde</th>
                  <th className="px-4 py-3 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="pl-5 pr-2 py-4">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                        aria-label={`Selecionar ${c.name}`}
                      />
                    </td>
                    <td className="px-3 py-4 text-sm font-semibold">{c.name}</td>
                    <td className="px-4 py-4 text-xs font-mono hidden md:table-cell">
                      {c.phone ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-xs hidden md:table-cell">{c.email ?? "—"}</td>
                    <td className="px-4 py-4 text-xs">{c.city ?? "—"}</td>
                    <td className="px-4 py-4 text-xs font-mono hidden lg:table-cell">
                      {formatDateBR(c.created_at)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-3">
                        <Link
                          to="/clientes/$id/editar"
                          params={{ id: c.id }}
                          className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                        >
                          <Pencil className="size-3.5" /> Editar
                        </Link>
                        <button
                          onClick={() => setConfirmId(c.id)}
                          className="inline-flex items-center gap-1 text-xs font-bold text-destructive hover:underline"
                        >
                          <Trash2 className="size-3.5" /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirming && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !del.isPending && setConfirmId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <h3 className="text-lg font-extrabold">Excluir cliente</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong>{confirming.name}</strong>? Esta ação não pode ser
              desfeita. Orçamentos, eventos e contratos vinculados podem ser afetados.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmId(null)}
                disabled={del.isPending}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => del.mutate(confirming.id)}
                disabled={del.isPending}
                className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-50"
              >
                {del.isPending ? "Excluindo…" : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulk && (
        <div
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !bulkDel.isPending && setConfirmBulk(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <h3 className="text-lg font-extrabold">Excluir em lote</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Tem certeza que deseja excluir <strong>{selected.size} cliente(s)</strong>? Esta ação
              não pode ser desfeita. Orçamentos, eventos e contratos vinculados podem ser afetados.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmBulk(false)}
                disabled={bulkDel.isPending}
                className="flex-1 h-10 rounded-lg border border-border text-sm font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => bulkDel.mutate(Array.from(selected))}
                disabled={bulkDel.isPending}
                className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-50"
              >
                {bulkDel.isPending ? "Excluindo…" : `Excluir ${selected.size}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
