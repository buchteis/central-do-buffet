CREATE OR REPLACE FUNCTION public.on_quote_closed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_event_status event_status;
BEGIN
  -- Cancelamento/recusa do orçamento: cancela o evento vinculado (devolve estoque)
  IF NEW.status IN ('cancelado','recusado') THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      UPDATE public.events
        SET status = 'cancelado'::event_status, updated_at = now()
        WHERE quote_id = NEW.id AND status IS DISTINCT FROM 'cancelado'::event_status;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('em_andamento','fechado') THEN
    RETURN NEW;
  END IF;

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
END;
$$;