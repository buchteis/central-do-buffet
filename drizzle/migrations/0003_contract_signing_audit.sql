ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS signing_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN IF NOT EXISTS signer_ip TEXT,
  ADD COLUMN IF NOT EXISTS signer_user_agent TEXT,
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signer_cpf TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS contracts_signing_token_idx ON public.contracts (signing_token);

CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id UUID NOT NULL UNIQUE REFERENCES public.contracts(id) ON DELETE CASCADE,
  ip_cliente TEXT,
  data_hora_assinatura TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  nome_signatario TEXT NOT NULL,
  cpf_signatario TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.contract_signatures TO service_role;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.contracts TO authenticated;

CREATE OR REPLACE FUNCTION public.sign_contract_by_token(
  p_token TEXT, p_ip_cliente TEXT, p_data_hora_assinatura TIMESTAMPTZ,
  p_user_agent TEXT, p_nome_signatario TEXT, p_cpf_signatario TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_contract_id UUID; v_status public.contract_status;
BEGIN
  SELECT id, status INTO v_contract_id, v_status FROM public.contracts WHERE signing_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado ou link inválido.'; END IF;
  IF v_status = 'assinado' THEN RAISE EXCEPTION 'Este contrato já foi assinado.'; END IF;
  IF v_status = 'cancelado' THEN RAISE EXCEPTION 'Este contrato foi cancelado.'; END IF;
  IF p_ip_cliente IS NULL OR btrim(p_ip_cliente) = '' THEN RAISE EXCEPTION 'Não foi possível identificar o IP do signatário.'; END IF;
  UPDATE public.contracts SET status = 'assinado', signed_at = p_data_hora_assinatura, signer_ip = p_ip_cliente,
    signer_user_agent = p_user_agent, signer_name = p_nome_signatario, signer_cpf = p_cpf_signatario
  WHERE id = v_contract_id;
  INSERT INTO public.contract_signatures (contrato_id, ip_cliente, data_hora_assinatura, user_agent, nome_signatario, cpf_signatario)
  VALUES (v_contract_id, p_ip_cliente, p_data_hora_assinatura, p_user_agent, p_nome_signatario, p_cpf_signatario);
  RETURN jsonb_build_object('ok', true, 'data_hora_assinatura', p_data_hora_assinatura);
END; $$;

REVOKE ALL ON FUNCTION public.sign_contract_by_token(TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_by_token(TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';