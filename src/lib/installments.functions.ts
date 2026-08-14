import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "payment-receipts";

/** Cliente envia o comprovante pelo link público (sem login). */
export const submitInstallmentReceipt = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: z.string().min(8).max(120),
        fileName: z.string().min(1).max(200),
        contentType: z.string().min(3).max(120),
        base64: z.string().min(10).max(9_000_000),
        note: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("payment_installments")
      .select("id, tenant_id, status, receipt_path")
      .eq("token", data.token)
      .maybeSingle();

    if (!row) throw new Error("Cobrança não encontrada.");
    if (row.status === "pago") throw new Error("Esta parcela já está quitada.");

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "application/pdf"];
    if (!allowed.includes(data.contentType)) throw new Error("Envie uma imagem (PNG/JPG) ou PDF.");

    const bytes = Buffer.from(data.base64, "base64");
    if (bytes.byteLength > 6 * 1024 * 1024) throw new Error("Arquivo muito grande (máx. 6MB).");

    const ext = (data.fileName.split(".").pop() ?? "png").toLowerCase().slice(0, 5);
    const path = `${row.tenant_id}/${row.id}-${Date.now()}.${ext}`;

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (upErr) throw new Error(upErr.message);

    if (row.receipt_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([row.receipt_path]);
    }

    const { error } = await supabaseAdmin
      .from("payment_installments")
      .update({
        receipt_path: path,
        receipt_uploaded_at: new Date().toISOString(),
        status: "aguardando",
        payer_note: data.note ?? null,
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

/** Buffet visualiza o comprovante enviado (URL temporária). */
export const getInstallmentReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payment_installments")
      .select("receipt_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.receipt_path) return { url: "" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(row.receipt_path, 300);
    return { url: signed?.signedUrl ?? "" };
  });

/** Buffet confirma o pagamento: parcela = PAGA e o comprovante é excluído da base. */
export const confirmInstallmentPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payment_installments")
      .select("id, receipt_path, event_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Parcela não encontrada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (row.receipt_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([row.receipt_path]);
    }

    const { error: updErr } = await context.supabase
      .from("payment_installments")
      .update({
        status: "pago",
        paid_at: new Date().toISOString(),
        receipt_path: null,
        receipt_uploaded_at: null,
      })
      .eq("id", row.id);
    if (updErr) throw new Error(updErr.message);

    let eventPaid = false;
    if (row.event_id) {
      const { data: siblings } = await context.supabase
        .from("payment_installments")
        .select("status")
        .eq("event_id", row.event_id);
      const all = siblings ?? [];
      if (all.length > 0 && all.every((s: { status: string }) => s.status === "pago")) {
        await context.supabase.from("events").update({ status: "pago" }).eq("id", row.event_id);
        eventPaid = true;
      }
    }

    return { ok: true, eventPaid };
  });

/** Buffet recusa o comprovante: volta para pendente e apaga o arquivo. */
export const rejectInstallmentReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("payment_installments")
      .select("id, receipt_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Parcela não encontrada.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (row.receipt_path) {
      await supabaseAdmin.storage.from(BUCKET).remove([row.receipt_path]);
    }

    const { error: updErr } = await context.supabase
      .from("payment_installments")
      .update({ status: "pendente", receipt_path: null, receipt_uploaded_at: null })
      .eq("id", row.id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });
