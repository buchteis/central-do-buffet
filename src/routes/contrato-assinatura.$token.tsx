import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, FileSignature, LoaderCircle } from "lucide-react";
import {
  getPublicContractForSigning,
  submitPublicContractSignature,
} from "@/lib/contracts.functions";

export const Route = createFileRoute("/contrato-assinatura/$token")({
  head: () => ({ meta: [{ title: "Assinatura de contrato — Meu Churras" }] }),
  component: PublicContractSignaturePage,
});

function PublicContractSignaturePage() {
  const { token } = Route.useParams();
  const getContract = useServerFn(getPublicContractForSigning);
  const submitSignature = useServerFn(submitPublicContractSignature);
  const [signerName, setSignerName] = useState("");
  const [signerCpf, setSignerCpf] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signed, setSigned] = useState(false);

  const {
    data: contract,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["public-contract-for-signing", token],
    queryFn: () => getContract({ data: { token } }),
  });

  const signature = useMutation({
    mutationFn: () =>
      submitSignature({
        data: { token, signerName, signerCpf, accepted: true },
      }),
    onSuccess: () => setSigned(true),
  });

  const alreadySigned = contract?.status === "assinado";
  const unavailable = contract?.status === "cancelado";

  return (
    <main className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <FileSignature className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Meu Churras</p>
            <h1 className="text-xl font-bold">Assinatura de contrato</h1>
          </div>
        </header>

        {isLoading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" /> Carregando contrato...
          </div>
        ) : error || !contract ? (
          <p className="py-12 text-sm text-destructive">
            {error?.message ?? "Contrato não encontrado."}
          </p>
        ) : signed || alreadySigned ? (
          <>
            <section className="border-y border-border py-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 size-10 text-emerald-600" />
              <h2 className="text-lg font-bold">Contrato assinado</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A assinatura foi registrada com sucesso.
              </p>
            </section>
            <section className="border-b border-border py-5">
              <h2 className="text-lg font-bold">{contract.title}</h2>
              <article className="mt-5 max-h-[55vh] overflow-y-auto whitespace-pre-wrap border-y border-border py-5 text-sm leading-6">
                {contract.content}
              </article>
            </section>
          </>
        ) : unavailable ? (
          <p className="border-y border-border py-10 text-center text-sm text-muted-foreground">
            Este contrato foi cancelado e não está disponível para assinatura.
          </p>
        ) : (
          <>
            <section className="border-y border-border py-5">
              <h2 className="text-lg font-bold">{contract.title}</h2>
              <article className="mt-5 max-h-[55vh] overflow-y-auto whitespace-pre-wrap border-y border-border py-5 text-sm leading-6">
                {contract.content}
              </article>
            </section>

            <form
              className="space-y-4 py-6"
              onSubmit={(event) => {
                event.preventDefault();
                signature.mutate();
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  Nome completo
                  <input
                    required
                    minLength={2}
                    maxLength={150}
                    autoComplete="name"
                    value={signerName}
                    onChange={(event) => setSignerName(event.target.value)}
                    className="h-10 rounded-md border border-input bg-background px-3 font-normal"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  CPF
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={14}
                    value={signerCpf}
                    onChange={(event) => setSignerCpf(event.target.value)}
                    placeholder="000.000.000-00"
                    className="h-10 rounded-md border border-input bg-background px-3 font-normal"
                  />
                </label>
              </div>

              <label className="flex items-start gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  required
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                  className="mt-1 size-4 accent-primary"
                />
                <span>
                  Confirmo que li e concordo com o conteúdo deste contrato e que os dados informados
                  são meus.
                </span>
              </label>

              {signature.error && (
                <p className="text-sm text-destructive">{signature.error.message}</p>
              )}
              <button
                type="submit"
                disabled={!accepted || signature.isPending}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {signature.isPending && <LoaderCircle className="size-4 animate-spin" />}
                Confirmar e Assinar
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
