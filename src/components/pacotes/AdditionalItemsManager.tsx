import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { brl } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type AdditionalItem = {
  id: string;
  name: string;
  unit: string;
  unit_price: number;
  default_qty: number;
  product_id: string | null;
  active: boolean;
};

const emptyForm = { name: "", unit: "un", unit_price: 0, product_id: "none" };

export function AdditionalItemsManager() {
  const qc = useQueryClient();
  const { data: access } = useTenantAccess();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdditionalItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: items } = useQuery({
    queryKey: ["additional-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("additional_items").select("*").order("position").order("name");
      if (error) throw error;
      return data as AdditionalItem[];
    },
  });

  const { data: products } = useQuery({
    queryKey: ["stock-products-select"],
    queryFn: async () => {
      const { data } = await supabase.from("stock_products").select("id, name, unit").eq("active", true).order("name");
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error("Informe o nome do item adicional");
      const product = (products ?? []).find((p) => p.id === form.product_id);
      const values = {
        name,
        unit: product?.unit ?? (form.unit.trim() || "un"),
        unit_price: Number(form.unit_price) || 0,
        default_qty: 0,
        product_id: form.product_id === "none" ? null : form.product_id,
      };
      if (editing) {
        const { error } = await supabase.from("additional_items").update(values).eq("id", editing.id);
        if (error) throw error;
        return;
      }
      const { data: user } = await supabase.auth.getUser();
      if (!user.user || !access?.tenant?.id) throw new Error("Sessão expirada");
      const { error } = await supabase.from("additional_items").insert({
        ...values,
        owner_id: user.user.id,
        tenant_id: access.tenant.id,
        position: (items?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["additional-items"] });
      qc.invalidateQueries({ queryKey: ["additional-items-select"] });
      toast.success(editing ? "Item adicional atualizado" : "Item adicional cadastrado");
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (item: AdditionalItem) => {
      const { error } = await supabase.from("additional_items").update({ active: !item.active }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["additional-items"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("additional_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["additional-items"] });
      qc.invalidateQueries({ queryKey: ["additional-items-select"] });
      toast.success("Item adicional excluído");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startEdit = (item: AdditionalItem) => {
    setEditing(item);
    setForm({
      name: item.name,
      unit: item.unit,
      unit_price: item.unit_price,
      product_id: item.product_id ?? "none",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-full font-bold">
          <Plus className="size-4" /> Itens adicionais
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Itens adicionais com preço unitário</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-border p-4">
          <div className="space-y-1 sm:col-span-2">
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex.: Barril de Chope" />
          </div>
          <div className="space-y-1">
            <Label>Produto de estoque (opcional)</Label>
            <Select value={form.product_id} onValueChange={(value) => setForm((f) => ({ ...f, product_id: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo com estoque</SelectItem>
                {(products ?? []).map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Unidade</Label>
            <Input value={form.unit} disabled={form.product_id !== "none"} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="un, litro, barril" />
          </div>
          <div className="space-y-1">
            <Label>Preço unitário (R$)</Label>
            <Input type="number" min={0} step="0.01" value={form.unit_price} onChange={(e) => setForm((f) => ({ ...f, unit_price: Number(e.target.value) || 0 }))} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancelar edição</Button>}
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending}>{editing ? "Salvar item" : "Cadastrar item"}</Button>
          </div>
        </div>

        <div className="divide-y divide-border rounded-lg border border-border">
          {(items ?? []).map((item) => (
            <div key={item.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{item.name}</div>
                <div className="text-xs text-muted-foreground">{brl(item.unit_price)} / {item.unit}</div>
              </div>
              <Button type="button" size="sm" variant={item.active ? "outline" : "secondary"} onClick={() => toggle.mutate(item)}>{item.active ? "Ativo" : "Inativo"}</Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => startEdit(item)} aria-label="Editar item"><Pencil className="size-4" /></Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => confirm("Excluir este item adicional?") && remove.mutate(item.id)} aria-label="Excluir item"><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
          {(items ?? []).length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Nenhum item adicional cadastrado.</div>}
        </div>

        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}