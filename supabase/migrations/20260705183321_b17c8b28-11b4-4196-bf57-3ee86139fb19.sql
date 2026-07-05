
-- Ensure joaopedrobc01@hotmail.com is super_admin and their tenant is active
DO $$
DECLARE u_id uuid;
BEGIN
  SELECT id INTO u_id FROM auth.users WHERE lower(email) = 'joaopedrobc01@hotmail.com' LIMIT 1;
  IF u_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (u_id, 'super_admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    UPDATE public.tenants
      SET status = 'ativo', approved_at = COALESCE(approved_at, now())
      WHERE owner_id = u_id AND status <> 'ativo';
  END IF;
END $$;
