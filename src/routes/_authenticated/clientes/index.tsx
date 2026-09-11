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

      {/* --- CARDS A-Z COLORIDOS E MAIORES --- */}
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

          return (
            <button
              key={char}
              disabled={!hasItems}
              onClick={() => setLetter(isSelected ? null : char)}
              className={`px-3.5 py-2 rounded-xl text-sm font-bold transition-all duration-200 flex items-center gap-1.5 transform active:scale-95 ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30 ring-2 ring-offset-2 ring-indigo-600 dark:ring-offset-slate-950 scale-105"
                  : hasItems
                  ? "bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200/50 dark:border-indigo-800/40 cursor-pointer shadow-sm"
                  : "bg-muted/30 text-muted-foreground/30 border border-transparent cursor-not-allowed opacity-50"
              }`}
            >
              <span>{char}</span>
              {hasItems && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-indigo-200/60 text-indigo-800 dark:bg-indigo-900/80 dark:text-indigo-200"
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
