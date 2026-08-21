CREATE POLICY "User reads own login row" ON public.tenant_logins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);