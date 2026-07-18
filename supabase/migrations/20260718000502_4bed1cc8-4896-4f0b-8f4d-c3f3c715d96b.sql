
-- Relax stock constraints so quotes/events don't fail when stock is short.
-- The UI already highlights low/negative stock; blocking at DB level was over-restrictive.
ALTER TABLE public.stock_products DROP CONSTRAINT IF EXISTS stock_products_available_nonneg;
ALTER TABLE public.stock_products DROP CONSTRAINT IF EXISTS stock_products_physical_nonneg;
ALTER TABLE public.stock_products DROP CONSTRAINT IF EXISTS stock_products_reserved_nonneg;
