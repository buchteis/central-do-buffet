
CREATE OR REPLACE FUNCTION public.submit_public_quote(
  p_slug text, p_name text, p_whatsapp text, p_email text, p_cpf text,
  p_city text, p_event_address text, p_event_date date, p_event_time text,
  p_guest_count integer, p_event_type text, p_package_id uuid, p_notes text
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
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug AND status = 'ativo';
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Buffet não encontrado ou inativo';
  END IF;

  -- Parse event_time safely
  v_time_txt := NULLIF(btrim(p_event_time), '');
  IF v_time_txt IS NOT NULL THEN
    BEGIN
      v_event_time := v_time_txt::time;
    EXCEPTION WHEN others THEN
      v_event_time := NULL;
    END;
  END IF;

  -- Always create a NEW client for public form submissions
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
    'source', 'formulario_publico'
  );

  INSERT INTO public.quotes (
    owner_id, tenant_id, client_id, package_id,
    event_date, event_time, event_address, event_type,
    adults, children_7_10, children_0_6,
    total_value, entry_value, balance_value, paid,
    status, notes, extras
  ) VALUES (
    v_tenant.owner_id, v_tenant.id, v_client_id, p_package_id,
    p_event_date, v_event_time, NULLIF(p_event_address,''), NULLIF(p_event_type,''),
    COALESCE(p_guest_count, 0), 0, 0,
    0, 0, 0, false,
    'novo'::quote_status, NULLIF(p_notes,''), v_extras
  ) RETURNING id INTO v_quote_id;

  RETURN v_quote_id;
END;
$function$;
