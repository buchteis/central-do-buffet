
ALTER TABLE public.buffet_settings
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_agency text,
  ADD COLUMN IF NOT EXISTS bank_account text,
  ADD COLUMN IF NOT EXISTS bank_holder text;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'PIX';
