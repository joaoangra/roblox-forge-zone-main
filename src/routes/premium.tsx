import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Crown, Sparkles, ShieldCheck, Clock, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Planos Premium – RBXScripts" },
      {
        name: "description",
        content: "Tenha acesso vitalício a todos os scripts premium via PIX.",
      },
    ],
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

      // Types do Supabase aqui não estão inferidos no projeto.
      // Para manter o build consistente, tipamos localmente.
      return (data ?? []) as Array<{
        id: string;
        name: string;
        description: string;
        price_brl: number;
        features?: string[] | null;
      }>;
    },
  });

  async function buy(planId: string, amount: number) {
    if (!user) {
      router.navigate({ to: "/auth" });
      return;
    }

    // Supabase não inferiu tipos no projeto atual.
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

  const { data: popularPlan, isLoading: isLoadingPopular } = useQuery({
    queryKey: ["premium-popular-plan"],
    enabled: orderedPlans.length > 0,
    queryFn: async () => {
      // Contabiliza pedidos por plano usando os status que você mencionou:
      // - confirmed
      // - awaiting_proof
      const { data, error } = await supabase
        .from("premium_orders")
        .select("plan_id")
        .in("status", ["confirmed", "awaiting_proof"])
        .limit(5000);

      if (error) throw error;

      // Se o Supabase client estiver limitado a não suportar group/order com typings,
      // fazemos a contagem no client.
      const rows = data ?? [];

      let best: { plan_id: string; count: number } | null = null;
      for (const r of rows) {
        const count = rows.filter((row) => row.plan_id === r.plan_id).length;
        if (!best || count > best.count) {
          best = { plan_id: r.plan_id, count };
        }
      }

      return best?.plan_id ?? null;
    },
  });

  const mostSignedPlanId = popularPlan ?? orderedPlans[0]?.id ?? null;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-12">
        {/* HEADER */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs mb-4">
            <Sparkles className="h-3 w-3 text-primary" />
            Premium RBXScripts • PIX seguro
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            Vire <span className="text-gradient-brand">Premium</span> e desbloqueie
            <span className="block text-gradient-brand">scripts pra qualquer Roblox</span>
          </h1>

          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Acesso vitalício aos scripts premium + benefícios na Smiiley Store: <b>6% OFF</b> e
            <b> 1.5x pontos</b> em compras e vendas.
          </p>

          {isPremium && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-success/20 border border-success/40 px-4 py-2 text-success">
              <Crown className="h-4 w-4" />
              Você já é Premium!
            </div>
          )}
        </div>

        {/* TABELA DE PLANOS */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-96 w-full rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-6">
              {orderedPlans.map((p) => {
                const showPopular = mostSignedPlanId === p.id;
                const features = (p.features ?? []).filter(Boolean) as string[];

                return (
                  <Card
                    key={p.id}
                    className={`w-full border-white/10 bg-card/50 card-hover relative overflow-hidden ${
                      showPopular ? "ring-2 ring-primary glow-brand" : ""
                    }`}
                  >
                    {showPopular && (
                      <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-accent text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg shadow-[0_0_18px_rgba(124,58,237,0.35)]">
                        MAIS POPULAR • {isLoadingPopular ? "..." : ""}
                      </div>
                    )}

                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-extrabold tracking-tight">{p.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                        </div>
                        <div className="hidden sm:block">
                          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                            <Crown className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="text-5xl font-extrabold text-gradient-brand">
                          R$ {Number(p.price_brl).toFixed(2)}
                        </div>
                        <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                          Pagamento via PIX • Liberação aprox. 24h
                        </div>
                      </div>

                      <div className="mt-6">
                        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                          <ShieldCheck className="h-4 w-4 text-primary" />O que está incluso
                        </div>
                        <ul className="space-y-2">
                          {(features.length
                            ? features
                            : [
                                "Acesso vitalício aos scripts premium",
                                "Benefícios na Smiiley Store",
                                "Suporte prioritário",
                              ]
                          ).map((f) => (
                            <li key={f} className="flex gap-2 text-sm">
                              <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                              <span className="leading-snug">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Button
                        onClick={() => buy(p.id, Number(p.price_brl))}
                        className="w-full mt-6 bg-gradient-to-r from-primary to-accent text-white border-0"
                      >
                        <Crown className="h-4 w-4" />
                        Assinar com PIX
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </Button>

                      <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
                        <Clock className="h-4 w-4 text-primary shrink-0" />
                        <span>
                          Após enviar o comprovante no chat, a liberação do Premium acontece em até
                          24h.
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* INFO BOX */}
        <Card className="mt-12 border-white/10 bg-card/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-2">Por que Premium vale a pena (Roblox)</h3>

            <div className="mt-4 grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Desbloqueio instantâneo
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    Acesso vitalício a todos os scripts premium do catálogo.
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    Suporte prioritário pra você não ficar travado na hora.
                  </li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
                  <Crown className="h-4 w-4 text-primary" />
                  Vantagens na Smiiley Store
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <b>6% OFF</b> em produtos selecionados (pagamento com pontos/PIX conforme loja).
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-success shrink-0 mt-0.5" />
                    <b>1.5x de pontos</b> em compras e vendas pra você evoluir mais rápido.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-semibold mb-2">Como funciona o PIX?</h3>

              <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1">
                <li>Escolha um plano e clique em comprar.</li>
                <li>A chave PIX será exibida em uma página privada com chat.</li>
                <li>Faça o PIX no valor exato e envie o comprovante no chat.</li>
                <li>O admin libera seu Premium em até 24h.</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
