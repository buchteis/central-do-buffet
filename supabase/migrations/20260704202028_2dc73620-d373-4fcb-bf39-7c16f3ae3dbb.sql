
CREATE OR REPLACE FUNCTION public.set_tenant_from_owner()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.owner_id IS NOT NULL THEN
    SELECT id INTO NEW.tenant_id FROM public.tenants WHERE owner_id = NEW.owner_id;
  END IF;
  RETURN NEW;
END; $$;

DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['clients','packages','quotes','events','employees','transactions','contracts','buffet_settings']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_tenant ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_set_tenant BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_owner()', t, t);
  END LOOP;
END $$;

-- event_staff/checklist derive from event
CREATE OR REPLACE FUNCTION public.set_tenant_from_event()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    SELECT tenant_id INTO NEW.tenant_id FROM public.events WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS event_staff_set_tenant ON public.event_staff;
CREATE TRIGGER event_staff_set_tenant BEFORE INSERT ON public.event_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_event();
DROP TRIGGER IF EXISTS event_checklist_set_tenant ON public.event_checklist;
CREATE TRIGGER event_checklist_set_tenant BEFORE INSERT ON public.event_checklist
  FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_event();
