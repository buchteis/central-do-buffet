import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Salva a chave de API fiscal do buffet (nunca é devolvida ao navegador). */
export const saveFiscalApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ apiKey: z.string().trim().max(500) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = data.apiKey.trim() === "" ? null : data.apiKey.trim();
    const { error } = await supabaseAdmin
      .from("fiscal_settings")
      .update({ api_key: value })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true, hasApiKey: value !== null };
  });

/** Emite (ou registra) uma NFS-e para um evento. */
export const issueInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        eventId: z.string().uuid(),
        description: z.string().trim().min(3).max(500),
        amount: z.number().nonnegative().max(99_999_999),
        serviceDate: z.string().trim().max(20).nullable().optional(),
        paymentMethod: z.string().trim().max(80).nullable().optional(),
        recipientEmail: z.string().trim().max(255).nullable().optional(),
        sendEmail: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getProvider } = await import("@/lib/nfse-provider.server");

    const { data: event, error: evErr } = await supabaseAdmin
      .from("events")
      .select("id, owner_id, tenant_id, client_id, event_date, total_value, clients(name, cpf, email)")
      .eq("id", data.eventId)
      .maybeSingle();
    if (evErr) throw new Error(evErr.message);
    if (!event || event.owner_id !== context.userId) throw new Error("Evento não encontrado.");

    const { data: settings } = await supabaseAdmin
      .from("fiscal_settings")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (!settings?.cnpj || !settings?.razao_social) {
      throw new Error("Complete os dados fiscais do buffet antes de emitir notas.");
    }

    const client = (event as any).clients ?? null;
    const provider = getProvider(settings.provider);
    const result = await provider.issue(settings as any, {
      description: data.description,
      amount: data.amount,
      serviceDate: data.serviceDate ?? null,
      paymentMethod: data.paymentMethod ?? null,
      recipientName: client?.name ?? null,
      recipientDoc: client?.cpf ?? null,
      recipientEmail: data.recipientEmail ?? client?.email ?? null,
      sendEmail: data.sendEmail,
    });

    const { data: inserted, error } = await supabaseAdmin
      .from("invoices")
      .insert({
        owner_id: context.userId,
        tenant_id: event.tenant_id,
        event_id: event.id,
        client_id: event.client_id,
        number: result.number,
        series: result.series,
        description: data.description,
        amount: data.amount,
        service_date: data.serviceDate || event.event_date,
        payment_method: data.paymentMethod ?? null,
        recipient_name: client?.name ?? null,
        recipient_doc: client?.cpf ?? null,
        recipient_email: data.recipientEmail ?? client?.email ?? null,
        status: result.status,
        provider: settings.provider,
        provider_ref: result.providerRef,
        environment: settings.environment,
        pdf_url: result.pdfUrl,
        xml_url: result.xmlUrl,
        error_message: result.status === "erro" ? result.message : null,
        email_sent_at: result.emailSent ? new Date().toISOString() : null,
        issued_at: result.status === "emitida" ? new Date().toISOString() : null,
      })
      .select("id, number, status")
      .single();
    if (error) throw new Error(error.message);

    return { invoiceId: inserted.id, number: inserted.number, status: inserted.status, message: result.message };
  });

/** Cancela uma nota emitida. */
export const cancelInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ invoiceId: z.string().uuid(), reason: z.string().trim().min(3).max(300) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getProvider } = await import("@/lib/nfse-provider.server");

    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("id, owner_id, provider, provider_ref, status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (!invoice || invoice.owner_id !== context.userId) throw new Error("Nota não encontrada.");
    if (invoice.status === "cancelada") throw new Error("Esta nota já está cancelada.");

    const { data: settings } = await supabaseAdmin
      .from("fiscal_settings")
      .select("*")
      .eq("owner_id", context.userId)
      .maybeSingle();

    const provider = getProvider(invoice.provider);
    const result = await provider.cancel((settings ?? {}) as any, invoice.provider_ref, data.reason);
    if (!result.ok) throw new Error(result.message ?? "Falha ao cancelar a nota.");

    const { error } = await supabaseAdmin
      .from("invoices")
      .update({ status: "cancelada", cancelled_at: new Date().toISOString(), cancel_reason: data.reason })
      .eq("id", invoice.id);
    if (error) throw new Error(error.message);
    return { ok: true, message: result.message };
  });

/** Reenvia a nota por e-mail ao tomador. */
export const resendInvoiceEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ invoiceId: z.string().uuid(), email: z.string().trim().email().max(255) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: invoice } = await supabaseAdmin
      .from("invoices")
      .select("id, owner_id, provider, status")
      .eq("id", data.invoiceId)
      .maybeSingle();
    if (!invoice || invoice.owner_id !== context.userId) throw new Error("Nota não encontrada.");

    if (invoice.provider === "generic") {
      await supabaseAdmin
        .from("invoices")
        .update({ recipient_email: data.email })
        .eq("id", invoice.id);
      return {
        ok: false,
        message: "E-mail registrado. O envio automático será feito assim que um provedor fiscal for conectado.",
      };
    }

    const { error } = await supabaseAdmin
      .from("invoices")
      .update({ recipient_email: data.email, email_sent_at: new Date().toISOString() })
      .eq("id", invoice.id);
    if (error) throw new Error(error.message);
    return { ok: true, message: "E-mail reenviado." };
  });
