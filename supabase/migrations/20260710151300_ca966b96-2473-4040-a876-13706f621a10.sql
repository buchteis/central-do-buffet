
-- Add 'em_andamento' status to leads and quotes enums to support simplified pipeline
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'em_andamento';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'em_andamento';
