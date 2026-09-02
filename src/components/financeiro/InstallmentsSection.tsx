import { useState, useMemo } from "react";
import { brl, formatDateBR } from "@/lib/format";
import { ChevronDown, ChevronUp, Calendar, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";

type Transaction = {
  id: string;
  description: string;
  clientName?: string;
  date: string; // Formato YYYY-MM-DD
  status: "pago" | "pendente" | "agendado" | "cancelado";
  type: "recebido" | "a_receber" | "despesa";
  amount: number;
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export default function FinanceiroExtratoAccordion({ transactions = [] }: { transactions: Transaction[] }) {
  // Estado para controlar quais cards de meses estão abertos (por padrão, os 2 primeiros abrem)
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});

  // Agrupa os eventos/transações por mês e ano
  const groupedByMonth = useMemo(() => {
    const groups: Record<string, { key: string; label: string; year: number; monthIdx: number; total: number; items: Transaction[] }> = {};

    transactions.forEach((t) => {
      if (!t.date) return;
      const [yearStr, monthStr] = t.date.split("-");
      const year = Number(yearStr);
      const monthIdx = Number(monthStr) - 1;
      const key = `${year}-${monthStr}`;
      const label = `${MONTH_NAMES[monthIdx]} ${year}`;

      if (!groups[key]) {
        groups[key] = {
          key,
          label,
          year,
          monthIdx,
          total: 0,
          items: [],
        };
      }

      groups[key].items.push(t);
      groups[key].total += Number(t.amount || 0);
    });

    // Ordena do mês mais recente para o mais antigo
    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  }, [transactions]);

  const toggleMonth = (key: string) => {
    setOpenMonths((prev) => ({
      ...prev,
      // Se não estiver definido ainda, considera fechado e abre; se já estiver definido, inverte
      [key]: prev[key] === undefined ? true : !prev[key],
    }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Calendar className="size-4 text-primary" /> Eventos & Transações por Mês
        </h3>
        <span className="text-xs text-muted-foreground font-medium">
          {groupedByMonth.length} meses com registros
        </span>
      </div>

      {groupedByMonth.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-xs text-muted-foreground">
          Nenhum evento ou registro encontrado.
        </div>
      ) : (
        groupedByMonth.map((group, idx) => {
          // Por padrão, abre o primeiro mês se o usuário ainda não tiver interagido com o estado
          const isOpen = openMonths[group.key] !== undefined ? openMonths[group.key] : idx === 0;

          return (
            <div
              key={group.key}
              className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm transition-all"
            >
              {/* CABEÇALHO DO CARD DO MÊS */}
              <button
                onClick={() => toggleMonth(group.key)}
                className="w-full px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-lg bg-background border border-border/60 text-muted-foreground">
                    {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm tracking-tight text-foreground">
                      {group.label}
                    </h4>
                    <p className="text-[11px] text-muted-foreground font-medium">
                      {group.items.length} {group.items.length === 1 ? "registro" : "registros"}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm font-extrabold text-foreground">
                    {brl(group.total)}
                  </span>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Total Movimentado
                  </p>
                </div>
              </button>

              {/* CONTEÚDO EXPANSÍVEL COM OS EVENTOS DO MÊS */}
              {isOpen && (
                <div className="divide-y divide-border/30 border-t border-border/40">
                  {group.items.map((item) => {
                    const isDespesa = item.type === "despesa";
                    const isPago = item.status === "pago";

                    return (
                      <div
                        key={item.id}
                        className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-muted/10 transition-colors"
                      >
                        {/* Nome do Evento / Cliente */}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{item.description}</p>
                          {item.clientName && item.clientName !== item.description && (
                            <p className="text-[11px] text-muted-foreground truncate">{item.clientName}</p>
                          )}
                        </div>

                        {/* Data */}
                        <div className="w-24 text-center shrink-0">
                          <span className="text-muted-foreground font-medium">{formatDateBR(item.date)}</span>
                        </div>

                        {/* Status */}
                        <div className="w-28 text-center shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isPago
                                ? "bg-emerald-500/10 text-emerald-700"
                                : item.status === "agendado"
                                ? "bg-blue-500/10 text-blue-700"
                                : "bg-amber-500/10 text-amber-700"
                            }`}
                          >
                            {isPago ? "PAGO" : item.status === "agendado" ? "AGENDADO" : "PENDENTE"}
                          </span>
                        </div>

                        {/* Valor */}
                        <div className="w-32 text-right shrink-0">
                          <span
                            className={`font-bold text-xs ${
                              isDespesa ? "text-rose-600" : "text-emerald-600"
                            }`}
                          >
                            {isDespesa ? `- ${brl(item.amount)}` : brl(item.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      )}
    </div>
  );
}
