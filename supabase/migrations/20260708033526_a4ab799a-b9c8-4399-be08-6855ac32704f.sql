
CREATE OR REPLACE FUNCTION public.create_client_from_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_exists uuid;
BEGIN
  SELECT owner_id INTO v_owner FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_exists FROM public.clients
    WHERE tenant_id = NEW.tenant_id
      AND (
        (NEW.phone IS NOT NULL AND phone = NEW.phone)
        OR (NEW.email IS NOT NULL AND email = NEW.email)
      )
    LIMIT 1;

  IF v_exists IS NULL THEN
    INSERT INTO public.clients (owner_id, tenant_id, name, phone, whatsapp, email, city, address, notes, origem, status)
    VALUES (v_owner, NEW.tenant_id, NEW.name, NEW.phone, NEW.whatsapp, NEW.email, NEW.city, NEW.event_address, NEW.notes, 'link_orcamento', 'novo_cliente');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_create_client ON public.leads;
CREATE TRIGGER trg_lead_create_client
AFTER INSERT ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.create_client_from_lead();
