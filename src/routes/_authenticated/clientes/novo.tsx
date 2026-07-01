import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  head: () => ({ meta: [{ title: "Novo cliente — Meu Churras" }] }),
  component: NewClientPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Nome obrigatório").max(120),
  cpf: z.string().trim().max(20).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  whatsapp: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail inválido").max(150).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

function NewClientPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Sessão expirada");
      const payload = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, v === "" ? null : v]),
      );
      const { data, error } = await supabase
        .from("clients")
        .insert({ ...(payload as any), name: values.name, owner_id: userRes.user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Cliente cadastrado!");
      navigate({ to: "/clientes" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    mut.mutate(parsed.data);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" /> Voltar
      </Link>
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Somente o nome é obrigatório. Complete o resto quando puder.
        </p>
      </div>

      <form onSubmit={onSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Field label="Nome completo *" name="name" required />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="CPF" name="cpf" placeholder="000.000.000-00" />
          <Field label="Cidade" name="city" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Telefone" name="phone" placeholder="(11) 90000-0000" />
          <Field label="WhatsApp" name="whatsapp" placeholder="(11) 90000-0000" />
        </div>
        <Field label="E-mail" name="email" type="email" />
        <Field label="Endereço" name="address" />
        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea id="notes" name="notes" rows={3} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: "/clientes" })}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={mut.isPending}>
            {mut.isPending ? "Salvando…" : "Salvar cliente"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} placeholder={placeholder} required={required} />
    </div>
  );
}
