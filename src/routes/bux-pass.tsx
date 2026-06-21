import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Gift, Star, TrendingUp, Lock, Flame, Zap, Check, Trophy, Sparkles, Sword } from "lucide-react";

export const Route = createFileRoute("/bux-pass")({
  head: () => ({ meta: [{ title: "Bux Pass — BuxHub" }] }),
  component: BuxPassPage,
});

const XP_EVENTS = [
  { slug: "daily_login", label: "Login Diário", xp: 10, limit: "1x/dia", icon: Flame },
  { slug: "purchase", label: "Compra no Marketplace", xp: 25, limit: "99x/dia", icon: Star },
  { slug: "sale", label: "Venda no Marketplace", xp: 50, limit: "99x/dia", icon: TrendingUp },
  { slug: "review", label: "Avaliar Pedido", xp: 15, limit: "5x/dia", icon: Star },
  { slug: "script_upload", label: "Upload de Script Aprovado", xp: 20, limit: "3x/dia", icon: Zap },
  { slug: "script_like", label: "Curtida Recebida", xp: 5, limit: "20x/dia", icon: Flame },
];

function BuxPassPage() {
  const { user, isPremium } = useAuth();

  const { data: season } = useQuery({
    queryKey: ["bux-pass-season"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bux_pass_seasons")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      return data ?? null;
    },
  });

  const { data: levels } = useQuery({
    queryKey: ["bux-pass-levels", season?.id],
    enabled: !!season,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bux_pass_levels")
        .select("*")
        .eq("season_id", season.id)
        .order("level", { ascending: true });
      return data ?? [];
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["bux-pass-progress", season?.id, user?.id],
    enabled: !!season && !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bux_pass_progress")
        .select("*")
        .eq("season_id", season.id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  if (!season) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <Sword className="h-16 w-16 mx-auto mb-4 text-primary/40" />
          <h1 className="text-3xl font-bold mb-3">Bux Pass</h1>
          <p className="text-muted-foreground mb-2">Em breve — a primeira temporada do Bux Pass está sendo preparada.</p>
          <p className="text-sm text-muted-foreground">Ganhe XP completando atividades na plataforma e desbloqueie recompensas exclusivas.</p>
          <div className="flex justify-center gap-4 mt-8">
            <Button asChild variant="outline">
              <Link to="/points">Ver Bux Points</Link>
            </Button>
            <Button asChild>
              <Link to="/scripts">Explorar Scripts</Link>
            </Button>
          </div>
        </div>
      </PageShell>
    );
  }

  const userLevel = progress?.level ?? 1;
  const userXp = progress?.xp ?? 0;
  const hasPremium = progress?.has_premium ?? false;
  const currentLevelDef = (levels ?? []).find((l: any) => l.level === userLevel);
  const nextLevelDef = (levels ?? []).find((l: any) => l.level === userLevel + 1);
  const xpForCurrent = currentLevelDef?.xp_required ?? 0;
  const xpForNext = nextLevelDef?.xp_required ?? xpForCurrent + 100;
  const xpProgress = xpForNext > xpForCurrent ? Math.min(100, ((userXp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100) : 0;

  const isActive = new Date(season.ends_at) > new Date();
  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86400000));

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-10">
        {/* HEADER */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/40 via-indigo-900/30 to-slate-900/40 border border-purple-500/20 mb-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-3xl" />
          <div className="relative p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 grid place-items-center">
              <Sword className="h-10 w-10 text-purple-400" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-400 mb-2">
                <Crown className="h-3 w-3" /> Temporada {season.season_number}
              </div>
              <h1 className="text-3xl md:text-4xl font-bold mb-1">{season.name}</h1>
              <p className="text-muted-foreground text-sm">
                {isActive ? `${daysLeft} dias restantes` : "Temporada encerrada"} · {season.max_level} níveis · {hasPremium ? "Passe Premium ativo" : `${season.premium_price_sp} SP`}
              </p>
            </div>
            {!hasPremium && isActive && (
              <Button className="gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shrink-0">
                <Sparkles className="h-4 w-4" /> Desbloquear Premium
              </Button>
            )}
          </div>
        </div>

        {user ? (
          <>
            {/* PROGRESS */}
            <Card className="border-white/10 bg-card/50 mb-8">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" /> Seu Progresso
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    Nível <span className="text-yellow-400 font-bold">{userLevel}</span>
                    {hasPremium && <span className="text-purple-400 ml-2">Premium</span>}
                  </span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden mb-1">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-700" style={{ width: `${xpProgress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{userXp} XP</span>
                  <span>Próximo nível: {xpForNext} XP</span>
                </div>
              </CardContent>
            </Card>

            {/* LEVELS GRID */}
            <Card className="border-white/10 bg-card/50 mb-8">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Recompensas por Nível</h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
                  {(levels ?? []).map((lvl: any) => {
                    const isUnlocked = lvl.level <= userLevel;
                    const isCurrent = lvl.level === userLevel;
                    return (
                      <div key={lvl.level} className={`relative rounded-lg p-3 text-center border transition-all duration-300 ${isCurrent ? "border-purple-500 bg-purple-500/10 scale-105" : isUnlocked ? "border-green-500/30 bg-green-500/5" : "border-white/5 bg-white/[0.02]"}`}>
                        <div className="text-xs text-muted-foreground mb-1">Nív. {lvl.level}</div>
                        {lvl.free_reward_label && (
                          <div className="text-[10px] text-green-400 font-medium truncate" title={lvl.free_reward_label}>
                            {isUnlocked ? <Check className="h-3 w-3 inline" /> : <Lock className="h-3 w-3 inline" />}
                            {lvl.free_reward_label}
                          </div>
                        )}
                        {lvl.premium_reward_label && (
                          <div className={`text-[10px] font-medium truncate mt-0.5 ${hasPremium && isUnlocked ? "text-purple-400" : "text-muted-foreground"}`}>
                            <Crown className="h-3 w-3 inline mr-0.5" />
                            {lvl.premium_reward_label}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-white/10 bg-card/50 mb-8">
            <CardContent className="p-10 text-center">
              <Gift className="h-10 w-10 mx-auto mb-3 text-primary opacity-50" />
              <h3 className="font-semibold mb-2">Faça login para participar</h3>
              <p className="text-sm text-muted-foreground mb-4">Ganhe XP e suba de nível no Bux Pass.</p>
              <Button asChild><Link to="/auth">Entrar / Criar conta</Link></Button>
            </CardContent>
          </Card>
        )}

        {/* XP SOURCES */}
        <Card className="border-white/10 bg-card/50">
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-400" /> Como ganhar XP
            </h3>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {XP_EVENTS.map((ev) => (
                <div key={ev.slug} className="flex items-center gap-3 border border-white/10 rounded-lg p-3 bg-white/[0.02]">
                  <div className="h-9 w-9 rounded-lg bg-purple-500/10 grid place-items-center shrink-0">
                    <ev.icon className="h-4 w-4 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{ev.label}</div>
                    <div className="text-xs text-muted-foreground">+{ev.xp} XP · {ev.limit}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}