import { createFileRoute, useRouter, useSearch, Link } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadStripe, StripeElementsOptions } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ShieldCheck, Lock, Store, ShoppingCart, Package, CreditCard, BanknoteIcon, Loader2 } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    listing_id: search.listing_id as string | undefined,
    option_id: search.option_id as string | undefined,
    quantity: Number(search.quantity ?? 1),
    order_id: search.order_id as string | undefined,
  }),
  head: () => ({ meta: [{ title: "Checkout — BuxHub" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const search = Route.useSearch();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) router.navigate({ to: "/auth" });
  }, [authLoading, user, router]);

  if (!user) return null;

  return (
    <CheckoutInner
      listingId={search.listing_id!}
      optionId={search.option_id}
      quantity={search.quantity}
      orderId={search.order_id}
    />
  );
}

function CheckoutInner({ listingId, optionId, quantity, orderId: existingOrderId }: { listingId: string; optionId?: string; quantity: number; orderId?: string }) {
  const { user } = useAuth();
  const [stripePromise, setStripePromise] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(existingOrderId ?? null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/marketplace/stripe-publishable-key");
      const { key } = await res.json();
      if (key) setStripePromise(loadStripe(key));
    })();
  }, []);

  const { data: listing, isLoading: listingLoading } = useQuery({
    queryKey: ["checkout-listing", listingId, existingOrderId],
    queryFn: async () => {
      if (existingOrderId) {
        const res = await fetch(`/marketplace/order-payment-status?order_id=${existingOrderId}`);
        const data = await res.json();
        if (data?.order) {
          const order = data.order;
          const { data: l } = await supabase
            .from("listings")
            .select("id, title, slug, price_cents, cover_image_url, seller_id, delivery_type")
            .eq("id", (order as any).listing_id ?? listingId)
            .maybeSingle();
          return l;
        }
      }
      const { data } = await supabase
        .from("listings")
        .select("id, title, slug, price_cents, cover_image_url, seller_id, delivery_type")
        .eq("id", listingId)
        .maybeSingle();
      return data;
    },
  });

  const { data: option } = useQuery({
    queryKey: ["checkout-option", listingId, optionId],
    queryFn: async () => {
      if (!optionId) return null;
      const { data } = await (supabase as any)
        .from("listing_options")
        .select("*")
        .eq("id", optionId)
        .maybeSingle();
      return data as any;
    },
    enabled: !!optionId,
  });

  const { data: seller } = useQuery({
    queryKey: ["checkout-seller", listing?.seller_id],
    queryFn: async () => {
      if (!listing?.seller_id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("username, display_name, is_premium")
        .eq("id", listing.seller_id)
        .maybeSingle();
      return data;
    },
    enabled: !!listing?.seller_id,
  });

  const baseCents = listing?.price_cents ?? 0;
  const adjustmentCents = (option as any)?.price_adjustment_cents ?? 0;
  const unitCents = baseCents + adjustmentCents;
  const totalCents = unitCents * quantity;
  const platformFeePct = seller?.is_premium ? 0.06 : 0.10;
  const platformFee = Math.round(totalCents * platformFeePct);
  const sellerAmount = totalCents - platformFee;

  const createPayment = useCallback(async () => {
    if ((!listingId && !existingOrderId) || !user) return;
    setCreating(true);
    setPaymentError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const body: any = {};
      if (existingOrderId) body.order_id = existingOrderId;
      else {
        body.listing_id = listingId;
        if (optionId) body.option_id = optionId;
        body.quantity = quantity;
      }
      const res = await fetch("/marketplace/create-payment-intent", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setPaymentError(data.error ?? "Erro ao criar pagamento");
        setCreating(false);
        return;
      }
      setClientSecret(data.clientSecret);
      setOrderId(data.marketplaceOrderId);
    } catch (e: any) {
      setPaymentError(e?.message ?? "Erro ao iniciar pagamento");
    }
    setCreating(false);
  }, [listingId, optionId, quantity, existingOrderId, user]);

  useEffect(() => {
    if ((listingId || existingOrderId) && user) createPayment();
  }, [listingId, existingOrderId, user, createPayment]);

  if (listingLoading || !listing) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          Carregando checkout...
        </div>
      </PageShell>
    );
  }

  if (paymentError && !clientSecret) {
    return (
      <PageShell>
        <div className="mx-auto max-w-3xl px-4 py-12">
          <Card className="border-red-500/30">
            <CardContent className="p-8 text-center space-y-4">
              <p className="text-red-500">{paymentError}</p>
              <Button onClick={createPayment}>Tentar novamente</Button>
              <Button variant="outline" asChild><Link to="/market/$slug" params={{ slug: listing.slug }}>Voltar</Link></Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link to="/market/$slug" params={{ slug: listing.slug }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Voltar para o anúncio
        </Link>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Main — Payment */}
          <div className="lg:col-span-3 space-y-4">
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="font-semibold flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Pagamento
                </h2>

                {clientSecret && stripePromise ? (
                  <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#6366f1", colorBackground: "#1a1a2e", colorText: "#ffffff", colorDanger: "#ef4444", fontFamily: "Inter, system-ui, sans-serif", borderRadius: "8px" } } } as StripeElementsOptions}>
                    <PaymentForm amountCents={totalCents} orderId={orderId!} listingSlug={listing.slug} />
                  </Elements>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3" />
                    {creating ? "Preparando pagamento..." : "Inicializando..."}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Pagamento processado com segurança pelo Stripe. Seus dados não ficam armazenados na BuxHub.
            </div>
          </div>

          {/* Sidebar — Summary */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Resumo do Pedido
                </h3>

                <div className="flex gap-3">
                  <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden shrink-0">
                    {listing.cover_image_url && <img src={listing.cover_image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{listing.title}</p>
                    <p className="text-xs text-muted-foreground">Vendido por {seller?.display_name || seller?.username || "—"}</p>
                  </div>
                </div>

                {option && (
                  <div className="text-sm bg-white/5 rounded-lg px-3 py-2 flex justify-between">
                    <span className="text-muted-foreground">{(option as any).label}</span>
                    <span>{(option as any).price_adjustment_cents !== 0 ? `${(option as any).price_adjustment_cents > 0 ? "+" : ""}R$ ${Math.abs((option as any).price_adjustment_cents / 100).toFixed(2)}` : "Incluso"}</span>
                  </div>
                )}

                {quantity > 1 && (
                  <div className="text-sm text-muted-foreground flex justify-between">
                    <span>Quantidade</span>
                    <span>{quantity}x</span>
                  </div>
                )}

                <div className="border-t border-white/10 pt-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Valor base</span>
                    <span>R$ {(unitCents / 100).toFixed(2)}</span>
                  </div>
                  {quantity > 1 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Subtotal ({quantity}x)</span>
                      <span>R$ {(totalCents / 100).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Comissão ({Math.round(platformFeePct * 100)}%)</span>
                    <span>- R$ {(platformFee / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg pt-2 border-t border-white/10">
                    <span>Total</span>
                    <span className="text-primary">R$ {(totalCents / 100).toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-green-500" /> Pagamento retido por 7 dias (escrow)</div>
                  <div className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-green-500" /> Suporte a disputas inclusa</div>
                  <div className="flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-green-500" /> Compra 100% segura</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function PaymentForm({ amountCents, orderId, listingSlug }: { amountCents: number; orderId: string; listingSlug: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setErrorMsg(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success?order_id=${orderId}&listing=${listingSlug}`,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMsg(error.message ?? "Erro ao processar pagamento");
      setProcessing(false);
      return;
    }

    // If redirect: "if_required" didn't redirect, payment was successful
    router.navigate({ to: "/checkout/success", search: { order_id: orderId, listing: listingSlug } as any });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 h-12 text-base"
      >
        {processing ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando...</>
        ) : (
          <>Pagar R$ {(amountCents / 100).toFixed(2)}</>
        )}
      </Button>
      <p className="text-[10px] text-center text-muted-foreground">
        <Lock className="h-3 w-3 inline mr-1" />
        Pagamento seguro via Stripe
      </p>
    </form>
  );
}
