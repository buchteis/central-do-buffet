ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS pipeline_stage text NOT NULL DEFAULT 'novos';
UPDATE public.whatsapp_conversations SET pipeline_stage = 'novos' WHERE pipeline_stage IS NULL;
ALTER TABLE public.whatsapp_conversations ALTER COLUMN pipeline_stage SET DEFAULT 'novos';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.whatsapp_conversations'::regclass AND conname = 'whatsapp_conversations_pipeline_stage_check') THEN
    ALTER TABLE public.whatsapp_conversations ADD CONSTRAINT whatsapp_conversations_pipeline_stage_check CHECK (pipeline_stage IN ('novos', 'quente', 'proposta', 'humano', 'fechado'));
  END IF;
END $$;
GRANT UPDATE (pipeline_stage) ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;
NOTIFY pgrst, 'reload schema';