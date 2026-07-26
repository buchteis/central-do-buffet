CREATE TABLE public.feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  nps_score INT NOT NULL CHECK (nps_score BETWEEN 0 AND 10),
  rating_food INT CHECK (rating_food BETWEEN 1 AND 5),
  rating_drinks INT CHECK (rating_drinks BETWEEN 1 AND 5),
  rating_staff INT CHECK (rating_staff BETWEEN 1 AND 5),
  rating_punctuality INT CHECK (rating_punctuality BETWEEN 1 AND 5),
  comments TEXT,
  improvements TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their feedbacks"
ON public.feedbacks FOR ALL TO authenticated
USING (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()))
WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()));

CREATE INDEX feedbacks_tenant_idx ON public.feedbacks (tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.submit_public_feedback(
  p_slug TEXT,
  p_client_name TEXT,
  p_nps_score INT,
  p_rating_food INT,
  p_rating_drinks INT,
  p_rating_staff INT,
  p_rating_punctuality INT,
  p_comments TEXT,
  p_improvements TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_tenant FROM public.tenants WHERE slug = p_slug AND status = 'ativo';
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Buffet não encontrado ou inativo';
  END IF;
  IF p_nps_score IS NULL OR p_nps_score < 0 OR p_nps_score > 10 THEN
    RAISE EXCEPTION 'Nota inválida';
  END IF;

  INSERT INTO public.feedbacks (
    tenant_id, client_name, nps_score, rating_food, rating_drinks,
    rating_staff, rating_punctuality, comments, improvements
  ) VALUES (
    v_tenant.id, COALESCE(NULLIF(btrim(p_client_name), ''), 'Cliente'), p_nps_score,
    p_rating_food, p_rating_drinks, p_rating_staff, p_rating_punctuality,
    NULLIF(btrim(p_comments), ''), NULLIF(btrim(p_improvements), '')
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_public_feedback(TEXT, TEXT, INT, INT, INT, INT, INT, TEXT, TEXT) TO anon, authenticated;