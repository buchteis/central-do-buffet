CREATE OR REPLACE FUNCTION public.submit_public_quote_v2(p_slug text, p_name text, p_whatsapp text, p_email text, p_cpf text, p_city text, p_event_address text, p_event_date date, p_event_time text, p_guest_count integer, p_event_type text, p_package_id uuid, p_notes text, p_package_ids uuid[] DEFAULT NULL::uuid[], p_unit_items jsonb DEFAULT NULL::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_fixed numeric := 0;
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
             'item_id', ai.id,
             'product_id', ai.product_id,
             'name', ai.name,
             'unit', ai.unit,
             'unit_price', ai.unit_price,
             'qty', sel.qty
           ) ORDER BY ai.position, ai.name), '[]'::jsonb),
           COALESCE(SUM(ai.unit_price * sel.qty), 0)
      INTO v_unit_items, v_unit_total
    FROM jsonb_to_recordset(p_unit_items) AS sel(item_id uuid, qty numeric)
    JOIN public.additional_items ai
      ON ai.id = sel.item_id
     AND ai.tenant_id = v_tenant.id
     AND ai.active = true
    WHERE COALESCE(sel.qty, 0) > 0;
  END IF;

  WITH pkg AS (
    SELECT pk.id, pk.name, COALESCE(pk.pricing_type, 'per_person') AS pricing_type,
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
           ) AS price,
           COALESCE(
             (SELECT t.price_fixed FROM public.package_price_tiers t
               WHERE t.package_id = pk.id AND v_guests >= t.min_guests AND v_guests <= t.max_guests
               ORDER BY t.position NULLS LAST, t.min_guests, t.updated_at DESC, t.id LIMIT 1),
             (SELECT t.price_fixed FROM public.package_price_tiers t
               WHERE t.package_id = pk.id AND t.min_guests > v_guests
               ORDER BY t.min_guests ASC, t.updated_at DESC, t.id LIMIT 1),
             (SELECT t.price_fixed FROM public.package_price_tiers t
               WHERE t.package_id = pk.id AND t.max_guests < v_guests
               ORDER BY t.max_guests DESC, t.updated_at DESC, t.id LIMIT 1),
             0
           ) AS price_fixed
      FROM public.packages pk
     WHERE pk.tenant_id = v_tenant.id AND pk.active = true AND pk.id = ANY(v_ids)
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'package_id', p.id,
           'name', p.name,
           'pricing_type', p.pricing_type,
           'price_per_person', CASE WHEN p.pricing_type = 'fixed' THEN 0 ELSE p.price END,
           'price_fixed', CASE WHEN p.pricing_type = 'fixed' THEN p.price_fixed ELSE 0 END
         ) ORDER BY p.name), '[]'::jsonb),
         COALESCE(SUM(CASE WHEN p.pricing_type = 'fixed' THEN 0 ELSE p.price END), 0),
         COALESCE(SUM(CASE WHEN p.pricing_type = 'fixed' THEN p.price_fixed ELSE 0 END), 0)
    INTO v_packages, v_ppp, v_fixed
  FROM pkg p;

  v_total := round(COALESCE(v_ppp, 0) * v_guests + COALESCE(v_fixed, 0) + COALESCE(v_unit_total, 0), 2);
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
    'unit_items', v_unit_items,
    'custom', '[]'::jsonb
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
$function$;