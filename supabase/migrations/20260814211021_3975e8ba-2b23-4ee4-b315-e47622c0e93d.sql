CREATE TABLE public.payment_installments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  label text,
  number integer NOT NULL DEFAULT 1,
  total_count integer NOT NULL DEFAULT 1,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'pendente',
  token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  receipt_path text,
  receipt_uploaded_at timestamp with time zone,
  paid_at timestamp with time zone,
  payer_note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT payment_installments_status_check CHECK (status IN ('pendente','aguardando','pago')),
  CONSTRAINT payment_installments_token_key UNIQUE (token)
);

CREATE INDEX payment_installments_tenant_idx ON public.payment_installments(tenant_id);
CREATE INDEX payment_installments_event_idx ON public.payment_installments(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_installments TO authenticated;
GRANT ALL ON public.payment_installments TO service_role;

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own installments"
  ON public.payment_installments FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (owner_id = auth.uid() OR tenant_id = public.current_tenant_id() OR public.has_role(auth.uid(),'super_admin'));

CREATE TRIGGER payment_installments_set_tenant
  BEFORE INSERT ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_owner();

CREATE TRIGGER payment_installments_updated
  BEFORE UPDATE ON public.payment_installments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.buffet_settings
  ADD COLUMN IF NOT EXISTS installments_default_count integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS installments_due_day integer,
  ADD COLUMN IF NOT EXISTS wa_installment_template text;

CREATE OR REPLACE FUNCTION public.get_public_installment(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  SELECT pi.id, pi.number, pi.total_count, pi.label, pi.amount, pi.due_date, pi.status,
         pi.receipt_path,
         t.name AS tenant_name, t.slug AS tenant_slug,
         bs.pix_key, bs.pix_holder, bs.business_name, bs.whatsapp,
         e.event_date, e.event_time, e.event_address, e.guest_count, e.total_value AS event_total,
         c.name AS client_name
    INTO r
    FROM public.payment_installments pi
    JOIN public.tenants t ON t.id = pi.tenant_id
    LEFT JOIN public.buffet_settings bs ON bs.tenant_id = pi.tenant_id
    LEFT JOIN public.events e ON e.id = pi.event_id
    LEFT JOIN public.clients c ON c.id = pi.client_id
   WHERE pi.token = p_token
   LIMIT 1;

  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', r.id,
    'number', r.number,
    'total_count', r.total_count,
    'label', r.label,
    'amount', r.amount,
    'due_date', r.due_date,
    'status', r.status,
    'has_receipt', (r.receipt_path IS NOT NULL),
    'buffet_name', COALESCE(NULLIF(r.business_name,''), r.tenant_name),
    'tenant_slug', r.tenant_slug,
    'pix_key', r.pix_key,
    'pix_holder', r.pix_holder,
    'whatsapp', r.whatsapp,
    'client_name', r.client_name,
    'event_date', r.event_date,
    'event_time', r.event_time,
    'event_address', r.event_address,
    'guest_count', r.guest_count,
    'event_total', r.event_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_installment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_installment(text) TO anon, authenticated, service_role;