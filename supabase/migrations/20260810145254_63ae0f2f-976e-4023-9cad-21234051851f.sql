CREATE TABLE public.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name text,
  supplier_cnpj text,
  nf_number text,
  nf_series text,
  access_key text,
  issue_date date,
  total_value numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_invoices TO authenticated;
GRANT ALL ON public.purchase_invoices TO service_role;

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buffet manages own purchase invoices"
ON public.purchase_invoices FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE UNIQUE INDEX purchase_invoices_key_uniq
  ON public.purchase_invoices (tenant_id, access_key)
  WHERE access_key IS NOT NULL AND access_key <> '';

CREATE UNIQUE INDEX purchase_invoices_nf_uniq
  ON public.purchase_invoices (tenant_id, coalesce(supplier_cnpj,''), coalesce(nf_number,''), coalesce(nf_series,''))
  WHERE nf_number IS NOT NULL AND nf_number <> '';

CREATE TRIGGER purchase_invoices_updated BEFORE UPDATE ON public.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_price numeric,
  ADD COLUMN IF NOT EXISTS total_price numeric,
  ADD COLUMN IF NOT EXISTS source text;