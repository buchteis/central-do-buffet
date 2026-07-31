CREATE TABLE public.package_unit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.stock_products(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  unit_price numeric NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  default_qty numeric NOT NULL DEFAULT 1 CHECK (default_qty >= 0),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_package_unit_items_package ON public.package_unit_items(package_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_unit_items TO authenticated;
GRANT SELECT ON public.package_unit_items TO anon;
GRANT ALL ON public.package_unit_items TO service_role;

ALTER TABLE public.package_unit_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own package unit items" ON public.package_unit_items
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_unit_items.package_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_unit_items.package_id AND p.owner_id = auth.uid()));

CREATE POLICY "Super admin all package unit items" ON public.package_unit_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Public read unit items of active packages" ON public.package_unit_items
FOR SELECT TO anon, authenticated
USING (package_id IN (
  SELECT p.id FROM public.packages p JOIN public.tenants t ON t.id = p.tenant_id
  WHERE p.active = true AND t.status = 'ativo'::tenant_status
));

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER trg_package_unit_items_updated_at
BEFORE UPDATE ON public.package_unit_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS unit_items_consumed_at timestamptz;

CREATE OR REPLACE FUNCTION public.sync_quote_unit_items_stock()
RETURNS TRIGGER
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
          VALUES (tid, pid, 'adjust_out', qty, 'baixa item unitário — orçamento aprovado');
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
          VALUES (tid, pid, 'adjust_in', qty, 'estorno item unitário — orçamento reaberto');
        END IF;
      END IF;
    END LOOP;
    NEW.unit_items_consumed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_quotes_unit_items_stock
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.sync_quote_unit_items_stock();