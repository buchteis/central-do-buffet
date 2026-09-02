import { useState } from "react";
import { Calendar } from "lucide-react";

type MonthFilterProps = {
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedMonth: string | null; // "01", "02", ..., "12" ou null para o ano todo
  onMonthChange: (month: string | null) => void;
  monthsWithData?: string[]; // Array de meses que têm dados, ex: ["01", "09", "10"]
};

const MONTHS = [
  { id: "01", label: "Jan" },
  { id: "02", label: "Fev" },
  { id: "03", label: "Mar" },
  { id: "04", label: "Abr" },
  { id: "05", label: "Mai" },
  { id: "06", label: "Jun" },
  { id: "07", label: "Jul" },
  { id: "08", label: "Ago" },
  { id: "09", label: "Set" },
  { id: "10", label: "Out" },
  { id: "11", label: "Nov" },
  { id: "12", label: "Dez" },
];

export default function MonthBarFilter({
  selectedYear,
  onYearChange,
  selectedMonth,
  onMonthChange,
  monthsWithData = [],
}: MonthFilterProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm space-y-3">
      {/* Cabeçalho do Filtro de Período */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Filtrar por Mês
          </span>
        </div>

        {/* Seletor de Ano */}
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(Number(e.target.value))}
          className="h-8 px-3 rounded-lg border border-border bg-background text-xs font-bold focus:ring-1 focus:ring-primary outline-none"
        >
          <option value={2026}>Ano 2026</option>
          <option value={2027}>Ano 2027</option>
        </select>
      </div>

      {/* Grade de Cards/Pills dos Meses */}
      <div className="grid grid-cols-4 sm:grid-cols-7 md:grid-cols-13 gap-1.5">
        {/* Botão "Todos os Meses" */}
        <button
          onClick={() => onMonthChange(null)}
          className={`h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center px-2 border ${
            selectedMonth === null
              ? "bg-primary text-primary-foreground border-primary shadow-sm"
              : "bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground"
          }`}
        >
          Todos
        </button>

        {/* Lista dos 12 Meses */}
        {MONTHS.map((m) => {
          const isSelected = selectedMonth === m.id;
          const hasData = monthsWithData.includes(m.id);

          return (
            <button
              key={m.id}
              onClick={() => onMonthChange(m.id)}
              className={`relative h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center border ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border/60 hover:border-border hover:bg-muted/30"
              }`}
            >
              {m.label}

              {/* Ponto/Indicador visual caso o mês tenha registros */}
              {hasData && !isSelected && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
