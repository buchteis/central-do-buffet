ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS pipeline_stage text;

UPDATE public.whatsapp_conversations
SET pipeline_stage = 'novos'
WHERE pipeline_stage IS NULL;

ALTER TABLE public.whatsapp_conversations
  ALTER COLUMN pipeline_stage SET DEFAULT 'novos',
  ALTER COLUMN pipeline_stage SET NOT NULL;
