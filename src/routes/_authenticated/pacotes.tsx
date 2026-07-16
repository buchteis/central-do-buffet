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
  head: () => ({ meta: [{ title: "Pacotes — Meu Churras" }] }),
  component: PackagesPage,
});

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  price_per_person: z.number().positive("Informe o preço"),
  min_people: z.number().int().min(0).optional(),
  max_people: z.number().int().min(0).optional(),
});

type Pack = {
  id: string;
  name: string;
  description: string | null;
  price_per_person: number;
  min_people: number | null;
  max_people: number | null;
  active: boolean;
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
      } else {
        const { error } = await supabase.from("packages").insert({
          ...values,
          owner_id: userRes.user.id,
          active: true,
        });
        if (error) throw error;
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
      price_per_person: Number(f.get("price_per_person")),
      min_people: f.get("min_people") ? Number(f.get("min_people")) : undefined,
      max_people: f.get("max_people") ? Number(f.get("max_people")) : undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    save.mutate(parsed.data);
  }

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
          <DialogContent>
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
              <div className="space-y-2">
                <Label>Valor por pessoa (R$) *</Label>
                <Input
                  name="price_per_person"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={editing?.price_per_person ?? ""}
                  placeholder="80.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade mínima</Label>
                  <Input
                    name="min_people"
                    type="number"
                    min="0"
                    defaultValue={editing?.min_people ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade máxima</Label>
                  <Input
                    name="max_people"
                    type="number"
                    min="0"
                    defaultValue={editing?.max_people ?? ""}
                  />
                </div>
              </div>
              {editing && <PackageProductsEditor packageId={editing.id} />}
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
          {packages!.map((p) => (
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
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-extrabold text-primary font-mono">
                  {brl(p.price_per_person)}
                </span>
                <span className="text-xs text-muted-foreground">/pessoa</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {p.min_people ?? 0} — {p.max_people ?? "∞"} pessoas
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
          ))}
        </div>
      )}
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
