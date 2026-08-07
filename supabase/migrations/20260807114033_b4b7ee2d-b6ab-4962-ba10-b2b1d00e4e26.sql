DELETE FROM public.package_price_tiers t
USING public.package_price_tiers k
WHERE t.package_id = k.package_id
  AND t.min_guests = k.min_guests
  AND t.max_guests = k.max_guests
  AND (t.updated_at, t.id) < (k.updated_at, k.id);

CREATE UNIQUE INDEX IF NOT EXISTS package_price_tiers_pkg_range_uniq
  ON public.package_price_tiers (package_id, min_guests, max_guests);

CREATE OR REPLACE FUNCTION public.submit_public_quote_v2(
  p_slug text, p_name text, p_whatsapp text, p_email text, p_cpf text, p_city text,
  p_event_address text, p_event_date date, p_event_time text, p_guest_count integer,
  p_event_type text, p_package_id uuid, p_notes text,
  p_package_ids uuid[] DEFAULT NULL::uuid[], p_unit_items jsonb DEFAULT NULL::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_quote_id uuid;
  v_client_id uuid;
  v_extras jsonb;
  v_event_time time without time zone;
  v_time_txt text;
  v_packages jsonb := '[]'::jsonb;
  v_unit_items jsonb := '[]'::jsonb;
  v_ids uuid[];
  v_guests integer := GREATEST(COALESCE(p_guest_count, 0), 0);
  v_ppp numeric := 0;
  v_unit_total numeric := 0;
  v_total numeric := 0;
  v_entry numeric := 0;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug AND status = 'ativo';
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Buffet não encontrado ou inativo';
  END IF;

  v_time_txt := NULLIF(btrim(p_event_time), '');
  IF v_time_txt IS NOT NULL THEN
    BEGIN
      v_event_time := v_time_txt::time;
    EXCEPTION WHEN others THEN
      v_event_time := NULL;
    END;
  END IF;

  v_ids := COALESCE(p_package_ids, CASE WHEN p_package_id IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[p_package_id] END);

  IF p_unit_items IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'item_id', ui.id,
             'product_id', ui.product_id,
             'name', ui.name,
             'unit', ui.unit,
             'unit_price', ui.unit_price,
             'qty', sel.qty
           )), '[]'::jsonb),
           COALESCE(SUM(ui.unit_price * sel.qty), 0)
      INTO v_unit_items, v_unit_total
    FROM jsonb_to_recordset(p_unit_items) AS sel(item_id uuid, qty numeric)
    JOIN public.package_unit_items ui ON ui.id = sel.item_id
    JOIN public.packages pk ON pk.id = ui.package_id AND pk.tenant_id = v_tenant.id
    WHERE COALESCE(sel.qty, 0) > 0;
  END IF;

  WITH pkg AS (
    SELECT pk.id, pk.name,
           COALESCE(
             (SELECT t.price_per_person FROM public.package_price_tiers t
               WHERE t.package_id = pk.id AND v_guests >= t.min_guests AND v_guests <= t.max_guests
               ORDER BY t.position NULLS LAST, t.min_guests, t.updated_at DESC, t.id LIMIT 1),
             (SELECT t.price_per_person FROM public.package_price_tiers t
               WHERE t.package_id = pk.id AND t.min_guests > v_guests
               ORDER BY t.min_guests ASC, t.updated_at DESC, t.id LIMIT 1),
             (SELECT t.price_per_person FROM public.package_price_tiers t
               WHERE t.package_id = pk.id AND t.max_guests < v_guests
               ORDER BY t.max_guests DESC, t.updated_at DESC, t.id LIMIT 1),
             pk.price_per_person,
             0
           ) AS price
      FROM public.packages pk
     WHERE pk.tenant_id = v_tenant.id AND pk.id = ANY(v_ids)
  ),
  dedup AS (
    SELECT * FROM pkg p
     WHERE NOT (
       COALESCE(p.price, 0) <= 0
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(v_unit_items) u
          WHERE lower(btrim(u.value->>'name')) = lower(btrim(p.name))
       )
     )
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'package_id', d.id,
           'name', d.name,
           'price_per_person', d.price
         )), '[]'::jsonb),
         COALESCE(SUM(d.price), 0)
    INTO v_packages, v_ppp
  FROM dedup d;

  v_total := round(COALESCE(v_ppp, 0) * v_guests + COALESCE(v_unit_total, 0), 2);
  v_entry := round(v_total * 0.5, 2);

  INSERT INTO public.clients (
    owner_id, tenant_id, name, cpf, phone, whatsapp, email, city, address, notes, origem, status
  ) VALUES (
    v_tenant.owner_id, v_tenant.id, p_name, NULLIF(p_cpf,''), NULLIF(p_whatsapp,''),
    NULLIF(p_whatsapp,''), NULLIF(p_email,''), NULLIF(p_city,''),
    NULLIF(p_event_address,''), NULLIF(p_notes,''), 'link_orcamento', 'novo_cliente'
  ) RETURNING id INTO v_client_id;

  v_extras := jsonb_build_object(
    'requester', jsonb_build_object(
      'name', p_name,
      'whatsapp', p_whatsapp,
      'email', p_email,
      'cpf', p_cpf,
      'city', p_city
    ),
    'source', 'formulario_publico',
    'packages', v_packages,
    'unit_items', v_unit_items
  );

  INSERT INTO public.quotes (
    owner_id, tenant_id, client_id, package_id,
    event_date, event_time, event_address, event_type,
    adults, children_7_10, children_0_6,
    total_value, entry_value, balance_value, paid,
    status, notes, extras
  ) VALUES (
    v_tenant.owner_id, v_tenant.id, v_client_id, COALESCE(p_package_id, v_ids[1]),
    p_event_date, v_event_time, NULLIF(p_event_address,''), NULLIF(p_event_type,''),
    v_guests, 0, 0,
    v_total, v_entry, v_total - v_entry, false,
    'novo'::quote_status, NULLIF(p_notes,''), v_extras
  ) RETURNING id INTO v_quote_id;

  RETURN v_quote_id;
END;
$$;