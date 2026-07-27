// Adaptador de provedor fiscal (NFS-e).
// A estrutura é plugável: basta implementar um novo provider e registrá-lo abaixo.
// Enquanto nenhum provedor real estiver configurado, usamos o "generic" (simulação
// em homologação), que permite testar todo o fluxo do módulo sem emitir de verdade.

export type FiscalSettings = {
  razao_social: string | null;
  cnpj: string | null;
  inscricao_municipal: string | null;
  regime_tributario: string | null;
  codigo_servico: string | null;
  aliquota_iss: number | null;
  provider: string;
  environment: string;
  api_key: string | null;
};

export type IssueInput = {
  description: string;
  amount: number;
  serviceDate: string | null;
  paymentMethod: string | null;
  recipientName: string | null;
  recipientDoc: string | null;
  recipientEmail: string | null;
  sendEmail: boolean;
};

export type IssueResult = {
  status: "emitida" | "pendente" | "erro";
  number: string | null;
  series: string | null;
  providerRef: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  emailSent: boolean;
  message: string | null;
};

export type CancelResult = { ok: boolean; message: string | null };

export interface NfseProvider {
  id: string;
  issue(settings: FiscalSettings, input: IssueInput): Promise<IssueResult>;
  cancel(settings: FiscalSettings, providerRef: string | null, reason: string): Promise<CancelResult>;
}

/** Provedor de simulação — nenhuma chamada externa é feita. */
const genericProvider: NfseProvider = {
  id: "generic",
  async issue(settings, input) {
    const ref = `SIM-${Date.now().toString(36).toUpperCase()}`;
    return {
      status: "emitida",
      number: ref.slice(-8),
      series: "S",
      providerRef: ref,
      pdfUrl: null,
      xmlUrl: null,
      emailSent: false,
      message:
        settings.environment === "producao"
          ? "Nenhum provedor fiscal real está conectado: a nota foi registrada em modo simulado."
          : input.sendEmail
            ? "Nota simulada (homologação). O envio automático por e-mail exige um provedor fiscal conectado."
            : "Nota simulada (homologação).",
    };
  },
  async cancel() {
    return { ok: true, message: "Nota simulada cancelada." };
  },
};

const providers: Record<string, NfseProvider> = {
  generic: genericProvider,
  // focus_nfe: focusNfeProvider,
  // nfe_io: nfeIoProvider,
};

export function getProvider(id: string | null | undefined): NfseProvider {
  return providers[(id ?? "generic").trim()] ?? genericProvider;
}
