import { createFileRoute } from "@tanstack/react-router";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, ExternalLink, Link2, Share2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/link-publico")({
  head: () => ({ meta: [{ title: "Link Público — Meu Churras" }] }),
  component: LinkPublicoPage,
});

function LinkPublicoPage() {
  const { data: access } = useTenantAccess();
  const slug = access?.tenant?.slug;
  const publicUrl =
    slug && typeof window !== "undefined"
      ? `${window.location.origin}/orcamento/${slug}`
      : "";

  const shareText = `Solicite seu orçamento com ${access?.tenant?.name ?? "nosso buffet"}: ${publicUrl}`;

  async function copy() {
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado!");
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: access?.tenant?.name ?? "Buffet", text: shareText, url: publicUrl });
      } catch {}
    } else {
      copy();
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Link Público</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe o link do seu formulário. Cada solicitação enviada aparece automaticamente em <strong>Leads</strong>.
        </p>
      </div>

      {publicUrl ? (
        <>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Link2 className="size-4" /> Seu link exclusivo
            </div>
            <div className="bg-muted/40 border border-border rounded-lg p-4 font-mono text-sm break-all">
              {publicUrl}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copy} variant="outline" size="sm">
                <Copy className="size-4" /> Copiar
              </Button>
              <Button onClick={share} variant="outline" size="sm">
                <Share2 className="size-4" /> Compartilhar
              </Button>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="sm" type="button">
                  <ExternalLink className="size-4" /> Abrir
                </Button>
              </a>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              QR Code
            </div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(publicUrl)}`}
              alt="QR Code do link público"
              width={240}
              height={240}
              className="rounded-lg border border-border bg-white p-2"
            />
            <p className="text-xs text-muted-foreground">
              Imprima ou compartilhe o QR Code para receber solicitações diretamente pelo celular.
            </p>
          </div>
        </>
      ) : (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Seu buffet ainda não está ativo. Aguarde a aprovação do administrador.
          </p>
        </div>
      )}
    </div>
  );
}
