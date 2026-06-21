import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import {
  Gift, Star, Trophy, Crown, ShoppingBag, ArrowRight,
  Upload, Heart, Sparkles, Clock, Flame, ShieldCheck, Info,
  TrendingUp, Zap,
} from "lucide-react";

export const Route = createFileRoute("/points")({
  head: () => ({ meta: [{ title: "Bux Points — BuxHub" }] }),
  component: PointsPage,
});

const levels = [
  { level: 1, name: "Bronze", min: 0, icon: "🥉", color: "from-amber-700/20 to-amber-600/20" },
  { level: 2, name: "Prata", min: 500, icon: "🥈", color: "from-slate-400/20 to-slate-300/20" },
  { level: 3, name: "Ouro", min: 2000, icon: "🥇", color: "from-yellow-500/20 to-amber-500/20" },
  { level: 4, name: "Diamante", min: 5000, icon: "💎", color: "from-cyan-400/20 to-blue-500/20" },
  { level: 5, name: "Elite", min: 10000, icon: "👑", color: "from-purple-500/20 to-pink-500/20" },
];

function PointsPage() {
  const { user, isPremium } = useAuth();
  const qc = useQueryClient();
  const [claimingLogin, setClaimingLogin] = useState(false);

  const { data: userPoints } = useQuery({
    queryKey: ["my-points-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from("user_points")
          .select("balance, lifetime_earned")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (data) return { points: data.balance ?? 0, level: 0, lifetime_points: data.lifetime_earned ?? 0 };
        return { points: 0, level: 0, lifetime_points: 0 };
      } catch { return { points: 0, level: 0, lifetime_points: 0 }; }
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile-daily", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from("profiles")
          .select("daily_login_streak, last_login_reward")
          .eq("id", user!.id)
          .maybeSingle();
        return (data ?? { daily_login_streak: 0, last_login_reward: null }) as any;
      } catch { return { daily_login_streak: 0, last_login_reward: null }; }
    },
  });

  const { data: todayUploads } = useQuery({
    queryKey: ["my-uploads-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count } = await (supabase as any)
          .from("point_transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("reference_type", "script")
          .gte("created_at", today.toISOString());
        return count ?? 0;
      } catch { return 0; }
    },
  });

  const { data: history } = useQuery({
    queryKey: ["my-points-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      try {
        const { data } = await (supabase as any)
          .from("point_transactions")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50);
        return (data ?? []) as any[];
      } catch { return []; }
    },
  });

  const up = (userPoints as any) || { points: 0, lifetime_points: 0, level: 0 };
  const pf = (profile as any) || {};
  const todayCount = (todayUploads as number) ?? 0;
  const uploadLimit = isPremium ? 5 : 3;
  const currentLevel = levels.find((l) => up.lifetime_points >= l.min) ?? levels[0];
  const nextLevel = levels.find((l) => up.lifetime_points < l.min);

  const freeMultipliers = [100, 80, 60];
  const freeMultiplier = todayCount < freeMultipliers.length ? freeMultipliers[todayCount] : 0;

  const premiumMultipliers = [100, 90, 80, 70, 55, 40, 30, 20, 10, 5];
  const premiumMultiplier = todayCount < premiumMultipliers.length ? premiumMultipliers[todayCount] : 0;

  const nextMultiplier = isPremium ? premiumMultiplier : freeMultiplier;

  const canClaimLogin = () => {
    if (!pf.last_login_reward) return true;
    return new Date(pf.last_login_reward).toDateString() !== new Date().toDateString();
  };

  async function claimDaily() {
    if (claimingLogin) return;
    setClaimingLogin(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const res = await fetch("/admin-api/daily-login", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Erro");
      toast.success(`Login diário! +${d.reward} SP (streak: ${d.streak} dias)`);
      qc.invalidateQueries({ queryKey: ["my-points-full"] });
      qc.invalidateQueries({ queryKey: ["my-profile-daily"] });
      qc.invalidateQueries({ queryKey: ["my-points-history"] });
    } catch (err: any) {
      if (!err.message?.includes("already claimed")) toast.error(err.message);
    }
    setClaimingLogin(false);
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-400 mb-4">
            <Star className="h-3 w-3" /> Bux Points
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            Recompensas <span className="text-gradient-brand">BuxHub</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Ganhe pontos enviando scripts, fazendo login diário, comprando e vendendo na plataforma.
            Quanto mais você participa, mais recompensas ganha.
          </p>
        </div>

        {user ? (
          <>
            {/* === DASHBOARD === */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
              <Card className="border-white/10 bg-card/50 lg:col-span-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br ${currentLevel.color} animate-pulse-slow`}>
                      <span className="text-3xl">{currentLevel.icon}</span>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">
                        Nível {currentLevel.level} · {currentLevel.name}
                      </div>
                      <div className="text-3xl font-bold text-gradient-brand">{up.points}</div>
                      <div className="text-xs text-muted-foreground">Bux Points disponíveis</div>
                    </div>
                  </div>
                  {nextLevel && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Progresso para {nextLevel.name}</span>
                        <span>{up.lifetime_points} / {nextLevel.min}</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-500 transition-all duration-1000"
                          style={{ width: `${Math.min(100, (up.lifetime_points / nextLevel.min) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                    {isPremium && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <Crown className="h-3 w-3" /> Multiplicador 1.5x
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Flame className="h-3 w-3 text-orange-400" /> Streak: {pf.daily_login_streak ?? 0} dias
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Upload className="h-3 w-3 text-blue-400" /> Uploads hoje: {todayCount}/{uploadLimit}
                    </span>
                    <span className="inline-flex items-center gap-1 text-yellow-400">
                      <Zap className="h-3 w-3" /> Próximo multiplicador: {nextMultiplier}%
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/10 bg-card/50">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Gift className="h-4 w-4 text-primary" /> Login Diário
                  </h3>
                  <div className="text-center py-4">
                    <div className="text-4xl mb-2 transition-all duration-300 hover:scale-110">
                      {pf.daily_login_streak >= 30 ? "🏆" : pf.daily_login_streak >= 7 ? "🔥" : pf.daily_login_streak >= 3 ? "⭐" : "📅"}
                    </div>
                    <div className="text-sm text-muted-foreground mb-1">
                      Streak: <span className="text-yellow-400 font-medium">{pf.daily_login_streak ?? 0}</span> dias
                    </div>
                    <div className="text-xs text-muted-foreground mb-4">
                      {(pf.daily_login_streak ?? 0) >= 7
                        ? `Bônus: +${(pf.daily_login_streak ?? 0) >= 30 ? 30 : 10} SP`
                        : "Próximo bônus em 7 dias (+10 SP)"}
                      <span className="text-yellow-400 font-medium ml-1">
                        · +2 SP base
                      </span>
                    </div>
                    <Button
                      onClick={claimDaily}
                      disabled={!canClaimLogin() || claimingLogin}
                      className="w-full gap-2 transition-all duration-300"
                      variant={canClaimLogin() ? "default" : "outline"}
                    >
                      <Clock className="h-4 w-4" />
                      {claimingLogin ? "Reivindicando..." : canClaimLogin() ? "Reivindicar" : "Já reivindicado hoje"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* === REWARDS CARD === */}
            <Card className="border-white/10 bg-card/50 mb-8">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-6 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" /> Como ganhar pontos
                </h3>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-br from-blue-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-blue-500/20 grid place-items-center">
                        <Upload className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="font-semibold text-sm">Enviar Scripts</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Ganhe pontos quando seu script for <span className="text-green-400 font-medium">aprovado</span>.</p>
                      <div className="border border-white/10 rounded-lg overflow-hidden mt-2">
                        <div className="grid grid-cols-3 bg-white/5">
                          <div className="p-2 text-center border-r border-white/10">
                            <span className="font-medium text-sm text-yellow-400">📦</span>
                            <div className="font-semibold text-yellow-400">Basic</div>
                            <div className="text-yellow-400 font-bold">+1 SP</div>
                            <div className="text-[10px] opacity-60">qualidade &lt; 50</div>
                          </div>
                          <div className="p-2 text-center border-r border-white/10">
                            <span className="font-medium text-sm text-yellow-400">⭐</span>
                            <div className="font-semibold text-yellow-400">Good</div>
                            <div className="text-yellow-400 font-bold">+3 SP</div>
                            <div className="text-[10px] opacity-60">qualidade ≥ 50</div>
                          </div>
                          <div className="p-2 text-center">
                            <span className="font-medium text-sm text-yellow-400">💎</span>
                            <div className="font-semibold text-yellow-400">Elite</div>
                            <div className="text-yellow-400 font-bold">+6 SP</div>
                            <div className="text-[10px] opacity-60">qualidade ≥ 80</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-br from-green-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-green-500/20 grid place-items-center">
                        <Clock className="h-4 w-4 text-green-400" />
                      </div>
                      <span className="font-semibold text-sm">Login Diário</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Sistema de Streak (Bux Rewards):</p>
                      <div className="space-y-1 pl-2 border-l border-green-500/20">
                        <p>🎁 <span className="text-yellow-400 font-medium">+2 SP</span> base por dia de login</p>
                        <p>🔥 <span className="text-yellow-400 font-medium">+10 SP bônus</span> aos 7 dias consecutivos</p>
                        <p>🏆 <span className="text-yellow-400 font-medium">+30 SP bônus</span> aos 30 dias consecutivos</p>
                      </div>
                      <p className="text-[11px] opacity-60 mt-1">Bônus cumulativo com os +2 SP base. Reset às 00:00 BRT.</p>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-br from-red-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-red-500/20 grid place-items-center">
                        <Heart className="h-4 w-4 text-red-400" />
                      </div>
                      <span className="font-semibold text-sm">Curtidas nos Scripts</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Marco de curtidas no seu script:</p>
                      <div className="space-y-1 pl-2 border-l border-red-500/20">
                        <p>❤️ 10 curtidas → <span className="text-yellow-400 font-medium">+1 SP</span></p>
                        <p>❤️ 50 curtidas → <span className="text-yellow-400 font-medium">+3 SP</span></p>
                        <p>❤️ 100 curtidas → <span className="text-yellow-400 font-medium">+5 SP</span></p>
                      </div>
                      <p className="text-[11px] opacity-60">Cada milestone é recompensado uma vez por script. Máximo +5 SP/dia via curtidas.</p>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-br from-purple-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/20 grid place-items-center">
                        <Sparkles className="h-4 w-4 text-purple-400" />
                      </div>
                      <span className="font-semibold text-sm">Script em Destaque</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Selecionado pela equipe BuxHub para destaque na página inicial:</p>
                      <div className="text-yellow-400 font-bold text-lg mt-1">+25 SP bônus</div>
                      <p className="text-[11px] opacity-60">O destaque é manual e dado a scripts de alta qualidade.</p>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-br from-emerald-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 grid place-items-center">
                        <ShoppingBag className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="font-semibold text-sm">Compras & Vendas</span>
                    </div>
                    <div className="space-y-3 text-xs text-muted-foreground">
                      <div className="space-y-1 pl-2 border-l border-emerald-500/20">
                        <p>🛒 Comprar no marketplace → <span className="text-yellow-400 font-medium">1 SP a cada R$2</span></p>
                        <p>💰 Vender no marketplace → <span className="text-yellow-400 font-medium">1 SP a cada R$2</span></p>
                      </div>
                      <div className="border-t border-white/5 pt-2">
                        <p className="font-medium text-white/70 mb-1">⭐ Avaliações (por pedido, máx 5/dia)</p>
                        <div className="space-y-1 pl-2 border-l border-emerald-500/20">
                          <p>⭐ Avaliar vendedor (nota 1-5) → <span className="text-yellow-400 font-medium">+2 SP</span></p>
                          <p>💬 Comentar (mín. 20 caracteres) → <span className="text-yellow-400 font-medium">+1 SP</span></p>
                          <p>🎁 Bônus por fazer ambos → <span className="text-yellow-400 font-medium">+2 SP</span></p>
                        </div>
                      </div>
                      <div className="border-t border-white/5 pt-2">
                        <p className="font-medium text-white/70 mb-1">🪙 Gastar SP</p>
                        <div className="space-y-1 pl-2 border-l border-emerald-500/20">
                          <p>Troque seus SP por descontos e itens exclusivos na <Link to="/shop" className="text-primary underline">Bux Store</Link></p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border border-white/10 rounded-lg p-4 bg-gradient-to-br from-yellow-500/5 to-transparent">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="h-8 w-8 rounded-lg bg-yellow-500/20 grid place-items-center">
                        <Crown className="h-4 w-4 text-yellow-400" />
                      </div>
                      <span className="font-semibold text-sm">Premium</span>
                    </div>
                    <div className="space-y-2 text-xs text-muted-foreground">
                      <p>Assinantes Premium recebem:</p>
                      <div className="space-y-1 pl-2 border-l border-yellow-500/20">
                        <p>📤 <span className="text-primary font-medium">5 uploads/dia</span> (vs 3)</p>
                        <p>🎯 <span className="text-primary font-medium">Cap global de 130 SP/dia</span> (vs 80)</p>
                        <p>⚡ Prioridade de aprovação</p>
                        <p>🏷️ Descontos na Bux Store</p>
                        <p>👑 Selo Premium no perfil</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                        <Link to="/premium">Assinar Premium</Link>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* === CAP GLOBAL === */}
                <div className="border-t border-white/10 pt-6 mb-6">
                  <h4 className="font-semibold flex items-center gap-2 mb-4">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Limite Diário Global
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Para manter a economia saudável, todo usuário tem um limite máximo de SP que pode ganhar por dia:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-amber-500/10 rounded-lg p-4 border border-amber-500/20">
                      <div className="font-semibold text-sm mb-1">Usuário Free</div>
                      <div className="text-2xl font-bold text-yellow-400">80 SP</div>
                      <div className="text-xs text-muted-foreground">por dia</div>
                    </div>
                    <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                      <div className="font-semibold text-sm mb-1">Usuário Premium</div>
                      <div className="text-2xl font-bold text-primary">130 SP</div>
                      <div className="text-xs text-muted-foreground">por dia</div>
                    </div>
                  </div>
                </div>

                {/* === LIMITE DIÁRIO === */}
                <div className="border-t border-white/10 pt-6 mb-6">
                  <h4 className="font-semibold flex items-center gap-2 mb-4">
                    <Flame className="h-4 w-4 text-orange-400" /> Limite diário de uploads recompensados
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`rounded-lg p-4 border ${!isPremium ? "bg-amber-500/10 border-amber-500/20" : "bg-white/5 border-white/10"}`}>
                      <div className="font-semibold text-sm mb-1">Usuário Free</div>
                      <p className="text-sm text-muted-foreground">
                        Máximo de <span className="text-yellow-400 font-bold">3 uploads</span> recompensados por dia.
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progresso de hoje</span>
                          <span>{!isPremium ? todayCount : 0} / 3</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                            style={{ width: `${!isPremium ? Math.min(100, (todayCount / 3) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className={`rounded-lg p-4 border ${isPremium ? "bg-primary/10 border-primary/20" : "bg-white/5 border-white/10"}`}>
                      <div className="font-semibold text-sm mb-1">Usuário Premium</div>
                      <p className="text-sm text-muted-foreground">
                        Máximo de <span className="text-yellow-400 font-bold">5 uploads</span> recompensados por dia.
                      </p>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Progresso de hoje</span>
                          <span>{isPremium ? todayCount : 0} / 5</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                            style={{ width: `${isPremium ? Math.min(100, (todayCount / 5) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Após atingir o limite, ainda pode enviar scripts normalmente, porém não ganhará SP.</p>
                </div>

                {/* === ANTI-SPAM === */}
                <div className="border-t border-white/10 pt-6 mb-6">
                  <h4 className="font-semibold flex items-center gap-2 mb-4">
                    <Zap className="h-4 w-4 text-yellow-400" /> Sistema Anti-Spam (redução de recompensas)
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Quanto mais scripts você enviar no mesmo dia, menor será a recompensa.
                    Isso existe para evitar spam e manter a economia saudável.
                  </p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium text-sm mb-2">Usuários Free (máx 3/dia)</h5>
                      <div className="space-y-1">
                        {[100, 85, 70].map((pct, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2">
                            <span className="text-xs text-muted-foreground w-16">{i + 1}º upload</span>
                            <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${pct}%`,
                                  background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444",
                                }}
                              />
                            </div>
                            <span className="text-xs font-medium w-12 text-right" style={{ color: pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444" }}>{pct}%</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-3 bg-red-500/10 rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground w-16">4º+ upload</span>
                          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-red-500" style={{ width: "0%" }} />
                          </div>
                          <span className="text-xs font-medium w-12 text-right text-red-400">0%</span>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">Elite: 6 + 5 + 4 = <span className="text-yellow-400 font-medium">15 SP</span> máx (cap 18 SP uploads)</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-sm mb-2">Usuários Premium (máx 5/dia)</h5>
                      <div className="space-y-1">
                        {[100, 85, 70, 55, 40].map((pct, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-1.5">
                        <span className="text-xs text-muted-foreground w-16">{i + 1}º upload</span>
                              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    background: pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444",
                                  }}
                                />
                              </div>
                              <span className="text-xs font-medium w-12 text-right" style={{ color: pct >= 80 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444" }}>{pct}%</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-3 bg-red-500/10 rounded-lg px-3 py-1.5">
                            <span className="text-xs text-muted-foreground w-16">6º+ upload</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-red-500" style={{ width: "0%" }} />
                          </div>
                          <span className="text-xs font-medium w-12 text-right text-red-400">0%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-primary/5 rounded-lg p-4 mt-4 border border-primary/20">
                    <p className="font-medium text-sm mb-2">Exemplo Premium — Script Elite (6 SP base)</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { n: 1, sp: 6 },
                        { n: 2, sp: 5.1 },
                        { n: 3, sp: 4.2 },
                        { n: 4, sp: 3.3 },
                        { n: 5, sp: 2.4 },
                      ].map((e) => (
                        <div key={e.n} className="bg-white/5 rounded p-2 text-center">
                          <div className="text-[10px] text-muted-foreground">{e.n}º</div>
                          <div className="text-sm font-bold text-yellow-400">{e.sp} SP</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">Total ~21 SP via uploads + cap global de 130 SP/dia</p>
                  </div>
                </div>

                {/* === WARNING === */}
                <div className="border-t border-white/10 pt-6">
                  <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                    <ShieldCheck className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-300/90">
                      <p className="font-semibold mb-1">⚠️ Todos os scripts enviados passam por análise manual da equipe BuxHub.</p>
                      <p className="opacity-80">Não envie: scripts falsos, quebrados, duplicados, descrições enganosas ou conteúdo malicioso.</p>
                      <p className="opacity-80 mt-1">Tentativas de abuso para farmar Bux Points podem resultar em: remoção de pontos, exclusão de conteúdo e suspensão da conta.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-white/10 bg-card/50 mb-8">
            <CardContent className="p-10 text-center">
              <Gift className="h-10 w-10 mx-auto mb-3 text-primary opacity-50" />
              <h3 className="font-semibold mb-2">Faça login para ver seus pontos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Crie sua conta e comece a acumular Bux Points.
              </p>
              <Button asChild>
                <Link to="/auth">Entrar / Criar conta</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* === LEVELS === */}
        <Card className="border-white/10 bg-card/50 mb-8">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" /> Níveis de Pontuação
            </h3>
            <div className="grid sm:grid-cols-5 gap-3">
              {levels.map((l) => (
                <div
                  key={l.level}
                  className={`text-center p-4 rounded-lg bg-gradient-to-br ${l.color} transition-all duration-300 ${up.lifetime_points >= l.min ? "ring-1 ring-primary/50 scale-[1.02]" : "opacity-50 hover:opacity-70"}`}
                >
                  <div className="text-2xl mb-1">{l.icon}</div>
                  <div className="font-semibold text-sm">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.min}+ pts</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* === HISTORY === */}
        {user && (
          <Card className="border-white/10 bg-card/50">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4">Histórico de Pontos</h3>
              {(history ?? []).length > 0 ? (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {(history ?? []).map((tx: any) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                      <div>
                        <div className="text-sm font-medium">{tx.reason || tx.type?.replace(/_/g, " ")}</div>
                        {tx.reference_type && (
                          <div className="text-xs text-muted-foreground capitalize">{tx.reference_type}</div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </div>
                      <div className={`font-bold text-lg ${tx.amount > 0 ? "text-green-400" : "text-red-400"}`}>
                        {tx.amount > 0 ? "+" : ""}{tx.amount}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma transação ainda. Comece enviando um script ou fazendo login diário!
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
