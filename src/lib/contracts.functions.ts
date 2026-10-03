import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { isIP } from "node:net";
import { z } from "zod";
import { isValidCpfCnpj } from "@/lib/doc";

const signingTokenSchema = z.string().min(32).max(128);

/** O token imprevisível é a autorização para consultar o contrato publicamente. */
export const getPublicContractForSigning = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ token: signingTokenSchema }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contract, error } = await supabaseAdmin
      .from("contracts")
      .select("title, content, status")
      .eq("signing_token", data.token)
      .maybeSingle();

    if (error) throw new Error("Não foi possível carregar o contrato.");
    if (!contract) throw new Error("Contrato não encontrado ou link inválido.");
    return contract as { title: string; content: string; status: string };
  });

function getClientIp(request: Request): string | null {
  const socketAddress = (request as Request & { socket?: { remoteAddress?: string } }).socket
    ?.remoteAddress;
  // Prefere cabeçalhos da borda/proxy; alguns runtimes Fetch não expõem o socket.
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    forwardedFor,
    request.headers.get("x-real-ip"),
    socketAddress,
  ];

  return candidates.find((candidate) => candidate && isIP(candidate.trim()))?.trim() ?? null;
}

export const submitPublicContractSignature = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        token: signingTokenSchema,
        signerName: z.string().trim().min(2).max(150),
        signerCpf: z
          .string()
          .transform((value) => value.replace(/\D/g, ""))
          .refine((value) => value.length === 11 && isValidCpfCnpj(value), "CPF inválido."),
        accepted: z.literal(true),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const request = getRequest();
    if (!request) throw new Error("Não foi possível identificar a requisição.");

    const clientIp = getClientIp(request);
    if (!clientIp) {
      throw new Error("Não foi possível identificar o IP do signatário. Tente novamente.");
    }

    const signedAt = new Date().toISOString();
    const userAgent = request.headers.get("user-agent")?.trim().slice(0, 1000);
    if (!userAgent) {
      throw new Error("Não foi possível identificar o navegador do signatário. Tente novamente.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("sign_contract_by_token", {
      p_token: data.token,
      p_ip_cliente: clientIp,
      p_data_hora_assinatura: signedAt,
      p_user_agent: userAgent,
      p_nome_signatario: data.signerName,
      p_cpf_signatario: data.signerCpf,
    });

    if (error) throw new Error(error.message || "Não foi possível concluir a assinatura.");
    if (
      !result ||
      typeof result !== "object" ||
      Array.isArray(result) ||
      result.ok !== true ||
      typeof result.data_hora_assinatura !== "string"
    ) {
      throw new Error("A resposta da assinatura não contém uma confirmação válida.");
    }
    return { ok: true, signedAt: result.data_hora_assinatura };
  });
