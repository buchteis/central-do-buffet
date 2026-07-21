// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, formatDateBR } from "@/lib/format";
import { 
  Wallet, 
  Copy, 
  CheckCircle2, 
  Clock, 
  Calendar,
  DollarSign
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pagamentos-diarias")({
  head: () => ({ meta: [{ title: "Pagamentos de Diárias — Central do Buffet" }] }),
  component: PagamentosDiariasPage,
});

function PagamentosDiariasPage() {
  const queryClient = useQueryClient();

  // Query trazendo as escalas pendentes e pagas com relacionamentos
  const { data: escalas = [], isLoading } = useQuery({
    queryKey: ["pagamentos_diarias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escala_evento")
        .select(`
          id,
          valor_diaria,
          horas_extras,
          valor_hora_extra,
          status_pagamento,
          pago_em,
          equipe_freelancers (
            nome,
            funcao,
            chave_pix,
            tipo_chave_pix
          ),
          events (
            id,
            event_date,
            clients ( name )
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Mutation para dar baixa no pagamento Pix
  const darBaixaMutation = useMutation({
    mutationFn: async (escalaId: string) => {
      const { error } = await supabase
        .from("escala_evento")
        .update({
          status_pagamento: "PAGO",
          pago_em: new Date().toISOString(),
        })
        .eq("id", escalaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagamentos_diarias"] });
      toast.success("Pagamento confirmado e registrado!");
    },
    onError: (err: any) => {
      toast.error(`Erro ao dar baixa: ${err.message}`);
    },
  });

  const handleCopyPix = (pix: string) => {
    navigator.clipboard.writeText(pix);
    toast.success("Chave Pix copiada!");
  };

  const pendentes = escalas.filter((e: any) => e.status_pagamento === "PENDENTE");
  const pagos = escalas.filter((e: any) => e.status_pagamento === "PAGO");

  const totalPendente = pendentes.reduce((sum: number, e: any) => {
    const total = Number(e.valor_diaria || 0) + Number(e.horas_extras || 0) * Number(e.valor_hora_extra || 0);
    return sum + total;
  }, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <Wallet className="size-7 text-emerald-600" /> Pagamento de Diárias (Pix)
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Copie as chaves Pix dos freelancers e confirme a quitação após transferir.
        </p>
      </div>

      {/* Card Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Total a Pagar</span>
            <div className="text-3xl font-black text-amber-900 mt-1">{brl(totalPendente)}</div>
            <p className="text-xs text-amber-700 mt-0.5">{pendentes.length} diária(s) pendente(s)</p>
          </div>
          <div className="p-3 bg-amber-500 text-white rounded-2xl">
            <Clock className="size-6" />
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Diárias Quitadas</span>
            <div className="text-3xl font-black text-emerald-900 mt-1">{pagos.length}</div>
            <p className="text-xs text-emerald-700 mt-0.5">Pagamentos concluídos</p>
          </div>
          <div className="p-3 bg-emerald-500 text-white rounded-2xl">
            <CheckCircle2 className="size-6" />
          </div>
        </div>
      </div>

      {/* Lista de Diárias Pendentes */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 text-base">Pendentes de Pagamento</h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Carregando diárias...</div>
        ) : pendentes.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Tudo em dia! Nenhuma diária pendente.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="p-4">Freelancer</th>
                  <th className="p-4">Evento / Data</th>
                  <th className="p-4">Chave Pix</th>
                  <th className="p-4 text-right">Valor Total</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pendentes.map((item: any) => {
                  const valorTotal =
                    Number(item.valor_diaria || 0) +
                    Number(item.horas_extras || 0) * Number(item.valor_hora_extra || 0);

                  return (
                    <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-800">{item.equipe_freelancers?.nome}</div>
                        <div className="text-xs text-slate-500">{item.equipe_freelancers?.funcao}</div>
                      </td>
                      <td className="p-4 text-slate-600">
                        <div className="font-medium text-slate-700">
                          {item.events?.clients?.name ?? "Evento em Geral"}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar className="size-3" />
                          {item.events?.event_date ? formatDateBR(item.events.event_date) : "—"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded-md border">
                            {item.equipe_freelancers?.chave_pix}
                          </span>
                          <button
                            onClick={() => handleCopyPix(item.equipe_freelancers?.chave_pix)}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                            title="Copiar Chave Pix"
                          >
                            <Copy className="size-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-right font-black text-slate-800 text-base">
                        {brl(valorTotal)}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => darBaixaMutation.mutate(item.id)}
                          disabled={darBaixaMutation.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                        >
                          <CheckCircle2 className="size-3.5" /> Marcar Pago
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
      }
                          
