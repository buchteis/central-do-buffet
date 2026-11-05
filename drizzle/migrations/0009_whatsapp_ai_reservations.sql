ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS budget text;

CREATE TABLE public.whatsapp_pre_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text NOT NULL,
  event_date date NOT NULL,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmada', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX whatsapp_pre_reservations_active_date_idx
  ON public.whatsapp_pre_reservations (tenant_id, event_date)
  WHERE status IN ('pendente', 'confirmada');
CREATE INDEX whatsapp_pre_reservations_tenant_date_idx
  ON public.whatsapp_pre_reservations (tenant_id, event_date);

GRANT SELECT, UPDATE (status) ON public.whatsapp_pre_reservations TO authenticated;
GRANT ALL ON public.whatsapp_pre_reservations TO service_role;
ALTER TABLE public.whatsapp_pre_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant reads own WhatsApp pre-reservations"
  ON public.whatsapp_pre_reservations FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());
CREATE POLICY "Tenant confirms own WhatsApp pre-reservations"
  ON public.whatsapp_pre_reservations FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE OR REPLACE FUNCTION public.check_whatsapp_pre_reservation_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'confirmada' AND OLD.status IS DISTINCT FROM 'confirmada' THEN
    IF EXISTS (
      SELECT 1
      FROM public.events
      WHERE tenant_id = NEW.tenant_id
        AND event_date = NEW.event_date
        AND status <> 'cancelado'
    ) THEN
      RAISE EXCEPTION 'A data já possui um evento agendado.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER whatsapp_pre_reservations_check_availability
  BEFORE UPDATE OF status ON public.whatsapp_pre_reservations
  FOR EACH ROW EXECUTE FUNCTION public.check_whatsapp_pre_reservation_availability();

CREATE TRIGGER whatsapp_pre_reservations_updated_at
  BEFORE UPDATE ON public.whatsapp_pre_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
