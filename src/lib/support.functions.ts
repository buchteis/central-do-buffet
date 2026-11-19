import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canAccessSupport, supportMessageInput } from "./support-access";

export const getSupportInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [role, inbox] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
      context.supabase.rpc("support_inbox"),
    ]);
    if (role.error) throw new Error("Não foi possível verificar o acesso ao suporte.");
    if (inbox.error) throw new Error("Não foi possível carregar as conversas de suporte.");
    return { userId: context.userId, isAdmin: role.data === true, threads: inbox.data ?? [] };
  });

const historyInput = z.object({
  tenantId: z.string().uuid(),
  before: z.object({ createdAt: z.string().datetime(), id: z.string().uuid() }).nullable(),
});

export const getSupportMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof historyInput>) => historyInput.parse(input))
  .handler(async ({ context, data }) => {
    // RLS applies to every history page, including direct calls with another tenant ID.
    let query = context.supabase.from("support_messages")
      .select("id, tenant_id, sender_id, sender_role, body, created_at")
      .eq("tenant_id", data.tenantId);
    if (data.before) {
      query = query.or(`created_at.lt.${data.before.createdAt},and(created_at.eq.${data.before.createdAt},id.lt.${data.before.id})`);
    }
    const result = await query.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(50);
    if (result.error) throw new Error("Não foi possível carregar as mensagens.");
    return result.data ?? [];
  });

export const sendSupportMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.infer<typeof supportMessageInput>) => supportMessageInput.parse(input))
  .handler(async ({ context, data }) => {
    const [role, tenant] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
      context.supabase.from("tenants").select("id, owner_id").eq("id", data.tenantId).maybeSingle(),
    ]);
    if (role.error || tenant.error) throw new Error("Não foi possível verificar o acesso ao suporte.");
    const isAdmin = role.data === true;
    if (!tenant.data || !canAccessSupport(context.userId, tenant.data.owner_id, isAdmin)) {
      throw new Error("Você não tem acesso a esta conversa.");
    }
    const result = await context.supabase.from("support_messages").insert({
      tenant_id: tenant.data.id,
      sender_id: context.userId,
      sender_role: isAdmin ? "suporte" : "buffet",
      body: data.body,
    }).select("id, tenant_id, sender_id, sender_role, body, created_at").single();
    if (result.error) throw new Error("Não foi possível enviar. Sua mensagem foi mantida para tentar novamente.");
    return result.data;
  });