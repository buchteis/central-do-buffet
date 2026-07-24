
CREATE TABLE public.package_price_tiers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id uuid NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  min_guests integer NOT NULL DEFAULT 0,
  max_guests integer NOT NULL DEFAULT 9999,
  price_per_person numeric(10,2) NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT package_price_tiers_range_chk CHECK (max_guests >= min_guests)
);

CREATE INDEX package_price_tiers_pkg_idx ON public.package_price_tiers(package_id);
CREATE INDEX package_price_tiers_owner_idx ON public.package_price_tiers(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_price_tiers TO authenticated;
GRANT SELECT ON public.package_price_tiers TO anon;
GRANT ALL ON public.package_price_tiers TO service_role;

ALTER TABLE public.package_price_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages tiers"
  ON public.package_price_tiers
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Super admin all tiers"
  ON public.package_price_tiers
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Public read tiers of active packages"
  ON public.package_price_tiers
  FOR SELECT
  TO anon
  USING (
    package_id IN (
      SELECT p.id FROM public.packages p
      JOIN public.tenants t ON t.id = p.tenant_id
      WHERE p.active = true AND t.status = 'ativo'
    )
  );

CREATE TRIGGER package_price_tiers_updated
BEFORE UPDATE ON public.package_price_tiers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed initial tier from existing package fields (preserve history)
INSERT INTO public.package_price_tiers (package_id, owner_id, tenant_id, min_guests, max_guests, price_per_person, position)
SELECT
  p.id,
  p.owner_id,
  p.tenant_id,
  COALESCE(NULLIF(p.min_people, 0), 0),
  COALESCE(NULLIF(p.max_people, 0), 9999),
  p.price_per_person,
  0
FROM public.packages p
WHERE NOT EXISTS (
  SELECT 1 FROM public.package_price_tiers t WHERE t.package_id = p.id
);

-- Helper: resolve price per person for a package given guest count.
-- Falls back to the closest tier if no exact match (nearest by min_guests).
CREATE OR REPLACE FUNCTION public.resolve_package_price(p_package_id uuid, p_guests integer)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT price_per_person
  FROM public.package_price_tiers
  WHERE package_id = p_package_id
    AND p_guests BETWEEN min_guests AND max_guests
  ORDER BY position ASC, min_guests ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_package_price(uuid, integer) TO anon, authenticated, service_role;
