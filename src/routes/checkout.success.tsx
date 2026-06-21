import { createFileRoute, useRouter, useSearch, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Package, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    order_id: search.order_id as string | undefined,
    listing: search.listing as string | undefined,
  }),
  head: () => ({ meta: [{ title: "Pagamento Confirmado — BuxHub" }] }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  const { order_id, listing } = Route.useSearch();
  const router = useRouter();

  const { data: order, isLoading } = useQuery({
    queryKey: ["checkout-success", order_id],
    queryFn: async () => {
      if (!order_id) return null;
      const res = await fetch(`/marketplace/order-payment-status?order_id=${order_id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!order_id,
    refetchInterval: 3000,
  });

  const status = (order as any)?.order?.status ?? (order as any)?.status;
  const title = order?.listing_title || "";
  const isPaid = status === "paid" || status === "held" || status === "active" || status === "confirmed";

  if (!order_id) {
    return (
      <PageShell>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <Card>
            <CardContent className="p-12 space-y-4">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto" />
              <h1 className="text-xl font-bold">Pedido não encontrado</h1>
              <p className="text-muted-foreground text-sm">Nenhum ID de pedido foi fornecido.</p>
              <Button asChild><Link to="/market">Ir para o Market</Link></Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-lg px-4 py-12">
        <Card className="border-green-500/30">
          <CardContent className="p-8 text-center space-y-6">
            {isLoading ? (
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            ) : isPaid ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">Pagamento Confirmado!</h1>
                  <p className="text-muted-foreground text-sm">
                    Seu pedido{title ? ` de "${title}"` : ""} foi processado com sucesso.
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-4 text-left text-sm space-y-2">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Pedido</span>
                    <span className="font-mono text-xs">{order_id.slice(0, 8)}...</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className="text-green-500 font-semibold">Pago</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Entrega</span>
                    <span>Pendente — aguarde o vendedor</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button asChild className="w-full"><Link to="/orders/$id" params={{ id: order_id }}>Acompanhar Pedido</Link></Button>
                  <Button variant="outline" asChild><Link to={listing ? "/market/$slug" : "/market"} params={listing ? { slug: listing } : undefined as any}>Voltar ao Market</Link></Button>
                </div>
              </>
            ) : (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
                <h1 className="text-xl font-bold">Aguardando confirmação...</h1>
                <p className="text-muted-foreground text-sm">Estamos verificando o status do seu pagamento.</p>
                <Button variant="outline" asChild><Link to={listing ? "/market/$slug" : "/market"} params={listing ? { slug: listing } : undefined as any}>Voltar</Link></Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
