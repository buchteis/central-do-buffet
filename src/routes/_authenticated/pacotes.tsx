import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Package as PackageIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/pacotes")({
  head: () => ({ meta: [{ title: "Pacotes — Central do Buffet" }] }),
  component: PackagesPage,
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
});

type Pack = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
};

type Tier = {
  id: string;
  package_id: string;
  min_guests: number;
  max_guests: number;
  price_per_person: number;
  position: number;
};

function PackagesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pack | null>(null);

  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Pack[];
    },
  });

  const { data: allTiers } = useQuery({
    queryKey: ["all-tiers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("package_price_tiers")
        .select("*")
        .order("position", { ascending: true })
        .order("min_guests", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tier[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");
      if (editing) {
        const { error } = await supabase
          .from("packages")
          .update(values)
          .eq("id", editing.id);
        if (error) throw error;
        return editing.id;
      } else {
        const { data, error } = await supabase
          .from("packages")
          .insert({
            ...values,
            owner_id: userRes.user.id,
            price_per_person: 0,
            active: true,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packages"] });
      qc.invalidateQueries({ queryKey: ["packages-select"] });
      toast.success(editing ? "Pacote atualizado!" : "Pacote criado!");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packages"] });
      qc.invalidateQueries({ queryKey: ["packages-select"] });
      toast.success("Pacote excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("packages").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["packages"] }),
  });

  function openNew() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(p: Pack) {
    setEditing(p);
    setOpen(true);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: f.get("name"),
      description: f.get("description") || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    save.mutate(parsed.data);
  }

  const tiersByPackage = new Map<string, Tier[]>();
  (allTiers ?? []).forEach((t) => {
    const arr = tiersByPackage.get(t.package_id) ?? [];
    arr.push(t);
    tiersByPackage.set(t.package_id, arr);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Pacotes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {packages?.length ?? 0} pacote(s) cadastrado(s)
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={openNew}
              className="rounded-full shadow-lg shadow-primary/20 text-xs font-bold"
              size="sm"
            >
              <Plus className="size-4 mr-1" /> Novo pacote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar pacote" : "Novo pacote"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4" key={editing?.id ?? "new"}>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  name="name"
                  required
                  defaultValue={editing?.name ?? ""}
                  placeholder="Ex.: Churrasco Premium"
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={editing?.description ?? ""}
                />
              </div>
              {editing ? (
                <>
                  <PriceTiersEditor packageId={editing.id} />
                  <PackageProductsEditor packageId={editing.id} />
                </>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg p-3">
                  💡 Após criar o pacote, você poderá adicionar as <b>faixas de preço</b> e os
                  produtos consumidos editando-o.
                </p>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Criar pacote"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (packages?.length ?? 0) === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <PackageIcon className="size-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm font-semibold">Nenhum pacote ainda</div>
          <div className="text-xs text-muted-foreground mt-1">
            Cadastre um pacote para começar a criar orçamentos.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages!.map((p) => {
            const tiers = tiersByPackage.get(p.id) ?? [];
            return (
              <div
                key={p.id}
                className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <h3 className="font-extrabold tracking-tight truncate">{p.name}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.description ?? "—"}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] rounded-full font-bold uppercase ${
                      p.active
                        ? "bg-success/10 text-success"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {p.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <div className="space-y-1">
                  {tiers.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">
                      Sem faixas cadastradas
                    </div>
                  ) : (
                    tiers.map((t) => (
                      <div
                        key={t.id}
                        className="flex justify-between items-baseline text-xs bg-muted/40 rounded-md px-2 py-1"
                      >
                        <span className="text-muted-foreground font-medium">
                          {t.min_guests}–{t.max_guests} conv.
                        </span>
                        <span className="font-mono font-bold text-primary">
                          {brl(t.price_per_person)}/pessoa
                        </span>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEdit(p)}
                  >
                    <Pencil className="size-3 mr-1" /> Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggle.mutate({ id: p.id, active: !p.active })}
                  >
                    {p.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Excluir o pacote "${p.name}"?`)) remove.mutate(p.id);
                    }}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PriceTiersEditor({ packageId }: { packageId: string }) {
  const qc = useQueryClient();
  const { data: tiers } = useQuery({
    queryKey: ["pkg-tiers", packageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("package_price_tiers")
        .select("*")
        .eq("package_id", packageId)
        .order("position", { ascending: true })
        .order("min_guests", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Tier[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pkg-tiers", packageId] });
    qc.invalidateQueries({ queryKey: ["all-tiers"] });
    qc.invalidateQueries({ queryKey: ["packages-select"] });
  };

  const add = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");
      const last = (tiers ?? [])[tiers?.length ? tiers.length - 1 : -1];
      const nextMin = last ? (last.max_guests ?? 0) + 1 : 0;
      const { error } = await (supabase as any).from("package_price_tiers").insert({
        package_id: packageId,
        owner_id: userRes.user.id,
        min_guests: nextMin,
        max_guests: nextMin + 30,
        price_per_person: 0,
        position: (tiers?.length ?? 0),
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: async (v: { id: string; field: keyof Tier; value: number }) => {
      const { error } = await (supabase as any)
        .from("package_price_tiers")
        .update({ [v.field]: v.value })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("package_price_tiers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border-t border-border pt-4 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
          Faixas de Preço
        </Label>
        <Button type="button" variant="outline" size="sm" onClick={() => add.mutate()}>
          <Plus className="size-3 mr-1" /> Nova faixa
        </Button>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {(tiers ?? []).length === 0 && (
          <p className="text-[11px] text-muted-foreground italic">
            Nenhuma faixa. Adicione ao menos uma para poder usar em orçamentos.
          </p>
        )}
        {(tiers ?? []).map((t) => (
          <div key={t.id} className="grid grid-cols-[80px_80px_1fr_auto] gap-2 items-center">
            <Input
              type="number"
              min={0}
              defaultValue={t.min_guests}
              className="h-9"
              placeholder="De"
              onBlur={(e) =>
                upd.mutate({ id: t.id, field: "min_guests", value: Number(e.target.value) || 0 })
              }
            />
            <Input
              type="number"
              min={0}
              defaultValue={t.max_guests}
              className="h-9"
              placeholder="Até"
              onBlur={(e) =>
                upd.mutate({ id: t.id, field: "max_guests", value: Number(e.target.value) || 0 })
              }
            />
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                R$
              </span>
              <Input
                type="number"
                step="0.01"
                min={0}
                defaultValue={t.price_per_person}
                className="h-9 pl-8"
                placeholder="Valor/pessoa"
                onBlur={(e) =>
                  upd.mutate({
                    id: t.id,
                    field: "price_per_person",
                    value: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-destructive"
              onClick={() => del.mutate(t.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Ex.: 30–69 conv. = R$ 80/pessoa · 70–119 = R$ 75 · 120–300 = R$ 70. O valor por pessoa é
        aplicado automaticamente conforme o número de convidados do orçamento.
      </p>
    </div>
  );
}

function PackageProductsEditor({ packageId }: { packageId: string }) {
  const qc = useQueryClient();
  const { data: items } = useQuery({
    queryKey: ["pkg-products", packageId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("package_products")
        .select("id, product_id, qty_per_person, qty_fixed, stock_products(name, unit)")
        .eq("package_id", packageId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: products } = useQuery({
    queryKey: ["stock-products-select"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stock_products")
        .select("id, name, unit")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async (product_id: string) => {
      const { error } = await (supabase as any)
        .from("package_products")
        .insert({ package_id: packageId, product_id, qty_per_person: 0, qty_fixed: 0 });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pkg-products", packageId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const upd = useMutation({
    mutationFn: async (v: { id: string; qty_per_person: number; qty_fixed: number }) => {
      const { error } = await (supabase as any)
        .from("package_products")
        .update({ qty_per_person: v.qty_per_person, qty_fixed: v.qty_fixed })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pkg-products", packageId] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("package_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pkg-products", packageId] }),
  });

  const usedIds = new Set((items ?? []).map((i: any) => i.product_id));
  const available = (products ?? []).filter((p: any) => !usedIds.has(p.id));

  return (
    <div className="border-t border-border pt-4 space-y-2">
      <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">
        Produtos consumidos
      </Label>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {(items ?? []).map((it: any) => (
          <div key={it.id} className="flex gap-2 items-center text-sm">
            <span className="flex-1 truncate">
              {it.stock_products?.name}{" "}
              <span className="text-xs text-muted-foreground">({it.stock_products?.unit})</span>
            </span>
            <Input
              type="number"
              step="0.001"
              min="0"
              className="w-24"
              defaultValue={it.qty_per_person}
              placeholder="p/pessoa"
              onBlur={(e) =>
                upd.mutate({
                  id: it.id,
                  qty_per_person: Number(e.target.value) || 0,
                  qty_fixed: Number(it.qty_fixed) || 0,
                })
              }
            />
            <Input
              type="number"
              step="0.001"
              min="0"
              className="w-24"
              defaultValue={it.qty_fixed}
              placeholder="fixo"
              onBlur={(e) =>
                upd.mutate({
                  id: it.id,
                  qty_per_person: Number(it.qty_per_person) || 0,
                  qty_fixed: Number(e.target.value) || 0,
                })
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => del.mutate(it.id)}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
      {available.length > 0 && (
        <select
          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
          value=""
          onChange={(e) => e.target.value && add.mutate(e.target.value)}
        >
          <option value="">+ Adicionar produto…</option>
          {available.map((p: any) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.unit})
            </option>
          ))}
        </select>
      )}
      <p className="text-[10px] text-muted-foreground">
        Consumo = (por pessoa × convidados) + fixo. Recalculado automaticamente.
      </p>
    </div>
  );
}
