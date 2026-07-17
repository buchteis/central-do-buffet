import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { maskCpfCnpj, onlyDigits, docKind } from "@/lib/doc";

export const Route = createFileRoute("/_authenticated/clientes/novo")({
  head: () => ({
    meta: [{ title: "Novo cliente — Meu Churras" }],
  }),
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

  google_calendar_email: z.string().trim().email("E-mail inválido").max(150).optional().or(z.literal("")),
});

function NewClientPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [cpf, setCpf] = useState("");

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof schema>) => {
      const { data: userData, error: userError } = await supabase.auth.getUser();

      if (userError || !userData.user) {
        throw new Error("Sessão expirada");
      }

      const payload = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [key, value === "" ? null : value]),
      ) as Record<string, any>;

      const { data, error } = await supabase
        .from("clients")
        .insert({
          ...payload,
          name: values.name,
          owner_id: userData.user.id,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["clients"],
      });

      toast.success("Cliente cadastrado!");

      navigate({
        to: "/clientes",
      });
    },

    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;

    formData.cpf = cpf ? onlyDigits(cpf) : "";

    const result = schema.safeParse(formData);

    if (!result.success) {
      toast.error(result.error.issues[0].message);

      return;
    }

    mutation.mutate(result.data);
  }

  const cpfType = docKind(cpf);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/clientes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Voltar
      </Link>

      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Novo cliente</h1>

        <p className="text-sm text-muted-foreground mt-1">
          Somente o nome é obrigatório. Complete o resto quando puder.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <Field label="Nome completo *" name="name" required />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cpf">
              CPF/CNPJ
              {cpfType && <span className="text-[10px] font-semibold text-primary uppercase ml-1">{cpfType}</span>}
            </Label>

            <Input
              id="cpf"
              name="cpf"
              inputMode="numeric"
              placeholder="CPF ou CNPJ"
              value={cpf}
              onChange={(event) => setCpf(maskCpfCnpj(event.target.value))}
            />
          </div>

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

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Calendar className="size-5 text-blue-600 shrink-0 mt-0.5" />

            <div className="flex-1">
              <Label htmlFor="google_calendar_email" className="text-sm font-medium text-slate-700">
                E-mail do Google Agenda
                <span className="text-blue-500 text-xs ml-1">(opcional)</span>
              </Label>

              <Input
                id="google_calendar_email"
                name="google_calendar_email"
                type="email"
                placeholder="seu.google@email.com"
                className="mt-1"
              />

              <p className="text-xs text-blue-600 mt-1">
                Se preenchido, os eventos serão sincronizados com o Google Agenda.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              navigate({
                to: "/clientes",
              })
            }
          >
            Cancelar
          </Button>

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Salvando..." : "Salvar cliente"}
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
