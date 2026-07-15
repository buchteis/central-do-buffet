import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Flame, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { maskCpfCnpj, isValidCpfCnpj, onlyDigits, docKind } from "@/lib/doc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/orcamento/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `Solicitar orçamento — ${params.slug}` },
      {
        name: "description",
        content: "Preencha o formulário para receber um orçamento personalizado do buffet.",
      },
    ],
  }),
  component: PublicQuoteForm,
});

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(100),
  whatsapp: z.string().trim().min(8, "WhatsApp inválido").max(20),
  email: z.string().trim().email("E-mail inválido").max(255).optional().or(z.literal("")),
  cpf: z.string().trim().max(20).optional(),
  city: z.string().trim().max(80).optional(),
  event_address: z.string().trim().max(200).optional(),
  event_date: z.string().min(1, "Data obrigatória"),
  event_time: z.string().optional(),
  guest_count: z.coerce.number().int().min(1).max(9999),
  event_type: z.string().trim().max(80).optional(),
  package_desired: z.string().trim().max(120).optional(),
  package_id: z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().uuid().optional()),
  notes: z.string().trim().max(1000).optional(),
});

function PublicQuoteForm() {
  const { slug } = Route.useParams();
  const [sent, setSent] = useState(false);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ["public-tenant", slug],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("id, name, slug, status")
        .eq("slug", slug)
        .maybeSingle();
      return data;
    },
  });

  const { data: packages } = useQuery({
    queryKey: ["public-packages", tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("packages")
        .select("id, name")
        .eq("tenant_id", tenant!.id)
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      if (!tenant?.slug) throw new Error("Buffet não encontrado");
      const { error } = await supabase.rpc("submit_public_quote", {
        p_slug: tenant.slug,
        p_name: payload.name,
        p_whatsapp: payload.whatsapp,
        p_email: payload.email || null,
        p_cpf: payload.cpf || null,
        p_city: payload.city || null,
        p_event_address: payload.event_address || null,
        p_event_date: payload.event_date,
        p_event_time: payload.event_time || null,
        p_guest_count: payload.guest_count,
        p_event_type: payload.event_type || null,
        p_package_id: payload.package_id || null,
        p_notes: payload.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => setSent(true),
    onError: (e: any) => toast.error(e.message ?? "Erro ao enviar"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Flame className="size-6 text-primary animate-pulse" />
      </div>
    );
  }

  if (!tenant || tenant.status !== "ativo") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold">Formulário indisponível</h1>
          <p className="text-sm text-muted-foreground">
            Este link não está ativo no momento. Entre em contato diretamente com o buffet.
          </p>
        </div>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-lg text-center space-y-4">
          <div className="mx-auto size-14 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="size-7 text-success" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">Solicitação enviada!</h1>
          <p className="text-sm text-muted-foreground">
            Recebemos sua solicitação. A equipe do <strong>{tenant.name}</strong> entrará em contato
            em breve pelo WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = Object.fromEntries(new FormData(e.currentTarget)) as any;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    submit.mutate(parsed.data);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="size-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Flame className="size-6 text-primary-foreground" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Solicite seu orçamento
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{tenant.name}</h1>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5 shadow-lg"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field name="name" label="Seu nome *" required />
            <Field name="whatsapp" label="WhatsApp *" required placeholder="(11) 99999-9999" />
            <Field name="email" label="E-mail" type="email" />
            <Field name="cpf" label="CPF" placeholder="000.000.000-00" />
            <Field name="city" label="Cidade" />
            <Field name="event_type" label="Tipo do evento" placeholder="Aniversário, casamento…" />
          </div>

          <Field name="event_address" label="Endereço do evento" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field name="event_date" label="Data do evento *" type="date" required />
            <Field name="event_time" label="Horário" type="time" />
            <Field name="guest_count" label="Convidados *" type="number" required min={1} />
          </div>

          {packages && packages.length > 0 && (
            <div className="space-y-2">
              <Label>Pacote desejado</Label>
              <Select name="package_id">
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pacote (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {packages.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Conte mais sobre o seu evento…"
            />
          </div>

          <Button type="submit" className="w-full h-11" disabled={submit.isPending}>
            {submit.isPending ? "Enviando…" : <>
              <Send className="size-4" /> Solicitar orçamento
            </>}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            Ao enviar, você concorda em ser contatado pela equipe do buffet.
          </p>
        </form>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { name: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...rest} />
    </div>
  );
}
