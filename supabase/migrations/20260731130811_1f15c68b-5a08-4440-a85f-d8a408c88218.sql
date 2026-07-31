-- ============================================================================
-- submit_public_quote v2: suporta MÚLTIPLOS pacotes no formulário público.
--
-- Mudanças:
--  - novo parâmetro p_package_ids uuid[] (lista de pacotes escolhidos pelo cliente)
--  - mantém p_package_id (obsoleto, aceito por compat) — se vier, vira lista de 1.
--  - salva extras.packages = [{ package_id, name, price_per_person }] (snapshot)
--  - calcula total_value = soma(preço_por_pessoa_por_pacote) * convidados
--    usando resolve_package_price(package_id, guest_count) (tiers por convidados)
--  - define quotes.package_id = primeiro pacote (para a relação packages(name))
-- ============================================================================

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
  p_guest_count integer,
  p_event_type text,
  p_package_id uuid,           -- obsoleto/compat: pacote único (vira lista de 1)
  p_notes text,
  p_package_ids uuid DEFAULT NULL   -- NOVO: lista de pacotes (pode ter 2, 3, 4...)
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
  v_ids uuid[];
  v_pid uuid;
  v_pkg public.packages%ROWTYPE;
  v_pp numeric;
  v_total numeric := 0;
  v_pkgs_snapshot jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug AND status = 'ativo';
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Buffet não encontrado ou inativo';
  END IF;

  -- event_time
  v_time_txt := NULLIF(btrim(p_event_time), '');
  IF v_time_txt IS NOT NULL THEN
    BEGIN
      v_event_time := v_time_txt::time;
    EXCEPTION WHEN others THEN
      v_event_time := NULL;
    END;
  END IF;

  -- Monta a lista final de ids: prioriza p_package_ids (array); senão p_package_id.
  v_ids := COALESCE(p_package_ids, ARRAY[]::uuid[]);
  IF array_length(v_ids, 1) IS NULL AND p_package_id IS NOT NULL THEN
    v_ids := ARRAY[p_package_id];
  END IF;
  -- Remove duplicatas e nulos mantendo a ordem.
  SELECT COALESCE(array_agg(DISTINCT x), ARRAY[]::uuid[]) INTO v_ids
  FROM unnest(v_ids) AS x WHERE x IS NOT NULL;

  -- Cria cliente
  INSERT INTO public.clients (
    owner_id, tenant_id, name, cpf, phone, whatsapp, email, city, address, notes, origem, status
  ) VALUES (
    v_tenant.owner_id, v_tenant.id, p_name, NULLIF(p_cpf,''), NULLIF(p_whatsapp,''),
    NULLIF(p_whatsapp,''), NULLIF(p_email,''), NULLIF(p_city,''),
    NULLIF(p_event_address,''), NULLIF(p_notes,''), 'link_orcamento', 'novo_cliente'
  ) RETURNING id INTO v_client_id;

  -- Snapshot dos pacotes + cálculo do total (preço por pessoa via tiers * convidados)
  IF array_length(v_ids, 1) IS NOT NULL THEN
    FOREACH v_pid IN ARRAY v_ids LOOP
      SELECT * INTO v_pkg FROM public.packages WHERE id = v_pid;
      IF v_pkg.id IS NOT NULL THEN
        v_pp := COALESCE(public.resolve_package_price(v_pid, COALESCE(p_guest_count,0)), v_pkg.price_per_person, 0);
        v_total := v_total + v_pp;
        v_pkgs_snapshot := v_pkgs_snapshot || jsonb_build_array(jsonb_build_object(
          'package_id', v_pkg.id,
          'name', v_pkg.name,
          'price_per_person', v_pp
        ));
      END IF;
    END LOOP;
  END IF;

  v_total := v_total * COALESCE(p_guest_count, 0);

  v_extras := jsonb_build_object(
    'requester', jsonb_build_object(
      'name', p_name,
      'whatsapp', p_whatsapp,
      'email', p_email,
      'cpf', p_cpf,
      'city', p_city
    ),
    'source', 'formulario_publico',
    'packages', v_pkgs_snapshot
  );

  INSERT INTO public.quotes (
    owner_id, tenant_id, client_id, package_id,
    event_date, event_time, event_address, event_type,
    adults, children_7_10, children_0_6,
    total_value, entry_value, balance_value, paid,
    status, notes, extras
  ) VALUES (
    v_tenant.owner_id, v_tenant.id, v_client_id,
    CASE WHEN array_length(v_ids,1) IS NOT NULL THEN v_ids[1] ELSE NULL END,
    p_event_date, v_event_time, NULLIF(p_event_address,''), NULLIF(p_event_type,''),
    COALESCE(p_guest_count, 0), 0, 0,
    v_total, round(v_total * 0.5, 2), round(v_total - (v_total * 0.5), 2), false,
    'novo'::quote_status, NULLIF(p_notes,''), v_extras
  ) RETURNING id INTO v_quote_id;

  RETURN v_quote_id;
END;
$function$;

-- A assinatura mudou (novo parâmetro opcional); regranta execução.
DROP POLICY IF EXISTS "anon exec submit_public_quote" ON public.quotes;
GRANT EXECUTE ON FUNCTION public.submit_public_quote(
  text, text, text, text, text, text, text, date, text, integer, text, uuid, text, uuid
) TO anon, authenticated;
