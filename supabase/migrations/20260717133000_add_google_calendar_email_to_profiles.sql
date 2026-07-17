ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;
