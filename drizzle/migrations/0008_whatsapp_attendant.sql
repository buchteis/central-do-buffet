CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  instance_name text NOT NULL UNIQUE,
  webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'disconnected',
  phone_number text,
  profile_name text,
  qr_code text,
  qr_updated_at timestamptz,
  bot_enabled boolean NOT NULL DEFAULT false,
  last_event_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.whatsapp_instances TO authenticated;
GRANT UPDATE (bot_enabled) ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant reads own whatsapp instance" ON public.whatsapp_instances FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant toggles own whatsapp bot" ON public.whatsapp_instances FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  remote_jid text NOT NULL,
  phone text,
  contact_name text,
  bot_paused boolean NOT NULL DEFAULT false,
  needs_human boolean NOT NULL DEFAULT false,
  handoff_reason text,
  handoff_at timestamptz,
  lead_name text,
  event_type text,
  event_date text,
  guest_count integer,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, remote_jid)
);
CREATE INDEX whatsapp_conversations_tenant_last_idx ON public.whatsapp_conversations (tenant_id, last_message_at DESC);
GRANT SELECT, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT UPDATE (bot_paused, needs_human, unread_count) ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant reads own whatsapp conversations" ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant updates own whatsapp conversations" ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant deletes own whatsapp conversations" ON public.whatsapp_conversations FOR DELETE TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  direction text NOT NULL,
  sender text NOT NULL,
  body text NOT NULL DEFAULT '',
  wa_message_id text,
  reply_status text,
  reply_attempts integer NOT NULL DEFAULT 0,
  reply_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, wa_message_id)
);
CREATE INDEX whatsapp_messages_conv_idx ON public.whatsapp_messages (conversation_id, created_at);
CREATE INDEX whatsapp_messages_pending_idx ON public.whatsapp_messages (tenant_id, reply_status, created_at) WHERE reply_status IN ('pending', 'failed');
GRANT SELECT ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant reads own whatsapp messages" ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE TRIGGER whatsapp_instances_updated_at BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER whatsapp_conversations_updated_at BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();