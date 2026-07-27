-- =========================
-- FISCAL SETTINGS
-- =========================
CREATE TABLE public.fiscal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  razao_social TEXT,
  cnpj TEXT,
  inscricao_municipal TEXT,
  regime_tributario TEXT,
  codigo_servico TEXT,
  aliquota_iss NUMERIC(6,3) DEFAULT 0,
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_district TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  fiscal_phone TEXT,
  fiscal_email TEXT,
  invoice_logo_url TEXT,
  provider TEXT NOT NULL DEFAULT 'generic',
  environment TEXT NOT NULL DEFAULT 'homologacao',
  api_key TEXT,
  has_api_key BOOLEAN GENERATED ALWAYS AS (api_key IS NOT NULL AND length(btrim(api_key)) > 0) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id)
);

-- chave de API nunca é legível pelo cliente: SELECT só nas colunas não sensíveis
GRANT SELECT (
  id, owner_id, tenant_id, razao_social, cnpj, inscricao_municipal, regime_tributario,
  codigo_servico, aliquota_iss, address_street, address_number, address_complement,
  address_district, address_city, address_state, address_zip, fiscal_phone, fiscal_email,
  invoice_logo_url, provider, environment, has_api_key, created_at, updated_at
) ON public.fiscal_settings TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fiscal_settings TO authenticated;
GRANT ALL ON public.fiscal_settings TO service_role;

ALTER TABLE public.fiscal_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their fiscal settings"
ON public.fiscal_settings FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER fiscal_settings_set_updated_at
BEFORE UPDATE ON public.fiscal_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER fiscal_settings_set_tenant
BEFORE INSERT ON public.fiscal_settings
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_owner();

-- =========================
-- INVOICES (NFS-e)
-- =========================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  number TEXT,
  series TEXT,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  service_date DATE,
  payment_method TEXT,
  recipient_name TEXT,
  recipient_doc TEXT,
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  provider TEXT NOT NULL DEFAULT 'generic',
  provider_ref TEXT,
  environment TEXT NOT NULL DEFAULT 'homologacao',
  pdf_url TEXT,
  xml_url TEXT,
  error_message TEXT,
  email_sent_at TIMESTAMPTZ,
  issued_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (status IN ('pendente','emitida','cancelada','erro'))
);

CREATE INDEX invoices_owner_created_idx ON public.invoices (owner_id, created_at DESC);
CREATE INDEX invoices_event_idx ON public.invoices (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their invoices"
ON public.invoices FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER invoices_set_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER invoices_set_tenant
BEFORE INSERT ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_from_owner();