-- 1) Remove o controle de estoque feito no orçamento (duplicava com o evento)
DROP TRIGGER IF EXISTS trg_quotes_unit_items_stock ON public.quotes;

-- Libera reservas presas criadas pelo fluxo antigo (sem event_id)
DO $$
DECLARE q RECORD; it JSONB; pid UUID; qty NUMERIC; tid UUID;
BEGIN
  FOR q IN SELECT id, extras FROM public.quotes WHERE unit_items_consumed_at IS NOT NULL LOOP
    FOR it IN SELECT * FROM jsonb_array_elements(COALESCE(q.extras->'unit_items','[]'::jsonb)) LOOP
      pid := NULLIF(it->>'product_id','')::uuid;
      qty := COALESCE((it->>'qty')::numeric, 0);
      IF pid IS NOT NULL AND qty > 0 THEN
        SELECT tenant_id INTO tid FROM public.stock_products WHERE id = pid;
        IF tid IS NOT NULL THEN
          INSERT INTO public.stock_movements(tenant_id, product_id, kind, quantity, notes)
          VALUES (tid, pid, 'release', qty, 'migração: reserva movida para o evento');
        END IF;
      END IF;
    END LOOP;
  END LOOP;
  UPDATE public.quotes SET unit_items_consumed_at = NULL WHERE unit_items_consumed_at IS NOT NULL;
END $$;

-- 2) Novo sync_event_stock: pacote(s) + itens adicionais com produto de estoque
CREATE OR REPLACE FUNCTION public.sync_event_stock(_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  ev RECORD;
  target_phase TEXT;
  guests INT;
  r RECORD;
  desired NUMERIC;
  cur_res NUMERIC;
  cur_con NUMERIC;
  delta NUMERIC;
  q_extras JSONB;
BEGIN
  SELECT e.id, e.tenant_id, e.status::text AS status, e.package_id, e.guest_count, e.quote_id
    INTO ev FROM public.events e WHERE e.id = _event_id;
  IF ev.id IS NULL THEN RETURN; END IF;

  guests := COALESCE(ev.guest_count, 0);

  SELECT extras INTO q_extras FROM public.quotes WHERE id = ev.quote_id;
  q_extras := COALESCE(q_extras, '{}'::jsonb);

  IF ev.status IN ('agendado','em_andamento','pagamento_parcial') THEN
    target_phase := 'reserved';
  ELSIF ev.status IN ('pago','realizado','concluido') THEN
    target_phase := 'consumed';
  ELSIF ev.status = 'cancelado' THEN
    target_phase := 'released';
  ELSE
    RETURN;
  END IF;

  FOR r IN
    WITH pkg_ids AS (
      SELECT ev.package_id AS package_id WHERE ev.package_id IS NOT NULL
      UNION
      SELECT NULLIF(p->>'package_id','')::uuid
        FROM jsonb_array_elements(COALESCE(q_extras->'packages','[]'::jsonb)) p
       WHERE NULLIF(p->>'package_id','') IS NOT NULL
    ),
    plan_pkg AS (
      SELECT pp.product_id,
             SUM(pp.qty_per_person * guests + pp.qty_fixed)::NUMERIC AS desired_qty
        FROM public.package_products pp
        JOIN pkg_ids k ON k.package_id = pp.package_id
       GROUP BY pp.product_id
    ),
    plan_unit AS (
      SELECT sp.id AS product_id,
             SUM(COALESCE((u->>'qty')::numeric, 0)) AS desired_qty
        FROM jsonb_array_elements(COALESCE(q_extras->'unit_items','[]'::jsonb)) u
        JOIN public.stock_products sp ON sp.id = NULLIF(u->>'product_id','')::uuid
       WHERE COALESCE((u->>'qty')::numeric, 0) > 0
       GROUP BY 1
    ),
    plan AS (
      SELECT x.product_id, SUM(x.desired_qty) AS desired_qty
        FROM (SELECT * FROM plan_pkg UNION ALL SELECT * FROM plan_unit) x
        JOIN public.stock_products sp2 ON sp2.id = x.product_id
       GROUP BY x.product_id
    ),
    alloc AS (
      SELECT product_id FROM public.event_stock_allocations WHERE event_id = _event_id
    )
    SELECT COALESCE(pl.product_id, al.product_id) AS product_id,
           COALESCE(pl.desired_qty, 0) AS desired_qty
      FROM plan pl FULL OUTER JOIN alloc al ON al.product_id = pl.product_id
  LOOP
    SELECT reserved_qty, consumed_qty INTO cur_res, cur_con
      FROM public.event_stock_allocations
     WHERE event_id = _event_id AND product_id = r.product_id;
    cur_res := COALESCE(cur_res, 0);
    cur_con := COALESCE(cur_con, 0);
    desired := r.desired_qty;

    IF target_phase = 'reserved' THEN
      delta := GREATEST(desired - cur_con, 0) - cur_res;
      IF delta > 0 THEN
        INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
          VALUES (ev.tenant_id, r.product_id, _event_id, 'reserve', delta, 'auto-sync');
        cur_res := cur_res + delta;
      ELSIF delta < 0 THEN
        INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
          VALUES (ev.tenant_id, r.product_id, _event_id, 'release', -delta, 'auto-sync');
        cur_res := cur_res + delta;
      END IF;

    ELSIF target_phase = 'consumed' THEN
      IF cur_res > 0 THEN
        DECLARE
          convert_qty NUMERIC := LEAST(cur_res, GREATEST(desired - cur_con, 0));
          release_extra NUMERIC := cur_res - LEAST(cur_res, GREATEST(desired - cur_con, 0));
        BEGIN
          IF convert_qty > 0 THEN
            INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
              VALUES (ev.tenant_id, r.product_id, _event_id, 'consume', convert_qty, 'auto-sync');
            cur_con := cur_con + convert_qty;
            cur_res := cur_res - convert_qty;
          END IF;
          IF release_extra > 0 THEN
            INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
              VALUES (ev.tenant_id, r.product_id, _event_id, 'release', release_extra, 'auto-sync');
            cur_res := cur_res - release_extra;
          END IF;
        END;
      END IF;
      IF desired > cur_con THEN
        DECLARE short NUMERIC := desired - cur_con;
        BEGIN
          INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
            VALUES (ev.tenant_id, r.product_id, _event_id, 'reserve', short, 'auto-sync');
          INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
            VALUES (ev.tenant_id, r.product_id, _event_id, 'consume', short, 'auto-sync');
          cur_con := cur_con + short;
        END;
      END IF;

    ELSIF target_phase = 'released' THEN
      IF cur_res > 0 THEN
        INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
          VALUES (ev.tenant_id, r.product_id, _event_id, 'release', cur_res, 'auto-sync (cancelamento)');
        cur_res := 0;
      END IF;
    END IF;

    IF cur_res = 0 AND cur_con = 0 THEN
      DELETE FROM public.event_stock_allocations WHERE event_id = _event_id AND product_id = r.product_id;
    ELSE
      INSERT INTO public.event_stock_allocations(event_id, product_id, reserved_qty, consumed_qty, updated_at)
        VALUES (_event_id, r.product_id, cur_res, cur_con, now())
        ON CONFLICT (event_id, product_id) DO UPDATE
          SET reserved_qty = EXCLUDED.reserved_qty,
              consumed_qty = EXCLUDED.consumed_qty,
              updated_at = now();
    END IF;
  END LOOP;
END; $function$;

-- 3) Alterações no orçamento (itens adicionais) recalculam o estoque do evento
CREATE OR REPLACE FUNCTION public.trg_quotes_resync_event_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE eid UUID;
BEGIN
  IF NEW.extras IS DISTINCT FROM OLD.extras THEN
    FOR eid IN SELECT id FROM public.events WHERE quote_id = NEW.id LOOP
      PERFORM public.sync_event_stock(eid);
    END LOOP;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_quotes_resync_event_stock ON public.quotes;
CREATE TRIGGER trg_quotes_resync_event_stock
AFTER UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.trg_quotes_resync_event_stock();

-- 4) Recalcula eventos ativos com a nova regra
DO $$
DECLARE eid UUID;
BEGIN
  FOR eid IN SELECT id FROM public.events WHERE status::text IN ('agendado','em_andamento','pagamento_parcial','pago','realizado','concluido') LOOP
    PERFORM public.sync_event_stock(eid);
  END LOOP;
END $$;