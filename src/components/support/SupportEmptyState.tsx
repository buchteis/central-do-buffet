import supportIllustration from "@/assets/support-illustration.png.asset.json";

export function SupportEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-2 text-center">
      <img src={supportIllustration.url} alt="Atendente com fone e cliente conversando, rodeados de mensagens e corações" width={336} height={247}
        className="support-empty-float aspect-[336/247] w-[336px] max-w-full shrink-0 object-contain" />
      <div className="space-y-2">
        <h3 className="text-xl font-medium text-foreground md:text-2xl">Nenhuma mensagem por aqui ainda!</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">Que tal iniciar uma conversa com o suporte?<br />Estamos prontos para te ajudar!</p>
      </div>
    </div>
  );
}