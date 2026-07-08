
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'buffet';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'fechado';
COMMIT;
BEGIN;

CREATE TYPE public.tenant_status AS ENUM ('pendente','ativo','rejeitado','suspenso');

CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status public.tenant_status NOT NULL DEFAULT 'pendente',
  plan TEXT NOT NULL DEFAULT 'trial',
  city TEXT,
  responsible_name TEXT,
  contact_phone TEXT,
  last_seen_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT SELECT ON public.tenants TO anon;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER tenants_updated BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.unaccent_string(txt TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT translate(txt,
    'áàâãäåÁÀÂÃÄÅéèêëÉÈÊËíìîïÍÌÎÏóòôõöÓÒÔÕÖúùûüÚÙÛÜçÇñÑ',
    'aaaaaaAAAAAAeeeeEEEEiiiiIIIIoooooOOOOOuuuuUUUUcCnN')
$$;

CREATE OR REPLACE FUNCTION public.slugify(txt TEXT)
RETURNS TEXT LANGUAGE SQL IMMUTABLE AS $$
  SELECT regexp_replace(
    regexp_replace(lower(public.unaccent_string(coalesce(txt,'buffet'))), '[^a-z0-9]+', '-', 'g'),
    '(^-+|-+$)', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.generate_unique_slug(base TEXT)
RETURNS TEXT LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s TEXT; c INT := 0;
BEGIN
  s := public.slugify(base);
  IF s = '' OR s IS NULL THEN s := 'buffet'; END IF;
  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = s) LOOP
    c := c + 1;
    s := public.slugify(base) || '-' || c::text;
  END LOOP;
  RETURN s;
END; $$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.tenants WHERE owner_id = auth.uid()
$$;

CREATE POLICY "Owner sees own tenant" ON public.tenants
  FOR SELECT TO authenticated USING (auth.uid() = owner_id OR public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Owner updates own tenant" ON public.tenants
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Super admin manages tenants" ON public.tenants
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Public read active tenants" ON public.tenants
  FOR SELECT TO anon USING (status = 'ativo');

-- Backfill tenants
INSERT INTO public.tenants (owner_id, name, slug, status, approved_at)
SELECT p.id, COALESCE(p.business_name,'Meu Buffet'),
       public.generate_unique_slug(COALESCE(p.business_name,'buffet')),
       'ativo', now()
FROM public.profiles p
ON CONFLICT (owner_id) DO NOTHING;

-- Add tenant_id
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['clients','packages','quotes','events','employees','event_staff','event_checklist','transactions','contracts','buffet_settings']) LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE', t);
  END LOOP;
END $$;

UPDATE public.clients c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.packages c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.quotes c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.events c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.employees c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.transactions c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.contracts c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.buffet_settings c SET tenant_id=t.id FROM public.tenants t WHERE t.owner_id=c.owner_id AND c.tenant_id IS NULL;
UPDATE public.event_staff es SET tenant_id=ev.tenant_id FROM public.events ev WHERE ev.id=es.event_id AND es.tenant_id IS NULL;
UPDATE public.event_checklist ec SET tenant_id=ev.tenant_id FROM public.events ev WHERE ev.id=ec.event_id AND ec.tenant_id IS NULL;

-- Super admin override policies
CREATE POLICY "Super admin all clients" ON public.clients FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all packages" ON public.packages FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all quotes" ON public.quotes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all events" ON public.events FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all employees" ON public.employees FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all event_staff" ON public.event_staff FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all event_checklist" ON public.event_checklist FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all transactions" ON public.transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all contracts" ON public.contracts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all buffet_settings" ON public.buffet_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all profiles" ON public.profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));
CREATE POLICY "Super admin all user_roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'super_admin')) WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- Leads
CREATE TYPE public.lead_status AS ENUM ('novo','contatado','convertido','descartado');

CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  city TEXT,
  event_address TEXT,
  event_date DATE,
  event_time TIME,
  guest_count INTEGER,
  event_type TEXT,
  package_desired TEXT,
  package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL,
  notes TEXT,
  source TEXT DEFAULT 'formulario_publico',
  status public.lead_status NOT NULL DEFAULT 'novo',
  converted_quote_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_tenant_idx ON public.leads(tenant_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER leads_updated BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Tenant owner reads leads" ON public.leads
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'super_admin') OR
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  );
CREATE POLICY "Tenant owner writes leads" ON public.leads
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(),'super_admin') OR
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  ) WITH CHECK (
    public.has_role(auth.uid(),'super_admin') OR
    tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid())
  );
CREATE POLICY "Public insert lead for active tenant" ON public.leads
  FOR INSERT TO anon WITH CHECK (
    EXISTS (SELECT 1 FROM public.tenants WHERE id = tenant_id AND status = 'ativo')
  );

-- Also allow anon to read active packages for the public form
CREATE POLICY "Public read active packages for active tenant" ON public.packages
  FOR SELECT TO anon USING (
    active = true AND tenant_id IN (SELECT id FROM public.tenants WHERE status='ativo')
  );
GRANT SELECT ON public.packages TO anon;

-- Auto quote -> event
CREATE OR REPLACE FUNCTION public.on_quote_closed()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'fechado' AND (OLD.status IS DISTINCT FROM 'fechado') THEN
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE quote_id = NEW.id) THEN
      INSERT INTO public.events (
        owner_id, tenant_id, client_id, quote_id, package_id,
        event_date, event_time, event_address, guest_count,
        total_value, status, notes
      ) VALUES (
        NEW.owner_id, NEW.tenant_id, NEW.client_id, NEW.id, NEW.package_id,
        NEW.event_date, NEW.event_time, NEW.event_address,
        COALESCE(NEW.adults,0)+COALESCE(NEW.children_7_10,0)+COALESCE(NEW.children_0_6,0),
        NEW.total_value, 'agendado', NEW.notes
      );
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS quote_closed_creates_event ON public.quotes;
CREATE TRIGGER quote_closed_creates_event
AFTER UPDATE OF status ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.on_quote_closed();

-- New user handler
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  biz TEXT;
  is_super BOOLEAN := (lower(NEW.email) = 'joaopedrobc01@hotmail.com');
BEGIN
  biz := COALESCE(NEW.raw_user_meta_data->>'business_name','Meu Buffet');
  INSERT INTO public.profiles (id, full_name, business_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), biz)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.tenants (owner_id, name, slug, status, approved_at)
  VALUES (NEW.id, biz, public.generate_unique_slug(biz),
    CASE WHEN is_super THEN 'ativo'::tenant_status ELSE 'pendente'::tenant_status END,
    CASE WHEN is_super THEN now() ELSE NULL END)
  ON CONFLICT (owner_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'buffet') ON CONFLICT DO NOTHING;
  IF is_super THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

-- Grant super_admin now
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'super_admin'::app_role FROM auth.users WHERE lower(email) = 'joaopedrobc01@hotmail.com'
ON CONFLICT DO NOTHING;

UPDATE public.tenants SET status='ativo', approved_at=COALESCE(approved_at, now())
WHERE owner_id IN (SELECT id FROM auth.users WHERE lower(email) = 'joaopedrobc01@hotmail.com');
