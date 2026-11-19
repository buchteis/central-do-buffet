CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('buffet', 'suporte')),
  body text NOT NULL CHECK (length(btrim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_owner_or_admin_read ON public.support_messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid()) OR public.has_role(auth.uid(), 'super_admin'));
CREATE POLICY support_verified_sender_insert ON public.support_messages FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid() AND ((sender_role = 'buffet' AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = tenant_id AND t.owner_id = auth.uid()) AND NOT public.has_role(auth.uid(), 'super_admin')) OR (sender_role = 'suporte' AND public.has_role(auth.uid(), 'super_admin'))));
CREATE INDEX support_messages_tenant_recent_idx ON public.support_messages (tenant_id, created_at DESC, id DESC);
CREATE OR REPLACE FUNCTION public.support_inbox()
RETURNS TABLE (tenant_id uuid, name text, owner_id uuid, last_body text, last_message_at timestamptz, last_sender text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
SELECT t.id, t.name, t.owner_id, m.body, m.created_at, m.sender_role
FROM public.tenants t
LEFT JOIN LATERAL (
  SELECT s.body, s.created_at, s.sender_role FROM public.support_messages s
  WHERE s.tenant_id = t.id ORDER BY s.created_at DESC, s.id DESC LIMIT 1
) m ON true
WHERE t.owner_id = auth.uid() OR public.has_role(auth.uid(), 'super_admin')
ORDER BY m.created_at DESC NULLS LAST, t.name ASC;
$$;
REVOKE ALL ON FUNCTION public.support_inbox() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_inbox() TO authenticated, service_role;