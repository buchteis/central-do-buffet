import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Copy, Upload, CalendarDays, MapPin, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPublicTenantLogo } from "@/lib/public-logo.functions";
import { submitInstallmentReceipt } from "@/lib/installments.functions";
import { brl, formatDateBR } from "@/lib/format";
import { copyToClipboard } from "@/lib/clipboard";

export const Route = createFileRoute("/pagamento/$token")({
  head: () => ({
    meta: [
      { title: "Pagamento da sua parcela — Central do Buffet" },
      {
        name: "description",
        content: "Confira os dados do seu evento, pague pelo PIX e envie o comprovante em poucos segundos.",
      },
      { property: "og:title", content: "Pagamento da sua parcela" },
      { property: "og:description", content: "Dados do evento, valor, vencimento e chave PIX do buffet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicPaymentPage,
});

type Installment = {
  id: string;
  number: number;
  total_count: number;
  label: string | null;
  amount: number;
  due_date: string | null;
  status: "pendente" | "aguardando" | "pago";
  has_receipt: boolean;
  buffet_name: string | null;
  tenant_slug: string | null;
  pix_key: string | null;
  pix_holder: string | null;
  whatsapp: string | null;
  client_name: string | null;
  event_date: string | null;
  event_time: string | null;
  event_address: string | null;
  guest_count: number | null;
  event_total: number | null;
};

function PublicPaymentPage() {
  const { token } = Route.useParams();
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["public-installment", token],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_public_installment", { p_token: token });
      if (error) throw error;
      return (data ?? null) as Installment | null;
    },
  });

  const { data: logo } = useQuery({
    queryKey: ["public-logo", data?.tenant_slug],
    enabled: !!data?.tenant_slug,
    queryFn: () => getPublicTenantLogo({ data: { slug: data!.tenant_slug! } }),
    staleTime: 10 * 60_000,
  });

  const handleFile = async (file: File) => {
    setSending(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
        reader.readAsDataURL(file);
      });
      await submitInstallmentReceipt({
        data: {
          token,
          fileName: file.name,
          contentType: file.type || "image/png",
          base64,
          note: note.trim() || undefined,
        },
      });
      setSent(true);
      toast.success("Comprovante enviado! Aguarde a confirmação do buffet.");
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o comprovante.");
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return <Shell>{<p className="text-sm text-muted-foreground">Carregando cobrança...</p>}</Shell>;
  }

  if (!data) {
    return (
      <Shell>
        <h1 className="text-xl font-extrabold">Link inválido</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Este link de pagamento não existe mais. Fale com o buffet para receber um novo.
        </p>
      </Shell>
    );
  }

  const paid = data.status === "pago";
  const waiting = data.status === "aguardando" || sent;

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-6">
        {logo?.url ? (
          <img src={logo.url} alt={`Logomarca de ${data.buffet_name ?? "buffet"}`} className="h-12 object-contain" />
        ) : null}
        <div>
          <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Cobrança</div>
          <h1 className="text-xl font-extrabold leading-tight">{data.buffet_name ?? "Buffet"}</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-1">
        <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
          {data.label || `Parcela ${data.number} de ${data.total_count}`}
        </div>
        <div className="text-3xl font-black">{brl(Number(data.amount ?? 0))}</div>
        <div className="text-sm text-muted-foreground">
          Vencimento: <strong>{data.due_date ? formatDateBR(data.due_date) : "a combinar"}</strong>
        </div>
        {data.event_total ? (
          <div className="text-xs text-muted-foreground">Valor total do evento: {brl(Number(data.event_total))}</div>
        ) : null}
        <div className="pt-3">
          {paid ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-300">
              <CheckCircle2 className="size-3.5" /> Parcela paga
            </span>
          ) : waiting ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-500/15 text-amber-700 border border-amber-300">
              <Clock className="size-3.5" /> Pagamento aguardando confirmação
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-rose-500/15 text-rose-700 border border-rose-300">
              Em aberto
            </span>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mt-4 space-y-2">
        <h2 className="font-extrabold text-sm">Seu evento</h2>
        {data.client_name ? <Line label="Cliente" value={data.client_name} /> : null}
        <Line
          icon={CalendarDays}
          label="Data"
          value={`${data.event_date ? formatDateBR(data.event_date) : "—"}${data.event_time ? ` às ${String(data.event_time).slice(0, 5)}` : ""}`}
        />
        {data.event_address ? <Line icon={MapPin} label="Local" value={data.event_address} /> : null}
        {data.guest_count ? <Line icon={Users} label="Convidados" value={String(data.guest_count)} /> : null}
      </div>

      {!paid && (
        <div className="rounded-2xl border border-border bg-card p-5 mt-4 space-y-3">
          <h2 className="font-extrabold text-sm">Pague com PIX</h2>
          {data.pix_key ? (
            <>
              <div className="flex items-center gap-2">
                <input readOnly value={data.pix_key} className="flex-1 h-10 px-3 rounded-lg border border-border bg-muted/40 font-mono text-xs" />
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await copyToClipboard(data.pix_key!);
                    toast[ok ? "success" : "error"](ok ? "Chave PIX copiada!" : "Copie manualmente a chave.");
                  }}
                  className="h-10 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Copy className="size-3.5" /> Copiar
                </button>
              </div>
              {data.pix_holder ? (
                <p className="text-xs text-muted-foreground">Titular: {data.pix_holder}</p>
              ) : null}
              <img
                alt="QR Code PIX"
                className="mx-auto w-40 h-40 bg-white p-2 rounded"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.pix_key)}`}
              />
            </>
          ) : (
            <p className="text-xs text-muted-foreground">O buffet ainda não cadastrou a chave PIX. Fale com ele.</p>
          )}
        </div>
      )}

      {!paid && (
        <div className="rounded-2xl border border-border bg-card p-5 mt-4 space-y-3">
          <h2 className="font-extrabold text-sm">Enviar comprovante</h2>
          <p className="text-xs text-muted-foreground">
            Depois de pagar pelo seu banco, anexe o comprovante aqui (imagem ou PDF). O buffet confere e confirma o
            pagamento — o arquivo é excluído após a confirmação.
          </p>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação (opcional)"
            className="w-full p-3 rounded-lg border border-border bg-background text-sm"
          />
          <label className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold cursor-pointer">
            <Upload className="size-4" />
            {sending ? "Enviando..." : waiting ? "Enviar outro comprovante" : "Selecionar comprovante"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              disabled={sending}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) handleFile(file);
              }}
            />
          </label>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground text-center mt-6">
        Central do Buffet — pagamento seguro direto com seu buffet.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto">{children}</div>
    </div>
  );
}

function Line({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {Icon ? <Icon className="size-3.5 text-muted-foreground" /> : null}
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
