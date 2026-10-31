ALTER TABLE public.buffet_settings
  ADD COLUMN IF NOT EXISTS wa_contract_template TEXT
  NOT NULL DEFAULT 'Olá {cliente}! Segue o link para {acao} do seu contrato: {link}';
