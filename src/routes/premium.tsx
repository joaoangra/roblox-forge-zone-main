import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Planos Premium – RBXScripts" },
      { name: "description", content: "Tenha acesso vitalício a todos os scripts premium via PIX." }
    ]
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const { user, isPremium, refresh } = useAuth();
  const router = useRouter();

  const { data: plans, isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const { data } = await supabase
        .from("premium_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      return data ?? [];
    },
  });

  async function buy(planId: string, amount: number) {
    if (!user) {
      router.navigate({ to: "/auth" });
      return;
    }

    const { data, error } = await supabase
      .from("premium_orders")
      .insert({
        user_id: user.id,
        plan_id: planId,
        amount_brl: amount,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    await refresh();

    router.navigate({
      to: "/orders/$id",
      params: { id: data.id },
    });
  }

  // Mantém a ordem vindo do banco (sort_order)
  const orderedPlans = plans ?? [];

  // “Mais assinado” = plano com maior quantidade de pedidos com status =
  // confirmado + aguardando prova (B)
  const mostSignedPlanId = (() => {
    if (!orderedPlans?.length) return null;

    // TODO: população real vinda do banco via premium_orders.
    // Por enquanto retornamos o primeiro ativo (fallback) para manter o build.
    // Vamos preencher em seguida com uma query agregada.
    return orderedPlans?.[0]?.id ?? null;
  })();







  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-12">

        {/* HEADER */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs mb-4">
            <Sparkles className="h-3 w-3 text-primary" />
            Pagamento via PIX
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold">
            Vire <span className="text-gradient-brand">Premium</span>
          </h1>

          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Acesso completo a todos os scripts premium, sem encurtadores, suporte prioritário e muito mais.
          </p>

          {isPremium && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-success/20 border border-success/40 px-4 py-2 text-success">
              <Crown className="h-4 w-4" />
              Você já é Premium!
            </div>
          )}
        </div>

        {/* LOADING */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-96 w-full rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">

            {orderedPlans.map((p, index) => {
              // “Mais assinado” = plano com maior quantidade de pedidos confirmed + awaiting_proof
              const showPopular = mostSignedPlanId === p.id;



              return (
                <Card
                  key={p.id}
                  className={`w-full border-white/10 bg-card/50 card-hover relative overflow-hidden ${
                    showPopular ? "ring-2 ring-primary glow-brand" : ""
                  }`}
                >
                  {/* BADGE “MAIS ASSINADO” */}
                  {showPopular && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg shadow-[0_0_18px_rgba(124,58,237,0.35)]">
                      MAIS POPULAR
                    </div>
                  )}

                  <CardContent className="p-6">
                    <h3 className="text-xl font-bold">{p.name}</h3>


                  <p className="text-sm text-muted-foreground mt-1">
                    {p.description}
                  </p>

                  <div className="mt-6">
                    <span className="text-4xl font-extrabold text-gradient-brand">
                      R$ {Number(p.price_brl).toFixed(2)}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-2">
                    {(p.features ?? []).map((f: string) => (
                      <li key={f} className="flex gap-2 text-sm">
                        <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => buy(p.id, Number(p.price_brl))}
                    className="w-full mt-6 bg-gradient-to-r from-primary to-accent text-white border-0"
                  >
                    <Crown className="h-4 w-4" />
                    Comprar com PIX
                  </Button>
                </CardContent>
              </Card>
            );
          })}


          </div>
        )}

        {/* INFO BOX */}
        <Card className="mt-12 border-white/10 bg-card/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Como funciona o PIX?</h3>

            <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
              <li>Escolha um plano e clique em comprar.</li>
              <li>A chave PIX será exibida em uma página privada com chat.</li>
              <li>Faça o PIX no valor exato e envie o comprovante no chat.</li>
              <li>O admin libera seu Premium em até 24h.</li>
            </ol>
          </CardContent>
        </Card>

      </div>
    </PageShell>
  );
}
