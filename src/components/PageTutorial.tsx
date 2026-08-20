import { useEffect, useState } from "react";
import { GraduationCap, X } from "lucide-react";
import { useTenantAccess } from "@/hooks/useTenantAccess";

type Tip = { title: string; steps: string[] };

const TIPS: Record<string, Tip> = {
  "/dashboard": {
    title: "Dashboard",
    steps: [
      "Aqui você vê os números do seu buffet em tempo real.",
      "Use os filtros de período para comparar dia, semana, mês ou ano.",
      "Os cards levam direto para o módulo correspondente.",
    ],
  },
  "/orcamentos": {
    title: "Orçamentos",
    steps: [
      "Crie orçamentos em “Novo” e acompanhe pelo Kanban.",
      "Arraste o cartão para mudar o estágio da negociação.",
      "Ao marcar como Fechado, o evento é criado automaticamente.",
    ],
  },
  "/eventos": {
    title: "Eventos",
    steps: [
      "Todos os eventos confirmados ficam listados aqui.",
      "Em “Agendado” o estoque é reservado; em “Em andamento” a baixa é feita.",
      "Use os cards de status e o filtro de data para achar rápido.",
    ],
  },
  "/contratos": {
    title: "Contratos",
    steps: [
      "Gere o contrato a partir de um orçamento fechado.",
      "O modelo é editável em Configurações, com variáveis automáticas.",
      "Baixe em PDF ou envie pelo WhatsApp em um clique.",
    ],
  },
  "/pacotes": {
    title: "Pacotes",
    steps: [
      "Monte pacotes com preço por pessoa ou faixas por convidados.",
      "Em “Produtos consumidos” você liga o pacote ao estoque.",
      "Itens adicionais (taxas, aluguel) ficam em aba separada.",
    ],
  },
  "/estoque": {
    title: "Estoque",
    steps: [
      "Cadastre categorias e produtos com unidade de medida.",
      "Acompanhe Reservado e Disponível, além do mínimo de alerta.",
      "Você pode lançar entradas por nota fiscal usando o assistente.",
    ],
  },
  "/agenda": {
    title: "Calendário",
    steps: [
      "Visão mensal de todos os eventos e compromissos.",
      "Clique em um dia para ver os detalhes dos eventos.",
      "Use a navegação para avançar ou voltar no tempo.",
    ],
  },
  "/clientes": {
    title: "Clientes",
    steps: [
      "Cadastre manualmente ou importe uma planilha CSV.",
      "A busca aceita nome, CPF, e-mail ou telefone.",
      "Abra o cliente para editar dados e ver o histórico.",
    ],
  },
  "/funcionarios": {
    title: "Profissionais",
    steps: [
      "Cadastre equipe e freelancers com função e diária.",
      "Salve WhatsApp e chave Pix para pagar mais rápido.",
      "O assistente escala a equipe automaticamente por evento.",
    ],
  },
  "/financeiro": {
    title: "Financeiro",
    steps: [
      "Acompanhe entradas, despesas e saldo atual.",
      "O Kanban de cobranças mostra fechados, em pagamento e quitados.",
      "Crie parcelas e envie o link de pagamento com Pix ao cliente.",
    ],
  },
  "/feedbacks": {
    title: "Avaliações",
    steps: [
      "Envie o link público de avaliação após o evento.",
      "Veja o NPS e as notas por critério.",
      "Filtre por período para medir a evolução.",
    ],
  },
  "/notas-fiscais": {
    title: "Notas Fiscais",
    steps: [
      "Configure seus dados fiscais antes da primeira emissão.",
      "Emita a NFS-e direto do evento ou do orçamento.",
      "PDF e XML ficam salvos no histórico.",
    ],
  },
  "/relatorios": {
    title: "Relatórios",
    steps: [
      "Analise faturamento, eventos e consumo por período.",
      "Compare meses para entender a sazonalidade.",
      "Use os dados para ajustar preços dos pacotes.",
    ],
  },
  "/configuracoes": {
    title: "Configurações",
    steps: [
      "Preencha dados do buffet, logo, Pix e conta bancária.",
      "Edite o modelo de contrato e as mensagens de WhatsApp.",
      "Esses dados alimentam PDFs, contratos e links públicos.",
    ],
  },
  "/pagamentos-diarias": {
    title: "Pagamento de diárias",
    steps: [
      "Veja as diárias por evento e marque como pagas.",
      "Copie a chave Pix do profissional em um clique.",
    ],
  },
  "/leads": {
    title: "Leads",
    steps: [
      "Contatos recebidos pelo formulário público chegam aqui.",
      "Converta o lead em orçamento sem digitar de novo.",
    ],
  },
};

function baseKey(pathname: string) {
  const match = Object.keys(TIPS)
    .filter((k) => pathname === k || pathname.startsWith(`${k}/`))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? null;
}

export function PageTutorial({ pathname }: { pathname: string }) {
  const { data: access } = useTenantAccess();
  const route = baseKey(pathname);
  // O tutorial aparece apenas uma única vez por usuário, logo após o registro/primeiro acesso.
  const storageKey = access?.userId ? `cdb_tutorial_v1:${access.userId}:done` : null;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!storageKey || !route) {
      setVisible(false);
      return;
    }
    try {
      setVisible(window.localStorage.getItem(storageKey) !== "done");
    } catch {
      setVisible(false);
    }
  }, [storageKey, route]);

  if (!visible || !route || !storageKey) return null;
  const tip = TIPS[route]!;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "done");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  return (
    <div className="mb-5 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GraduationCap className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">
            Como usar: {tip.title}
          </p>
          <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
            {tip.steps.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary/60" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <button
            onClick={dismiss}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Entendi, não mostrar novamente
          </button>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar tutorial"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
