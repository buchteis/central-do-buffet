CREATE TABLE public.tenant_logins (
  user_id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  last_login_at timestamptz NOT NULL DEFAULT now(),
  device text NOT NULL DEFAULT 'desconhecido',
  user_agent text,
  login_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.tenant_logins TO authenticated;
GRANT ALL ON public.tenant_logins TO service_role;

ALTER TABLE public.tenant_logins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin reads all logins" ON public.tenant_logins
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "User records own login" ON public.tenant_logins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "User updates own login" ON public.tenant_logins
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER tenant_logins_updated BEFORE UPDATE ON public.tenant_logins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();