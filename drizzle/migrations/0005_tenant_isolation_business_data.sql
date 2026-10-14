DROP POLICY IF EXISTS "Super admin all clients" ON public.clients;
DROP POLICY IF EXISTS "Super admin all contracts" ON public.contracts;
DROP POLICY IF EXISTS "Super admin all events" ON public.events;
DROP POLICY IF EXISTS "Super admin all quotes" ON public.quotes;
DROP POLICY IF EXISTS "Super admin all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Tenant owner reads leads" ON public.leads;
DROP POLICY IF EXISTS "Tenant owner writes leads" ON public.leads;
CREATE POLICY "Tenant owner manages leads" ON public.leads FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()))
  WITH CHECK (tenant_id IN (SELECT id FROM public.tenants WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Owners manage own installments" ON public.payment_installments;
CREATE POLICY "Owners manage own installments" ON public.payment_installments FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR tenant_id = public.current_tenant_id())
  WITH CHECK (owner_id = auth.uid() OR tenant_id = public.current_tenant_id());