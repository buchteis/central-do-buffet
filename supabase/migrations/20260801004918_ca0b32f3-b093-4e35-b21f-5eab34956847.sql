CREATE OR REPLACE FUNCTION public.submit_public_quote_v2(
  p_slug text,
  p_name text,
  p_whatsapp text,
  p_email text,
  p_cpf text,
  p_city text,
  p_event_address text,
  p_event_date date,
  p_event_time text,
  p_guest_count integer,
  p_event_type text,
  p_package_id uuid,
  p_notes text,
  p_package_ids uuid[] DEFAULT NULL,
  p_unit_items jsonb DEFAULT NULL
)
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

  -- Pacotes válidos deste buffet
  SELECT COALESCE(jsonb_agg(jsonb_build_object('package_id', pk.id, 'name', pk.name)), '[]'::jsonb)
    INTO v_packages
  FROM public.packages pk
  WHERE pk.tenant_id = v_tenant.id AND pk.id = ANY(v_ids);

  -- Itens unitários escolhidos (valida vínculo com pacotes do buffet)
  IF p_unit_items IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'item_id', ui.id,
             'product_id', ui.product_id,
             'name', ui.name,
             'unit', ui.unit,
             'unit_price', ui.unit_price,
             'qty', sel.qty
           )), '[]'::jsonb)
      INTO v_unit_items
    FROM jsonb_to_recordset(p_unit_items) AS sel(item_id uuid, qty numeric)
    JOIN public.package_unit_items ui ON ui.id = sel.item_id
    JOIN public.packages pk ON pk.id = ui.package_id AND pk.tenant_id = v_tenant.id
    WHERE COALESCE(sel.qty, 0) > 0;
  END IF;

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
    COALESCE(p_guest_count, 0), 0, 0,
    0, 0, 0, false,
    'novo'::quote_status, NULLIF(p_notes,''), v_extras
  ) RETURNING id INTO v_quote_id;

  RETURN v_quote_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_public_quote_v2(text,text,text,text,text,text,text,date,text,integer,text,uuid,text,uuid[],jsonb) TO anon, authenticated;