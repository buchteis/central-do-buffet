import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useLogoDisplayUrl } from "@/lib/logo";

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
    business_name: "",
    phone: "",
    whatsapp: "",
    address: "",
    pix_key: "",
    pix_holder: "",
    bank_name: "",
    bank_agency: "",
    bank_account: "",
    bank_holder: "",
    logo_url: "",
    contract_template: "",
    wa_quote_template: "",
    wa_reminder_template: "",
    wa_pix_template: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (data)
      setF({
        business_name: data.business_name ?? "",
        phone: data.phone ?? "",
        whatsapp: data.whatsapp ?? "",
        address: data.address ?? "",
        pix_key: data.pix_key ?? "",
        pix_holder: data.pix_holder ?? "",
        bank_name: (data as any).bank_name ?? "",
        bank_agency: (data as any).bank_agency ?? "",
        bank_account: (data as any).bank_account ?? "",
        bank_holder: (data as any).bank_holder ?? "",
        logo_url: (data as any).logo_url ?? "",
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["buffet-settings"] });
      toast.success("Configurações salvas");
    },
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
            Compartilhe este link no Instagram, WhatsApp ou site. Cada solicitação chega direto na aba{" "}
            <strong>Leads</strong>.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={`${window.location.origin}/orcamento/${access.tenant.slug}`}
              className="input font-mono text-xs"
            />
            <button
              type="button"
              onClick={async () => {
                const url = `${window.location.origin}/orcamento/${access.tenant!.slug}`;
                const ok = await copyToClipboard(url);
                if (ok) toast.success("Link copiado!");
                else toast.error("Não foi possível copiar. Copie manualmente.");
              }}
              className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap"
            >
              Copiar
            </button>
          </div>
        </Section>
      )}

      <Section title="Dados do buffet">
        <Field label="Nome do buffet">
          <input
            value={f.business_name}
            onChange={(e) => setF({ ...f, business_name: e.target.value })}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="input" />
          </Field>
          <Field label="WhatsApp">
            <input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} className="input" />
          </Field>
        </div>
        <Field label="Endereço">
          <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} className="input" />
        </Field>
        <Field label="Logomarca">
          <div className="flex items-center gap-3">
            <label className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold whitespace-nowrap cursor-pointer inline-flex items-center">
              {uploading ? "Enviando..." : "Selecionar Logomarca"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                className="hidden"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  const allowed = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml"];
                  if (!allowed.includes(file.type)) {
                    toast.error("Formato inválido. Use PNG, JPG, JPEG ou SVG.");
                    return;
                  }
                  try {
                    setUploading(true);
                    const { data: u } = await supabase.auth.getUser();
                    if (!u.user) throw new Error("Sem sessão");
                    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                    const path = `${u.user.id}/logo-${Date.now()}.${ext}`;
                    const { error: upErr } = await supabase.storage
                      .from("buffet-logos")
                      .upload(path, file, { upsert: true, contentType: file.type });
                    if (upErr) throw upErr;
                    const { error: saveErr } = await supabase
                      .from("buffet_settings")
                      .upsert({ ...f, logo_url: path, owner_id: u.user.id });
                    if (saveErr) throw saveErr;
                    setF({ ...f, logo_url: path });
                    qc.invalidateQueries({ queryKey: ["buffet-settings"] });
                    qc.invalidateQueries({ queryKey: ["logo-signed-url"] });
                    toast.success("Logomarca enviada");
                  } catch (err: any) {
                    toast.error(err.message ?? "Falha no upload");
                  } finally {
                    setUploading(false);
                  }
                }}
              />
            </label>
            {f.logo_url && (
              <button
                type="button"
                onClick={() => setF({ ...f, logo_url: "" })}
                className="h-10 px-3 rounded-lg border border-border text-xs font-bold"
              >
                Remover
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">PNG, JPG, JPEG ou SVG.</p>
        </Field>
        {f.logo_url && <LogoPreview value={f.logo_url} />}
      </Section>

      <Section title="PIX">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Chave PIX">
            <input value={f.pix_key} onChange={(e) => setF({ ...f, pix_key: e.target.value })} className="input" />
          </Field>
          <Field label="Titular da conta">
            <input
              value={f.pix_holder}
              onChange={(e) => setF({ ...f, pix_holder: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        {f.pix_key && (
          <div className="p-4 bg-muted/40 rounded-lg text-center">
            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">
              QR Code PIX
            </div>
            <img
              alt="QR PIX"
              className="mx-auto w-40 h-40 bg-white p-2 rounded"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(f.pix_key)}`}
            />
            <div className="text-[11px] font-mono mt-2">{f.pix_key}</div>
          </div>
        )}
      </Section>

      <Section title="Dados Bancários">
        <p className="text-xs text-muted-foreground">
          Utilizados no contrato quando a forma de pagamento for "Dados Bancários".
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco">
            <input value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} className="input" />
          </Field>
          <Field label="Agência">
            <input
              value={f.bank_agency}
              onChange={(e) => setF({ ...f, bank_agency: e.target.value })}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Conta">
            <input
              value={f.bank_account}
              onChange={(e) => setF({ ...f, bank_account: e.target.value })}
              className="input"
            />
          </Field>
          <Field label="Titular">
            <input
              value={f.bank_holder}
              onChange={(e) => setF({ ...f, bank_holder: e.target.value })}
              className="input"
            />
          </Field>
        </div>
      </Section>

      <Section title="Modelos de mensagens (WhatsApp)">
        <p className="text-xs text-muted-foreground">
          Variáveis disponíveis: {"{cliente}"}, {"{valor}"}, {"{data}"}, {"{hora}"}, {"{pix}"}.
        </p>
        <Field label="Envio de orçamento">
          <textarea
            rows={2}
            value={f.wa_quote_template}
            onChange={(e) => setF({ ...f, wa_quote_template: e.target.value })}
            className="input min-h-[70px]"
          />
        </Field>
        <Field label="Lembrete de evento">
          <textarea
            rows={2}
            value={f.wa_reminder_template}
            onChange={(e) => setF({ ...f, wa_reminder_template: e.target.value })}
            className="input min-h-[70px]"
          />
        </Field>
        <Field label="Envio de PIX">
          <textarea
            rows={2}
            value={f.wa_pix_template}
            onChange={(e) => setF({ ...f, wa_pix_template: e.target.value })}
            className="input min-h-[70px]"
          />
        </Field>
      </Section>

      <Section title="Modelo padrão de contrato">
        <p className="text-xs text-muted-foreground mb-2">
          Variáveis: {"{cliente}"}, {"{buffet}"}, {"{data_evento}"}, {"{local_evento}"}, {"{convidados}"}, {"{valor}"},{" "}
          {"{pix}"}, {"{data_hoje}"}, {"{pacote}"}, {"{descricao_pacote}"}.
        </p>
        <textarea
          rows={10}
          value={f.contract_template}
          onChange={(e) => setF({ ...f, contract_template: e.target.value })}
          className="input min-h-[240px] font-mono text-xs"
        />
      </Section>

      <div className="flex justify-end">
        <button
          disabled={mut.isPending}
          onClick={() => mut.mutate()}
          className="h-10 px-6 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
        >
          Salvar configurações
        </button>
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

function LogoPreview({ value }: { value: string }) {
  const { data: url } = useLogoDisplayUrl(value);
  if (!url) return null;
  return (
    <div className="p-3 bg-muted/40 rounded-lg text-center">
      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-2">
        Prévia da logomarca
      </div>
      <img
        alt="Logomarca"
        src={url}
        className="mx-auto max-h-24 object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = "none";
        }}
      />
    </div>
  );
}
