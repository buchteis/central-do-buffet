
ALTER FUNCTION public.unaccent_string(text) SET search_path = public;
ALTER FUNCTION public.slugify(text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_unique_slug(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_unique_slug(text) TO service_role;
