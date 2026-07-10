
CREATE OR REPLACE FUNCTION public.submit_public_quote(
  p_slug text,
  p_name text,
  p_whatsapp text,
  p_email text,
  p_cpf text,
  p_city text,
  p_event_address text,
  p_event_date date,
  p_event_time text,
  p_guest_count int,
  p_event_type text,
  p_package_id uuid,
  p_notes text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_quote_id uuid;
  v_extras jsonb;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug AND status = 'ativo';
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Buffet não encontrado ou inativo';
  END IF;

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
    v_tenant.owner_id, v_tenant.id, NULL, p_package_id,
    p_event_date, p_event_time, p_event_address, p_event_type,
    COALESCE(p_guest_count, 0), 0, 0,
    0, 0, 0, false,
    'novo'::quote_status, p_notes, v_extras
  ) RETURNING id INTO v_quote_id;

  RETURN v_quote_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_quote(text, text, text, text, text, text, text, date, text, int, text, uuid, text) TO anon, authenticated;
