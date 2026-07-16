import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BreakdownOrcamento } from "@/components/breakdown/BreakdownOrcamento";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateBR, brl } from "@/lib/format";
import { ArrowLeft, User, Calendar, MapPin } from "lucide-react";

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
        .select(`
          *,
          clients(name, phone, email),
          packages(id, name, price_per_person, min_guests, max_guests)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
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
        <Link to="/dashboard/orcamentos" className="text-primary mt-2 inline-block">
          Voltar para lista
        </Link>
      </div>
    );
  }

  const packageDetails = quote.packages ? [quote.packages] : [];
  const guestCount = quote.guest_count || 0;
  const childrenCount = quote.children_count || 0;
  const childrenPrice = quote.children_price || 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Link to="/dashboard/orcamentos" className="p-2 hover:bg-muted rounded-full">
          <ArrowLeft className="size-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Orçamento #{quote.id?.slice(0, 8)}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDateBR(new Date(quote.created_at))}
          </p>
        </div>
        <Badge className="ml-auto">
          {quote.status || "Rascunho"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="size-4" /> Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-semibold">{quote.clients?.name || "Não informado"}</p>
            <p className="text-muted-foreground">{quote.clients?.phone || "Sem telefone"}</p>
            <p className="text-muted-foreground">{quote.clients?.email || "Sem e-mail"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="size-4" /> Evento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>📅 {formatDateBR(new Date(quote.event_date))}</p>
            <p>⏰ {quote.event_time || "Não informado"}</p>
            <p>👥 {quote.guest_count || 0} adultos</p>
            {quote.children_count > 0 && (
              <p>👶 {quote.children_count} crianças</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="size-4" /> Endereço
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p>{quote.event_address || "Não informado"}</p>
            <p className="text-muted-foreground">{quote.city || "Cidade não informada"}</p>
          </CardContent>
        </Card>
      </div>

      <BreakdownOrcamento
        packages={packageDetails}
        guestCount={guestCount}
        childrenCount={childrenCount}
        childrenPrice={childrenPrice}
        className="mt-4"
      />

      {quote.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{quote.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
