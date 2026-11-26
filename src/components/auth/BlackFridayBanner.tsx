import { Percent } from "lucide-react";

export function BlackFridayBanner() {
  return (
    <section aria-label="Black Friday — Central do Buffet" className="black-friday-banner relative mb-5 flex min-h-40 flex-wrap items-center justify-between gap-4 overflow-hidden rounded-lg px-6 py-5">
      <div className="relative z-10 min-w-0">
        <p className="black-friday-brand mb-2 text-xs font-semibold">CENTRAL DO BUFFET</p>
        <h2 className="black-friday-title text-4xl font-black italic leading-none sm:text-5xl">
          <span className="block">BLACK</span>
          <span className="block">FRIDAY</span>
        </h2>
        <div aria-hidden="true" className="black-friday-underline mt-3 h-0.5 w-40" />
      </div>
      <span aria-hidden="true" className="black-friday-tag relative z-10 flex size-14 shrink-0 rotate-12 items-center justify-center rounded-sm">
        <Percent className="size-8" strokeWidth={2.5} />
      </span>
      <div className="relative z-10 w-full">
        <p className="text-lg font-bold leading-snug">Teste gratuito por 60 dias</p>
        <p className="mt-1 text-sm font-medium leading-relaxed">Implementação grátis do sistema</p>
      </div>
    </section>
  );
}