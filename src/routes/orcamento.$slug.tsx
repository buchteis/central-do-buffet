import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Flame, Send, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicTenantLogo } from "@/lib/public-logo.functions";
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
  cpf: z
    .string()
    .trim()
    .max(20)
    .optional()
    .refine((v) => !v || isValidCpfCnpj(v), { message: "CPF/CNPJ inválido" }),
  city: z.string().trim().max(80).optional(),
  event_address: z.string().trim().max(200).optional(),
  event_date: z.string().min(1, "Data obrigatória"),
  event_time: z.string().optional(),
  guest_count: z.coerce.number().int().min(1).max(9999),
  event_type: z.string().trim().max(80).optional(),
  package_ids: z.array(z.string().uuid()).optional(),
  notes: z.string().trim().max(1000).optional(),
});

function PublicQuoteForm() {
  const { slug } = Route.useParams();
  const [sent, setSent] = useState(false);
  const [cpf, setCpf] = useState("");
  const cpfKind = docKind(cpf);
  const [guestCount] = useState<number | null>(null);

  const [selectedPackages, setSelectedPackages] = useState<{ id: string; package_id: string }[]>([]);

  function addPackage() {
    setSelectedPackages((old) => [
      ...old,
      {
        id: crypto.randomUUID(),
        package_id: "",
      },
    ]);
  }

  function removePackage(id: string) {
    setSelectedPackages((old) => old.filter((p) => p.id !== id));
  }

  function updatePackage(id: string, value: string) {
    setSelectedPackages((old) =>
      old.map((p) =>
        p.id === id ? { ...p, package_id: value } : p
      )
    );
  }

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

  // 🔥 QUERY SEM FILTRO - MOSTRA TODOS OS PACOTES
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

  const fetchLogo = useServerFn(getPublicTenantLogo);
  const { data: logo } = useQuery({
    queryKey: ["public-tenant-logo", slug],
    enabled: !!tenant?.id,
    staleTime: 30 * 60 * 1000,
    queryFn: () => fetchLogo({ data: { slug } }),
  });

  const submit = useMutation({
    mutationFn: async (payload: z.infer<typeof schema>) => {
      if (!tenant?.slug) throw new Error("Buffet não encontrado");
      const packageIds = selectedPackages
        .map((p) => p.package_id)
        .filter((id) => id && id.trim() !== "");

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
        p_package_id: packageIds.length > 0 ? packageIds[0] : null,
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
    raw.cpf = cpf ? onlyDigits(cpf) : undefined;
    const packageIds = selectedPackages
      .map((p) => p.package_id)
      .filter((id) => id && id.trim() !== "");
    raw.package_ids = packageIds;
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
        <div className="flex flex-col items-center gap-3 mb-6 text-center">
          {logo?.url ? (
            <img
              src={logo.url}
              alt={`Logomarca ${tenant.name}`}
              className="max-h-24 max-w-[220px] object-contain"
            />
          ) : (
            <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center">
              <Flame className="size-6 text-primary" />
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
              Solicite seu orçamento
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">{tenant.name}</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 md:p-8 space-y-5 shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field name="name" label="Seu nome *" required />
            <Field name="whatsapp" label="WhatsApp *" required placeholder="(11) 99999-9999" />
            <Field name="email" label="E-mail" type="email" />
            <div className="space-y-2">
              <Label htmlFor="cpf">
                CPF/CNPJ{" "}
                {cpfKind && (
                  <span className="text-[10px] font-semibold text-primary uppercase ml-1">
                    {cpfKind}
                  </span>
                )}
              </Label>
              <Input
                id="cpf"
                name="cpf"
                inputMode="numeric"
                placeholder="CPF ou CNPJ"
                value={cpf}
                onChange={(e) => setCpf(maskCpfCnpj(e.target.value))}
              />
            </div>
            <Field name="city" label="Cidade" />
            <Field name="event_type" label="Tipo do evento" placeholder="Aniversário, casamento…" />
          </div>

          <Field name="event_address" label="Endereço do evento" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field name="event_date" label="Data do evento *" type="date" required />
            <Field name="event_time" label="Horário" type="time" />
            <Field
              name="guest_count"
              label="Convidados *"
              type="number"
              required
              min={1}
            />
          </div>

          {/* Pacotes — opcional */}
          <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <Label className="font-semibold">Pacotes desejados</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Opcional — deixe em branco se preferir que o buffet monte uma proposta personalizada.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addPackage} className="h-8 gap-1 text-xs">
                <Plus className="size-3.5" /> Adicionar pacote
              </Button>
            </div>

            {packages && packages.length > 0 ? (
              selectedPackages.map((pkg, index) => (
                <div key={pkg.id} className="flex items-center gap-3 bg-background p-3 rounded-lg border">
                  <div className="flex-1">
                    <Select value={pkg.package_id} onValueChange={(value) => updatePackage(pkg.id, value)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`Pacote ${index + 1}`} />
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => removePackage(pkg.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhum pacote cadastrado.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Conte mais sobre o seu evento…" />
          </div>

          <Button type="submit" className="w-full h-11" disabled={submit.isPending}>
            {submit.isPending ? "Enviando…" : <><Send className="size-4" /> Solicitar orçamento</>}
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
