
-- Add paid flag to quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false;

-- Rebuild trigger: sync quote -> event when status is em_andamento or fechado, and reflect paid state
CREATE OR REPLACE FUNCTION public.on_quote_closed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id uuid;
  v_event_status event_status;
BEGIN
  IF NEW.status NOT IN ('em_andamento','fechado') THEN
    RETURN NEW;
  END IF;

  -- Determine desired event status
  IF NEW.status = 'fechado' AND NEW.paid = true THEN
    v_event_status := 'pago'::event_status;
  ELSIF NEW.status = 'fechado' THEN
    v_event_status := 'agendado'::event_status;
  ELSE
    v_event_status := 'em_andamento'::event_status;
  END IF;

  SELECT id INTO v_event_id FROM public.events WHERE quote_id = NEW.id LIMIT 1;

  IF v_event_id IS NULL THEN
    INSERT INTO public.events (
      owner_id, tenant_id, client_id, quote_id, package_id,
      event_date, event_time, event_address, guest_count,
      total_value, status, notes
    ) VALUES (
      NEW.owner_id, NEW.tenant_id, NEW.client_id, NEW.id, NEW.package_id,
      NEW.event_date, NEW.event_time, NEW.event_address,
      COALESCE(NEW.adults,0)+COALESCE(NEW.children_7_10,0)+COALESCE(NEW.children_0_6,0),
      NEW.total_value, v_event_status, NEW.notes
    );
  ELSE
    UPDATE public.events SET
      event_date = NEW.event_date,
      event_time = NEW.event_time,
      event_address = NEW.event_address,
      guest_count = COALESCE(NEW.adults,0)+COALESCE(NEW.children_7_10,0)+COALESCE(NEW.children_0_6,0),
      total_value = NEW.total_value,
      package_id = NEW.package_id,
      status = v_event_status,
      notes = NEW.notes,
      updated_at = now()
    WHERE id = v_event_id;
  END IF;

  RETURN NEW;
END; $function$;

-- Ensure trigger fires on status OR paid change
DROP TRIGGER IF EXISTS on_quote_closed_trg ON public.quotes;
CREATE TRIGGER on_quote_closed_trg
AFTER INSERT OR UPDATE OF status, paid ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.on_quote_closed();

-- Ensure quotes + events are on the realtime publication
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='quotes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
END $$;
