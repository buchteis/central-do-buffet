import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenantAccess } from "@/hooks/useTenantAccess";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — Meu Churras" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: access } = useTenantAccess();
  const { data } = useQuery({
    queryKey: ["buffet-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("buffet_settings").select("*").maybeSingle();
      return data;
    },
  });

  const [f, setF] = useState({
    business_name: "", phone: "", whatsapp: "", address: "", pix_key: "", pix_holder: "",
    contract_template: "", wa_quote_template: "", wa_reminder_template: "", wa_pix_template: "",
  });

  useEffect(() => {
    if (data) setF({
      business_name: data.business_name ?? "",
      phone: data.phone ?? "",
      whatsapp: data.whatsapp ?? "",
      address: data.address ?? "",
      pix_key: data.pix_key ?? "",
      pix_holder: data.pix_holder ?? "",
      contract_template: data.contract_template ?? "",
      wa_quote_template: data.wa_quote_template ?? "",
      wa_reminder_template: data.wa_reminder_template ?? "",
      wa_pix_template: data.wa_pix_template ?? "",
    });
  }, [data]);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sem sessão");
      const { error } = await supabase.from("buffet_settings").upsert({ ...f, owner_id: u.user.id });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["buffet-settings"] }); toast.success("Configurações salvas"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Dados do buffet, PIX e modelos de mensagens</p>
      </div>

      {access?.tenant?.slug && (
        <Section title="Link público de orçamento">
          <p className="text-xs text-muted-foreground">
            Compartilhe este link no Instagram, WhatsApp ou site. Cada solicitação chega direto na aba <strong>Leads</strong>.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={`${window.location.origin}/orcamento/${access.tenant.slug}`}
              className="input font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/orcamento/${access.tenant!.slug}`);
                toast.success("Link copiado!");
              }}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap"
            >
              Copiar
            </button>
          </div>
        </Section>
      )}

      <Section title="Dados do buffet">
        <Field label="Nome do buffet"><input value={f.business_name} onChange={(e) => setF({ ...f, business_name: e.target.value })} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input" /></Field>
          <Field label="WhatsApp"><input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} className="input" /></Field>
        </div>
        <Field label="Endereço"><input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className="input" /></Field>
      </Section>

      <Section title="PIX">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chave PIX"><input value={f.pix_key} onChange={(e) => setF({ ...f, pix_key: e.target.value })} className="input" /></Field>
          <Field label="Titular da conta"><input value={f.pix_holder} onChange={(e) => setF({ ...f, pix_holder: e.target.value })} className="input" /></Field>
        </div>
        {f.pix_key && (
          <div className="p-4 bg-muted/40 rounded-lg text-center">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">QR Code PIX</div>
            <img alt="QR PIX" className="mx-auto w-40 h-40 bg-white p-2 rounded" src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(f.pix_key)}`} />
            <div className="text-[11px] font-mono mt-2">{f.pix_key}</div>
          </div>
        )}
      </Section>

      <Section title="Modelos de mensagens (WhatsApp)">
        <p className="text-xs text-muted-foreground">Variáveis disponíveis: {"{cliente}"}, {"{valor}"}, {"{data}"}, {"{hora}"}, {"{pix}"}.</p>
        <Field label="Envio de orçamento"><textarea rows={2} value={f.wa_quote_template} onChange={(e) => setF({ ...f, wa_quote_template: e.target.value })} className="input min-h-[70px]" /></Field>
        <Field label="Lembrete de evento"><textarea rows={2} value={f.wa_reminder_template} onChange={(e) => setF({ ...f, wa_reminder_template: e.target.value })} className="input min-h-[70px]" /></Field>
        <Field label="Envio de PIX"><textarea rows={2} value={f.wa_pix_template} onChange={(e) => setF({ ...f, wa_pix_template: e.target.value })} className="input min-h-[70px]" /></Field>
      </Section>

      <Section title="Modelo padrão de contrato">
        <p className="text-xs text-muted-foreground mb-2">Variáveis: {"{cliente}"}, {"{buffet}"}, {"{data_evento}"}, {"{local_evento}"}, {"{convidados}"}, {"{valor}"}, {"{pix}"}, {"{data_hoje}"}.</p>
        <textarea rows={10} value={f.contract_template} onChange={(e) => setF({ ...f, contract_template: e.target.value })} className="input min-h-[240px] font-mono text-xs" />
      </Section>

      <div className="flex justify-end">
        <button disabled={mut.isPending} onClick={() => mut.mutate()} className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50">Salvar configurações</button>
      </div>

      <style>{`.input{width:100%;height:40px;padding:0 12px;border:1px solid hsl(var(--border));border-radius:8px;background:hsl(var(--background));font-size:14px}textarea.input{padding:10px 12px;height:auto}`}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
      <h2 className="font-extrabold">{title}</h2>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">{label}</div>
      {children}
    </div>
  );
}
