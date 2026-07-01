import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Package as PackageIcon } from "lucide-react";
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

function PackagesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: packages, isLoading } = useQuery({
    queryKey: ["packages"],
    queryFn: async () => {
      const { data, error } = await supabase.from("packages").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");
      const { error } = await supabase.from("packages").insert({
        ...values,
        owner_id: userRes.user.id,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["packages"] });
      qc.invalidateQueries({ queryKey: ["packages-select"] });
      toast.success("Pacote criado!");
      setOpen(false);
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
    create.mutate(parsed.data);
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full shadow-lg shadow-primary/20 text-xs font-bold" size="sm">
              <Plus className="size-4 mr-1" /> Novo pacote
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo pacote</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input name="name" required placeholder="Ex.: Churrasco Premium" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea name="description" rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Preço por pessoa (R$) *</Label>
                <Input
                  name="price_per_person"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="80.00"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mín. pessoas</Label>
                  <Input name="min_people" type="number" min="0" />
                </div>
                <div className="space-y-2">
                  <Label>Máx. pessoas</Label>
                  <Input name="max_people" type="number" min="0" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={create.isPending}>
                  {create.isPending ? "Salvando…" : "Criar pacote"}
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
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => toggle.mutate({ id: p.id, active: !p.active })}
              >
                {p.active ? "Desativar" : "Ativar"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
