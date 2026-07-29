import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, Boxes, Pencil, Trash2, ArrowDownUp, History } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useSearchFilter } from "@/lib/search-store";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StockHealthChart } from "@/components/estoque/StockHealthChart";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Central do Buffet" }] }),
  component: StockPage,
});

type Product = {
  id: string;
  name: string;
  unit: string;
  physical_qty: number;
  reserved_qty: number;
  min_qty: number;
  active: boolean;
  notes: string | null;
  category_id: string | null;
  stock_categories?: { name: string } | null;
};

type Category = { id: string; name: string };

const productSchema = z.object({
  name: z.string().trim().min(2).max(80),
  unit: z.string().trim().min(1).max(20),
  category_id: z.string().uuid().optional().nullable(),
  min_qty: z.number().min(0).optional(),
  notes: z.string().trim().max(500).optional(),
});

function StockPage() {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("stock-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_products" }, () =>
        qc.invalidateQueries({ queryKey: ["stock-products"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_movements" }, () =>
        qc.invalidateQueries({ queryKey: ["stock-movements"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Controle de produtos, categorias e movimentações.
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className="mt-4">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="movements" className="mt-4">
          <MovementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjOpen, setAdjOpen] = useState<Product | null>(null);

  const { match } = useSearchFilter();
  const { data: allProducts, isLoading } = useQuery({
    queryKey: ["stock-products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stock_products")
        .select("*, stock_categories(name)")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const products = (allProducts ?? []).filter((p: any) =>
    match(p.name, p.unit, p.notes, p.stock_categories?.name),
  );

  const { data: categories } = useQuery({
    queryKey: ["stock-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stock_categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const save = useMutation({
    mutationFn: async (values: z.infer<typeof productSchema>) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_id", userRes.user.id)
        .maybeSingle();
      if (!tenant) throw new Error("Buffet não encontrado");

      if (editing) {
        const { error } = await (supabase as any)
          .from("stock_products")
          .update({
            name: values.name,
            unit: values.unit,
            category_id: values.category_id || null,
            min_qty: values.min_qty ?? 0,
            notes: values.notes ?? null,
          })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("stock_products").insert({
          owner_id: userRes.user.id,
          tenant_id: tenant.id,
          name: values.name,
          unit: values.unit,
          category_id: values.category_id || null,
          min_qty: values.min_qty ?? 0,
          notes: values.notes ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-products"] });
      toast.success(editing ? "Produto atualizado!" : "Produto criado!");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("stock_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-products"] });
      toast.success("Produto excluído");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = productSchema.safeParse({
      name: f.get("name"),
      unit: f.get("unit") || "un",
      category_id: (f.get("category_id") as string) || null,
      min_qty: f.get("min_qty") ? Number(f.get("min_qty")) : 0,
      notes: (f.get("notes") as string) || undefined,
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    save.mutate(parsed.data);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
              className="rounded-full shadow-lg shadow-primary/20 text-xs font-bold"
              size="sm"
            >
              <Plus className="size-4 mr-1" /> Novo produto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4" key={editing?.id ?? "new"}>
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input name="name" required defaultValue={editing?.name ?? ""} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unidade *</Label>
                  <Input
                    name="unit"
                    required
                    defaultValue={editing?.unit ?? "un"}
                    placeholder="kg, un, L…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estoque mínimo</Label>
                  <Input
                    name="min_qty"
                    type="number"
                    step="0.001"
                    min="0"
                    defaultValue={editing?.min_qty ?? 0}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Categoria</Label>
                <select
                  name="category_id"
                  defaultValue={editing?.category_id ?? ""}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">— Sem categoria —</option>
                  {(categories ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending ? "Salvando…" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!isLoading && (products?.length ?? 0) > 0 && <StockHealthChart products={products as any} />}

      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (products?.length ?? 0) === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-16 text-center">
          <Boxes className="size-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm font-semibold">Nenhum produto cadastrado</div>
          <div className="text-xs text-muted-foreground mt-1">
            Cadastre produtos para vinculá-los aos pacotes.
          </div>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                  <th className="px-5 py-3 font-bold">Produto</th>
                  <th className="px-3 py-3 font-bold hidden md:table-cell">Categoria</th>
                  <th className="px-3 py-3 font-bold text-right">Reservado</th>
                  <th className="px-3 py-3 font-bold text-right">Disponível</th>
                  <th className="px-3 py-3 font-bold text-right">Mínimo</th>
                  <th className="px-3 py-3 font-bold">Un.</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products!.map((p) => {
                  const avail = Number(p.physical_qty) - Number(p.reserved_qty);
                  const low = avail <= Number(p.min_qty);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-5 py-3 font-semibold">{p.name}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell">
                        {p.stock_categories?.name ?? "—"}
                      </td>
                      <td className="px-3 py-3 font-mono text-right">
                        {Number(p.reserved_qty).toLocaleString("pt-BR")}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-3 font-mono text-right font-bold",
                          low ? "text-destructive" : "text-success",
                        )}
                      >
                        {avail.toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-3 font-mono text-right text-muted-foreground">
                        {Number(p.min_qty).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-3 py-3 text-xs">{p.unit}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAdjOpen(p)}
                            title="Movimentar"
                          >
                            <ArrowDownUp className="size-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditing(p);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Excluir "${p.name}"?`)) remove.mutate(p.id);
                            }}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adjOpen && (
        <AdjustDialog product={adjOpen} onClose={() => setAdjOpen(null)} />
      )}
    </div>
  );
}

function AdjustDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"purchase" | "adjust_in" | "adjust_out">("purchase");
  const [qty, setQty] = useState("");
  const [notes, setNotes] = useState("");

  const move = useMutation({
    mutationFn: async () => {
      const q = Number(qty);
      if (!q || q <= 0) throw new Error("Quantidade inválida");
      const { data: userRes } = await supabase.auth.getUser();
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_id", userRes.user!.id)
        .maybeSingle();
      const { error } = await (supabase as any).from("stock_movements").insert({
        tenant_id: tenant!.id,
        product_id: product.id,
        kind,
        quantity: q,
        notes: notes || null,
        created_by: userRes.user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-products"] });
      qc.invalidateQueries({ queryKey: ["stock-movements"] });
      toast.success("Movimentação registrada");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimentar — {product.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v: any) => setKind(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Compra (entrada)</SelectItem>
                <SelectItem value="adjust_in">Ajuste positivo</SelectItem>
                <SelectItem value="adjust_out">Ajuste negativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Quantidade ({product.unit})</Label>
            <Input
              type="number"
              step="0.001"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => move.mutate()} disabled={move.isPending}>
            {move.isPending ? "Registrando…" : "Registrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["stock-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stock_categories")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Category[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Informe um nome");
      const { data: userRes } = await supabase.auth.getUser();
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("owner_id", userRes.user!.id)
        .maybeSingle();
      const { error } = await (supabase as any).from("stock_categories").insert({
        name: trimmed,
        owner_id: userRes.user!.id,
        tenant_id: tenant!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-categories"] });
      setName("");
      toast.success("Categoria criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("stock_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stock-categories"] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Nome da categoria"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create.mutate()}
        />
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          <Plus className="size-4 mr-1" /> Adicionar
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {(categories ?? []).map((c) => (
          <div
            key={c.id}
            className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <span className="font-semibold text-sm">{c.name}</span>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Excluir "${c.name}"?`)) remove.mutate(c.id);
              }}
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOV_PERIODS: { key: "dia" | "mes" | "ano" | "todos"; label: string }[] = [
  { key: "dia", label: "Dia" },
  { key: "mes", label: "Mês" },
  { key: "ano", label: "Ano" },
  { key: "todos", label: "Tudo" },
];

function movStartOf(period: "dia" | "mes" | "ano" | "todos") {
  const now = new Date();
  if (period === "dia") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "mes") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === "ano") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function MovementsTab() {
  const { match } = useSearchFilter();
  const [period, setPeriod] = useState<"dia" | "mes" | "ano" | "todos">("mes");
  const { data: allMovements, isLoading } = useQuery({
    queryKey: ["stock-movements"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stock_movements")
        .select("*, stock_products(name, unit)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const from = movStartOf(period);
  const data = (allMovements ?? [])
    .filter((m: any) => !from || new Date(m.created_at) >= from)
    .filter((m: any) => match(m.stock_products?.name, m.kind, m.notes, m.quantity));


  const kindLabel: Record<string, string> = {
    reserve: "Reserva",
    release: "Liberação",
    consume: "Baixa",
    return: "Devolução",
    purchase: "Compra",
    adjust_in: "Ajuste +",
    adjust_out: "Ajuste -",
  };
  const kindStyle: Record<string, string> = {
    reserve: "bg-info/10 text-info",
    release: "bg-muted text-muted-foreground",
    consume: "bg-primary/10 text-primary",
    return: "bg-success/10 text-success",
    purchase: "bg-success/10 text-success",
    adjust_in: "bg-success/10 text-success",
    adjust_out: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {isLoading ? (
        <div className="p-10 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="p-16 text-center">
          <History className="size-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm font-semibold">Sem movimentações ainda</div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border bg-muted/30">
                <th className="px-5 py-3 font-bold">Data</th>
                <th className="px-3 py-3 font-bold">Produto</th>
                <th className="px-3 py-3 font-bold">Tipo</th>
                <th className="px-3 py-3 font-bold text-right">Qtd</th>
                <th className="px-3 py-3 font-bold hidden md:table-cell">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data!.map((m: any) => (
                <tr key={m.id}>
                  <td className="px-5 py-3 text-xs font-mono">
                    {formatDateBR(m.created_at)}
                  </td>
                  <td className="px-3 py-3 font-semibold">
                    {m.stock_products?.name ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] rounded-full font-bold uppercase",
                        kindStyle[m.kind],
                      )}
                    >
                      {kindLabel[m.kind] ?? m.kind}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-right">
                    {Number(m.quantity).toLocaleString("pt-BR")}{" "}
                    <span className="text-xs text-muted-foreground">
                      {m.stock_products?.unit ?? ""}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground hidden md:table-cell">
                    {m.notes ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
