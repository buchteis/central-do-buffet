import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode as QrIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReviewQrCode({ link, fileName = "qrcode-avaliacao" }: { link: string; fileName?: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    if (!link) return;
    let active = true;
    QRCode.toDataURL(link, { width: 512, margin: 2, errorCorrectionLevel: "M" })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => setDataUrl(""));
    return () => {
      active = false;
    };
  }, [link]);

  if (!link) return null;

  return (
    <div className="p-4 bg-card border border-border rounded-2xl flex flex-col sm:flex-row items-center gap-4">
      <div className="shrink-0 p-2 bg-background rounded-xl border border-border">
        {dataUrl ? (
          <img src={dataUrl} alt="QR Code do link público de avaliação" className="size-32 object-contain" />
        ) : (
          <div className="size-32 flex items-center justify-center text-muted-foreground">
            <QrIcon className="size-8" />
          </div>
        )}
      </div>
      <div className="flex-1 text-center sm:text-left space-y-2">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            QR Code de avaliação
          </span>
          <p className="text-sm text-muted-foreground">
            Aponte a câmera e vá direto para a página de avaliação. Imprima ou compartilhe.
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-xl font-bold"
          disabled={!dataUrl}
          onClick={() => {
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = `${fileName}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
        >
          <Download className="size-3.5" /> Baixar QR Code
        </Button>
      </div>
    </div>
  );
}
