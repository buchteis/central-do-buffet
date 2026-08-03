import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateBR, brl } from "@/lib/format";
import { ArrowLeft, User, Calendar, MapPin, Package } from "lucide-react";

export const Route = createFileRoute("/_authenticated/orcamentos/$id")({
  component: QuoteDetail,
});

function QuoteDetail() {
  const { id } = Route.useParams();

  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotes")
        .select(
          `
          *,
          clients(name, phone, email, city),
          packages(id, name)
        `,
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as any;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold">Orçamento não encontrado</h2>
        <Link to="/orcamentos" className="text-primary mt-2 inline-block">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const q: any = quote;
  const adults = q.adults ?? 0;
  const children = (q.children_7_10 ?? 0) + (q.children_0_6 ?? 0);

  const unitItems: { name: string; unit?: string; unit_price: number; qty: number }[] = (() => {
    const snap = (q.extras as any)?.unit_items;
    if (!Array.isArray(snap)) return [];
    return snap
      .map((i: any) => ({
        name: i?.name ?? "Item",
        unit: i?.unit ?? "un",
        unit_price: Number(i?.unit_price ?? 0) || 0,
        qty: Number(i?.qty ?? 0) || 0,
      }))
      .filter((i) => i.qty > 0);
  })();

  // Pacotes do orçamento: prioriza extras.packages (lista, múltiplos) — fallback relação.
  const packagesList: { name: string; price_per_person?: number }[] = (() => {
    const snap = (q.extras as any)?.packages;
    if (Array.isArray(snap) && snap.length > 0) {
      return dedupePackages(
        snap.map((p: any) => ({ name: p?.name, price_per_person: Number(p?.price_per_person ?? 0) || 0 })),
        unitItems,
      );
    }
    return q.packages?.name ? [{ name: q.packages.name }] : [];
  })();

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Link to="/orcamentos" className="p-2 hover:bg-muted rounded-full">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Orçamento #{q.id?.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">{formatDateBR(new Date(q.created_at))}</p>
        </div>
        <Badge className="ml-auto">{q.status || "Rascunho"}</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="size-4" /> Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{q.clients?.name || "Não informado"}</p>
            <p className="text-muted-foreground">{q.clients?.phone || "Sem telefone"}</p>
            <p className="text-muted-foreground">{q.clients?.email || "Sem e-mail"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="size-4" /> Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>📅 {formatDateBR(new Date(q.event_date))}</p>
            <p>⏰ {q.event_time || "Não informado"}</p>
            <p>👥 {adults} adultos</p>
            {children > 0 && <p>👶 {children} crianças</p>}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="size-4" /> Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{q.event_address || "Não informado"}</p>
            <p className="text-muted-foreground">{q.clients?.city || "Cidade não informada"}</p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="size-4" /> Pacotes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {packagesList.length > 0 ? (
              packagesList.map((p, i) => (
                <div key={i} className="flex justify-between">
                  <span className="font-semibold">{p.name}</span>
                  {typeof p.price_per_person === "number" && p.price_per_person > 0 && (
                    <span className="text-muted-foreground font-mono">
                      {brl(p.price_per_person)}/pessoa × {adults} = {brl(p.price_per_person * adults)}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Nenhum pacote vinculado.</p>
            )}
          </CardContent>
        </Card>

        {unitItems.length > 0 && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">Itens com preço unitário</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {unitItems.map((it, i) => (
                <div key={i} className="flex justify-between">
                  <span className="font-semibold">{it.name}</span>
                  <span className="text-muted-foreground font-mono">
                    {it.qty} {it.unit} × {brl(it.unit_price)} = {brl(it.qty * it.unit_price)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Valores</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="font-mono font-bold text-lg">{brl(q.total_value)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Entrada</div>
              <div className="font-mono">{brl(q.entry_value)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Saldo</div>
              <div className="font-mono">{brl(q.balance_value)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {q.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{q.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
