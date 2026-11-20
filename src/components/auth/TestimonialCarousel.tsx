import { useEffect, useState } from "react";
import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    text: "O chatbot atende meus clientes no WhatsApp sozinho. Nunca mais perdi um orçamento por demora na resposta.",
    name: "Marcos R.",
    business: "Buffet Sabor & Festa",
  },
  {
    text: "A calculadora de insumos mudou minha vida. Sei exatamente o que comprar para cada evento, sem desperdício.",
    name: "Ana Paula C.",
    business: "Espaço Encantado",
  },
  {
    text: "A agenda linkada com o Google acabou com as datas duplicadas. Minha equipe inteira vê os eventos em tempo real.",
    name: "Roberto L.",
    business: "Buffet Real Festas",
  },
  {
    text: "Contrato em PDF com assinatura digital em minutos. O cliente assina pelo celular e já cai no meu financeiro.",
    name: "Juliana M.",
    business: "Festa & Cia Eventos",
  },
  {
    text: "Organizei clientes, estoque e pagamentos em um lugar só. Hoje fecho o mês sabendo exatamente quanto lucrei.",
    name: "Carlos Eduardo S.",
    business: "Buffet Estrela do Sul",
  },
];

const ROTATE_MS = 6000;

export function TestimonialCarousel() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % TESTIMONIALS.length);
        setVisible(true);
      }, 400);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  const current = TESTIMONIALS[index] ?? TESTIMONIALS[0];

  return (
    <div className="mb-6 rounded-2xl border border-border bg-card/80 backdrop-blur p-5 shadow-sm">
      <div
        className={`transition-opacity duration-400 ${visible ? "opacity-100" : "opacity-0"}`}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Quote className="size-4" />
          </span>
          <div className="min-h-[4.5rem]">
            <p className="text-sm leading-relaxed text-foreground">
              “{current?.text}”
            </p>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {current?.name} · {current?.business}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-3 flex justify-center gap-1.5">
        {TESTIMONIALS.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
