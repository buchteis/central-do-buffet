CREATE OR REPLACE FUNCTION public.sync_quote_unit_items_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it JSONB;
  pid UUID;
  qty NUMERIC;
  tid UUID;
  is_closed BOOLEAN;
  was_closed BOOLEAN;
BEGIN
  is_closed := NEW.status::text IN ('fechado','aprovado');
  was_closed := NEW.unit_items_consumed_at IS NOT NULL;

  IF is_closed AND NOT was_closed THEN
    FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.extras->'unit_items', '[]'::jsonb)) LOOP
      pid := NULLIF(it->>'product_id','')::uuid;
      qty := COALESCE((it->>'qty')::numeric, 0);
      IF pid IS NOT NULL AND qty > 0 THEN
        SELECT tenant_id INTO tid FROM public.stock_products WHERE id = pid;
        IF tid IS NOT NULL THEN
          INSERT INTO public.stock_movements(tenant_id, product_id, kind, quantity, notes)
          VALUES (tid, pid, 'reserve', qty, 'reserva item unitário — orçamento agendado');
        END IF;
      END IF;
    END LOOP;
    NEW.unit_items_consumed_at := now();
  ELSIF NOT is_closed AND was_closed THEN
    FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(NEW.extras->'unit_items', '[]'::jsonb)) LOOP
      pid := NULLIF(it->>'product_id','')::uuid;
      qty := COALESCE((it->>'qty')::numeric, 0);
      IF pid IS NOT NULL AND qty > 0 THEN
        SELECT tenant_id INTO tid FROM public.stock_products WHERE id = pid;
        IF tid IS NOT NULL THEN
          INSERT INTO public.stock_movements(tenant_id, product_id, kind, quantity, notes)
          VALUES (tid, pid, 'release', qty, 'liberação item unitário — orçamento reaberto');
        END IF;
      END IF;
    END LOOP;
    NEW.unit_items_consumed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;