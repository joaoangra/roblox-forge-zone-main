import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Star, TrendingUp, Trophy, Crown, ShoppingBag, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/points")({
  head: () => ({ meta: [{ title: "Sistema de Pontos – BuxHub" }] }),
  component: PointsPage,
});

function PointsPage() {
  const { user, isPremium } = useAuth();

  const { data: userPoints } = useQuery({
    queryKey: ["my-points-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_points")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return { points: 0, level: 0, lifetime_points: 0, ...(data ?? {}) };
    },
  });

  const { data: history } = useQuery({
    queryKey: ["my-points-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("points_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  const levels = [
    { level: 1, name: "Bronze", min: 0, icon: "🥉", color: "from-amber-700/20 to-amber-600/20" },
    { level: 2, name: "Prata", min: 500, icon: "🥈", color: "from-slate-400/20 to-slate-300/20" },
    { level: 3, name: "Ouro", min: 2000, icon: "🥇", color: "from-yellow-500/20 to-amber-500/20" },
    { level: 4, name: "Diamante", min: 5000, icon: "💎", color: "from-cyan-400/20 to-blue-500/20" },
    { level: 5, name: "Elite", min: 10000, icon: "👑", color: "from-purple-500/20 to-pink-500/20" },
  ];

  const up = (userPoints as any) || { points: 0, lifetime_points: 0, level: 0 };
  const currentLevel = levels.find((l) => up.lifetime_points >= l.min) ?? levels[0];
  const nextLevel = levels.find((l) => up.lifetime_points < l.min);

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400 mb-4">
            <Star className="h-3 w-3" /> Sistema de Pontos
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            Pontos <span className="text-gradient-brand">BuxHub</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Ganhe pontos comprando e vendendo na plataforma. Quanto mais você participa, mais
            recompensas ganha.
          </p>
        </div>

        {user ? (
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            <Card className="border-white/10 bg-card/50 lg:col-span-2">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div
                    className={`grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br ${currentLevel.color}`}
                  >
                    <span className="text-3xl">{currentLevel.icon}</span>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Nível {currentLevel.level} · {currentLevel.name}
                    </div>
                    <div className="text-3xl font-bold text-gradient-brand">{up.points}</div>
                    <div className="text-xs text-muted-foreground">pontos disponíveis</div>
                  </div>
                </div>
                {nextLevel && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progresso para {nextLevel.name}</span>
                      <span>
                        {up.lifetime_points} / {nextLevel.min}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500"
                        style={{
                          width: `${Math.min(100, (up.lifetime_points / nextLevel.min) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                  <Crown className="h-3 w-3 text-primary" />
                  {isPremium
                    ? "Multiplicador 1.5x ativo (Premium)"
                    : "Multiplicador 1x · Vire Premium para ganhar 1.5x"}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold">Como ganhar pontos</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <ShoppingBag className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                      <span className="font-medium">Comprar</span>
                      <p className="text-muted-foreground">
                        Ganhe pontos a cada compra no marketplace
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <TrendingUp className="h-4 w-4 text-green-400 mt-0.5" />
                    <div>
                      <span className="font-medium">Vender</span>
                      <p className="text-muted-foreground">
                        Ganhe pontos extras a cada venda realizada
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Crown className="h-4 w-4 text-yellow-400 mt-0.5" />
                    <div>
                      <span className="font-medium">Premium</span>
                      <p className="text-muted-foreground">
                        Multiplicador 1.5x em todas as transações
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  asChild
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 mt-4"
                >
                  <Link to="/shop">
                    Ver Loja Smiiley <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="border-white/10 bg-card/50 mb-8">
            <CardContent className="p-10 text-center">
              <Gift className="h-10 w-10 mx-auto mb-3 text-primary opacity-50" />
              <h3 className="font-semibold mb-2">Faça login para ver seus pontos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie sua conta e comece a acumular pontos.
              </p>
              <Button asChild>
                <Link to="/auth">Entrar / Criar conta</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-card/50 mb-8">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" /> Níveis de Pontuação
            </h3>
            <div className="grid sm:grid-cols-5 gap-3">
              {levels.map((l) => (
                <div
                  key={l.level}
                  className={`text-center p-4 rounded-lg bg-gradient-to-br ${l.color} ${up.lifetime_points >= l.min ? "ring-1 ring-primary/50" : "opacity-50"}`}
                >
                  <div className="text-2xl mb-1">{l.icon}</div>
                  <div className="font-semibold text-sm">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.min}+ pts</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {user && (
          <Card className="border-white/10 bg-card/50">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Histórico de Pontos</h3>
              {(history ?? []).length > 0 ? (
                <div className="space-y-2">
                  {(history ?? []).map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium capitalize">
                          {tx.type?.replace("_", " ")}
                        </div>
                        {tx.description && (
                          <div className="text-xs text-muted-foreground">{tx.description}</div>
                        )}
                      </div>
                      <div
                        className={`font-bold ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma transação ainda.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
