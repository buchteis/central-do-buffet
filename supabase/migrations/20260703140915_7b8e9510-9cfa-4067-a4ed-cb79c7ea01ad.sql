
-- Extend quote_status
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'primeiro_contato';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'visitado';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'negociacao';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'aguardando';

-- Employees
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'churrasqueiro',
  phone TEXT,
  pix TEXT,
  daily_rate NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages employees" ON public.employees FOR ALL USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Event staff (assignments)
CREATE TABLE public.event_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'churrasqueiro',
  amount NUMERIC NOT NULL DEFAULT 0,
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, employee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_staff TO authenticated;
GRANT ALL ON public.event_staff TO service_role;
ALTER TABLE public.event_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages event staff" ON public.event_staff FOR ALL USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE TRIGGER trg_event_staff_updated BEFORE UPDATE ON public.event_staff FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent staff conflicts on same date
CREATE OR REPLACE FUNCTION public.check_staff_conflict()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  new_date DATE;
  conflict_count INT;
BEGIN
  SELECT event_date INTO new_date FROM public.events WHERE id = NEW.event_id;
  SELECT COUNT(*) INTO conflict_count
  FROM public.event_staff es
  JOIN public.events ev ON ev.id = es.event_id
  WHERE es.employee_id = NEW.employee_id
    AND es.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND ev.event_date = new_date;
  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'Funcionário já escalado em outro evento nesta data';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_check_staff_conflict BEFORE INSERT OR UPDATE ON public.event_staff FOR EACH ROW EXECUTE FUNCTION public.check_staff_conflict();

-- Financial transactions
CREATE TYPE public.tx_type AS ENUM ('entrada','saida');
CREATE TYPE public.tx_status AS ENUM ('pendente','pago','atrasado','cancelado');
CREATE TYPE public.tx_method AS ENUM ('pix','dinheiro','cartao','boleto','transferencia','outro');

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  type public.tx_type NOT NULL,
  status public.tx_status NOT NULL DEFAULT 'pendente',
  method public.tx_method NOT NULL DEFAULT 'pix',
  category TEXT,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages transactions" ON public.transactions FOR ALL USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contracts
CREATE TYPE public.contract_status AS ENUM ('rascunho','enviado','assinado','cancelado');
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Contrato de prestação de serviços',
  content TEXT NOT NULL DEFAULT '',
  status public.contract_status NOT NULL DEFAULT 'rascunho',
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages contracts" ON public.contracts FOR ALL USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Event checklist
CREATE TABLE public.event_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_checklist TO authenticated;
GRANT ALL ON public.event_checklist TO service_role;
ALTER TABLE public.event_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages checklist" ON public.event_checklist FOR ALL USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE TRIGGER trg_checklist_updated BEFORE UPDATE ON public.event_checklist FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Buffet settings
CREATE TABLE public.buffet_settings (
  owner_id UUID PRIMARY KEY,
  business_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  address TEXT,
  pix_key TEXT,
  pix_holder TEXT,
  contract_template TEXT DEFAULT '',
  wa_quote_template TEXT DEFAULT 'Olá {cliente}! Segue seu orçamento no valor de {valor} para o evento em {data}.',
  wa_reminder_template TEXT DEFAULT 'Olá {cliente}! Passando para lembrar do seu evento em {data} às {hora}.',
  wa_pix_template TEXT DEFAULT 'Olá {cliente}! Segue chave PIX para pagamento: {pix} — valor {valor}.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buffet_settings TO authenticated;
GRANT ALL ON public.buffet_settings TO service_role;
ALTER TABLE public.buffet_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages buffet settings" ON public.buffet_settings FOR ALL USING (auth.uid()=owner_id) WITH CHECK (auth.uid()=owner_id);
CREATE TRIGGER trg_buffet_settings_updated BEFORE UPDATE ON public.buffet_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
