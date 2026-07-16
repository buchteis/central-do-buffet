
-- =========================================================
-- STOCK MODULE
-- =========================================================

-- Categories
CREATE TABLE public.stock_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_categories TO authenticated;
GRANT ALL ON public.stock_categories TO service_role;
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tenant categories" ON public.stock_categories FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_stock_categories_updated BEFORE UPDATE ON public.stock_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Products
CREATE TABLE public.stock_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.stock_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'un',
  physical_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  min_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_products_physical_nonneg CHECK (physical_qty >= 0),
  CONSTRAINT stock_products_reserved_nonneg CHECK (reserved_qty >= 0),
  CONSTRAINT stock_products_available_nonneg CHECK (reserved_qty <= physical_qty)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_products TO authenticated;
GRANT ALL ON public.stock_products TO service_role;
ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tenant products" ON public.stock_products FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER trg_stock_products_updated BEFORE UPDATE ON public.stock_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_stock_products_tenant ON public.stock_products(tenant_id);

-- Package -> products
CREATE TABLE public.package_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  qty_per_person NUMERIC(14,3) NOT NULL DEFAULT 0,
  qty_fixed NUMERIC(14,3) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (package_id, product_id),
  CONSTRAINT package_products_nonneg CHECK (qty_per_person >= 0 AND qty_fixed >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_products TO authenticated;
GRANT ALL ON public.package_products TO service_role;
ALTER TABLE public.package_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tenant package_products" ON public.package_products FOR ALL
  USING (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_id AND p.owner_id = auth.uid()));

-- Movements
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reserve','release','consume','return','adjust_in','adjust_out','purchase')),
  quantity NUMERIC(14,3) NOT NULL CHECK (quantity > 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tenant movements" ON public.stock_movements FOR ALL
  USING (EXISTS (SELECT 1 FROM public.stock_products p WHERE p.id = product_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stock_products p WHERE p.id = product_id AND p.owner_id = auth.uid()));
CREATE INDEX idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_event ON public.stock_movements(event_id);

-- Event allocations (state per event/product)
CREATE TABLE public.event_stock_allocations (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.stock_products(id) ON DELETE CASCADE,
  reserved_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  consumed_qty NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, product_id),
  CONSTRAINT esa_nonneg CHECK (reserved_qty >= 0 AND consumed_qty >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_stock_allocations TO authenticated;
GRANT ALL ON public.event_stock_allocations TO service_role;
ALTER TABLE public.event_stock_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tenant esa" ON public.event_stock_allocations FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.owner_id = auth.uid()));

-- =========================================================
-- Trigger: apply movements to product balances
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'reserve' THEN
    UPDATE public.stock_products SET reserved_qty = reserved_qty + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.kind = 'release' THEN
    UPDATE public.stock_products SET reserved_qty = reserved_qty - NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.kind = 'consume' THEN
    UPDATE public.stock_products SET reserved_qty = reserved_qty - NEW.quantity,
                                     physical_qty = physical_qty - NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.kind = 'return' THEN
    UPDATE public.stock_products SET physical_qty = physical_qty + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.kind IN ('adjust_in','purchase') THEN
    UPDATE public.stock_products SET physical_qty = physical_qty + NEW.quantity WHERE id = NEW.product_id;
  ELSIF NEW.kind = 'adjust_out' THEN
    UPDATE public.stock_products SET physical_qty = physical_qty - NEW.quantity WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_apply_stock_movement AFTER INSERT ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- =========================================================
-- Core sync: reconcile event allocations against target plan
-- mode = 'reserved' | 'consumed' | 'released' | 'noop'
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_event_stock(_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev RECORD;
  target_phase TEXT;  -- 'reserved' | 'consumed' | 'released'
  guests INT;
  r RECORD;
  desired NUMERIC;
  cur_res NUMERIC;
  cur_con NUMERIC;
  delta NUMERIC;
BEGIN
  SELECT id, tenant_id, status::text AS status, package_id, guest_count
    INTO ev FROM public.events WHERE id = _event_id;
  IF ev.id IS NULL THEN RETURN; END IF;

  guests := COALESCE(ev.guest_count, 0);

  IF ev.status = 'agendado' THEN
    target_phase := 'reserved';
  ELSIF ev.status IN ('em_andamento','pago','realizado','concluido') THEN
    target_phase := 'consumed';
  ELSIF ev.status = 'cancelado' THEN
    -- Only auto-release the reserved portion. Consumed stays until explicit return.
    target_phase := 'released';
  ELSE
    RETURN;
  END IF;

  -- Build set of products = union(existing allocations, current package plan)
  FOR r IN
    WITH plan AS (
      SELECT pp.product_id,
             (pp.qty_per_person * guests + pp.qty_fixed)::NUMERIC AS desired_qty
        FROM public.package_products pp
       WHERE ev.package_id IS NOT NULL AND pp.package_id = ev.package_id
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
      -- If we had consumed rows and event moves back to reserved (rare), leave consumed alone.
      -- Adjust reservation to desired - already-consumed.
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
      -- We want total (reserved+consumed) semantics collapsed to consumed.
      -- Step 1: release any reservation first
      IF cur_res > 0 THEN
        -- convert reservations directly to consumption up to desired - cur_con
        DECLARE
          convert_qty NUMERIC := LEAST(cur_res, GREATEST(desired - cur_con, 0));
          release_extra NUMERIC := cur_res - convert_qty;
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
      -- Step 2: if still short vs desired, consume from physical
      IF desired > cur_con THEN
        DECLARE short NUMERIC := desired - cur_con;
        BEGIN
          -- Need a reserve+consume in sequence to satisfy check constraints
          INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
            VALUES (ev.tenant_id, r.product_id, _event_id, 'reserve', short, 'auto-sync');
          INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
            VALUES (ev.tenant_id, r.product_id, _event_id, 'consume', short, 'auto-sync');
          cur_con := cur_con + short;
        END;
      END IF;
      -- Note: reducing already-consumed requires explicit return action.

    ELSIF target_phase = 'released' THEN
      IF cur_res > 0 THEN
        INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
          VALUES (ev.tenant_id, r.product_id, _event_id, 'release', cur_res, 'auto-sync (cancelamento)');
        cur_res := 0;
      END IF;
    END IF;

    -- Upsert allocation snapshot
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
END; $$;

GRANT EXECUTE ON FUNCTION public.sync_event_stock(UUID) TO authenticated;

-- =========================================================
-- Explicit return function (post-consume return after cancellation)
-- =========================================================
CREATE OR REPLACE FUNCTION public.return_event_stock(_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a RECORD;
  tid UUID;
BEGIN
  SELECT tenant_id INTO tid FROM public.events WHERE id = _event_id;
  IF tid IS NULL THEN RETURN; END IF;
  FOR a IN SELECT product_id, consumed_qty, reserved_qty FROM public.event_stock_allocations WHERE event_id = _event_id LOOP
    IF a.reserved_qty > 0 THEN
      INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
        VALUES (tid, a.product_id, _event_id, 'release', a.reserved_qty, 'devolução');
    END IF;
    IF a.consumed_qty > 0 THEN
      INSERT INTO public.stock_movements(tenant_id, product_id, event_id, kind, quantity, notes)
        VALUES (tid, a.product_id, _event_id, 'return', a.consumed_qty, 'devolução');
    END IF;
  END LOOP;
  DELETE FROM public.event_stock_allocations WHERE event_id = _event_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.return_event_stock(UUID) TO authenticated;

-- =========================================================
-- Trigger on events: auto-sync when relevant fields change
-- =========================================================
CREATE OR REPLACE FUNCTION public.trg_events_sync_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.sync_event_stock(NEW.id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.package_id IS DISTINCT FROM OLD.package_id
       OR NEW.guest_count IS DISTINCT FROM OLD.guest_count THEN
      PERFORM public.sync_event_stock(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_events_stock_sync AFTER INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.trg_events_sync_stock();

-- Trigger on package_products: resync active events
CREATE OR REPLACE FUNCTION public.trg_pkgprod_resync()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  eid UUID;
  pkg UUID;
BEGIN
  pkg := COALESCE(NEW.package_id, OLD.package_id);
  FOR eid IN
    SELECT id FROM public.events
     WHERE package_id = pkg
       AND status::text IN ('agendado','em_andamento','pago')
  LOOP
    PERFORM public.sync_event_stock(eid);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_package_products_resync AFTER INSERT OR UPDATE OR DELETE ON public.package_products
  FOR EACH ROW EXECUTE FUNCTION public.trg_pkgprod_resync();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_stock_allocations;
