import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Crown, Eye, ShieldCheck, Lock, Heart, Star, Sparkles, User, Gamepad2, ExternalLink, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/scripts/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} – RBXScripts` }] }),
  component: ScriptDetail,
});

function ScriptDetail() {
  const { slug } = Route.useParams();
  const { isPremium, user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);

  const { data: script, isLoading } = useQuery({
    queryKey: ["script", slug],
    queryFn: async () => {
      const raw = ((await (supabase as any).from("scripts").select("*").eq("slug", slug).maybeSingle()).data) as any;
      if (raw?.user_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .eq("id", raw.user_id)
          .maybeSingle();
        raw.profile = prof ?? null;
      }
      return raw;
    },
  });

  // Check initial liked state from the script's liked_by array
  useEffect(() => {
    if (script?.liked_by && user) {
      setLiked(script.liked_by.includes(user.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id, user?.id]);

  useEffect(() => {
    if (script?.id) {
      supabase
        .from("scripts")
        .update({ views: (script.views ?? 0) + 1 })
        .eq("id", script.id)
        .then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id]);

  async function handleLike() {
    if (!user || liking) return;
    setLiking(true);
    // Optimistic toggle
    const wasLiked = liked;
    setLiked(!wasLiked);
    qc.setQueryData(["script", slug], (old: any) => old ? { ...old, likes_count: old.likes_count + (wasLiked ? -1 : 1) } : old);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { toast.error("Faça login para curtir"); setLiking(false); setLiked(false); return; }
      const res = await fetch("/admin-api/like-script", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ script_id: script!.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao curtir");
      // Sync with server response
      setLiked(data.liked);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, likes_count: data.likes_count } : old);
    } catch {
      // Revert optimistic update on error
      setLiked(wasLiked);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, likes_count: old.likes_count + (wasLiked ? 1 : -1) } : old);
    }
    setLiking(false);
  }

  if (isLoading)
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-16">Carregando…</div>
      </PageShell>
    );
  if (!script)
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <p>Script não encontrado.</p>
          <Button asChild className="mt-4">
            <Link to="/scripts">Voltar</Link>
          </Button>
        </div>
      </PageShell>
    );

  const s = script as any;
  const canSee = !script.is_premium || isPremium;
  const tier = !s.has_key && !s.is_obfuscated && (s.description?.length ?? 0) > 200 ? (s.quality_score >= 80 ? "elite" : s.quality_score >= 50 ? "good" : "basic") : "basic";

  const tierIcons: Record<string, string> = { elite: "💎", good: "⭐", basic: "📦" };
  const tierColors: Record<string, string> = { elite: "from-purple-500/20 to-pink-500/20", good: "from-yellow-500/20 to-amber-500/20", basic: "from-slate-400/20 to-slate-300/20" };

  async function copyCode() {
    if (!script) return;
    if (!canSee) return;
    await navigator.clipboard.writeText(script.code);
    await supabase
      .from("scripts")
      .update({ copies: (script.copies ?? 0) + 1 })
      .eq("id", script.id);
    toast.success("Script copiado! Cole no seu executor.");
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/scripts">
            <ArrowLeft className="h-4 w-4" /> Voltar ao catálogo
          </Link>
        </Button>

        <Card className="border-white/10 bg-card/50 overflow-hidden">
          <div className="aspect-[21/9] bg-gradient-to-br from-primary/20 to-accent/20 relative">
            {script.thumbnail_url && (
              <img
                src={script.thumbnail_url}
                alt={script.title}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <CardContent className="p-6 md:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {script.is_premium && (
                    <Badge className="bg-gradient-to-r from-primary to-accent border-0">
                      <Crown className="h-3 w-3 mr-1" /> Premium
                    </Badge>
                  )}
                  {script.is_verified && (
                    <Badge variant="secondary">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Verificado
                    </Badge>
                  )}
                  {script.is_featured && (
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 border-0">
                      <Sparkles className="h-3 w-3 mr-1" /> Destaque
                    </Badge>
                  )}
                  {script.game_name && <Badge variant="outline">{script.game_name}</Badge>}
                  <Badge className={`bg-gradient-to-br ${tierColors[tier]} border-0`}>
                    <span className="mr-1">{tierIcons[tier]}</span>
                    {tier === "elite" ? "Elite" : tier === "good" ? "Good" : "Basic"}
                  </Badge>
                  {s.tags && s.tags.length > 0 && (s.tags as string[]).map((tag: string) => (
                    <Badge key={tag} variant="outline" className="border-primary/30 text-primary text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">{script.title}</h1>
                <p className="text-muted-foreground mt-2">{script.description}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="inline-flex items-center gap-1">
                  <Eye className="h-4 w-4" /> {script.views} visualizações
                </div>
                <div className="mt-1">{script.copies} cópias</div>
                {s.points_rewarded > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-yellow-400 font-medium">
                    <Star className="h-3 w-3" /> +{s.points_rewarded} SP
                  </div>
                )}
                {s.quality_score > 0 && (
                  <div className="mt-1 text-xs opacity-60">Qualidade: {s.quality_score}/100</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <Button
                variant={liked ? "default" : "outline"}
                size="sm"
                onClick={handleLike}
                disabled={!user || liking}
                className={`gap-1 ${liked ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30" : ""}`}
              >
                <Heart className={`h-4 w-4 ${liking ? "animate-pulse" : ""} ${liked ? "fill-red-400" : ""}`} />
                {s.likes_count ?? 0}
              </Button>
              {s.game_link && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(s.game_link, "_blank")}
                  className="gap-1"
                >
                  <ExternalLink className="h-4 w-4" /> Ir para o jogo
                </Button>
              )}
              {s.user_id && (
                <div className="text-xs text-muted-foreground flex items-center gap-2 ml-auto">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden ring-1 ring-white/10 shrink-0">
                    {s.profile?.avatar_url ? (
                      <img src={s.profile.avatar_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="font-medium text-foreground">{s.profile?.username ?? "Usuário"}</span>
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Código</h2>
                <Button
                  onClick={copyCode}
                  disabled={!canSee}
                  size="sm"
                  className="bg-gradient-to-r from-primary to-accent text-white border-0"
                >
                  <Copy className="h-4 w-4" /> Copiar script
                </Button>
              </div>
              <div className="relative">
                <pre
                  className={`rounded-lg border border-white/10 bg-black/40 p-4 text-xs md:text-sm overflow-x-auto max-h-96 ${!canSee ? "blur-md select-none" : ""}`}
                >
                  <code>{script.code}</code>
                </pre>
                {!canSee && (
                  <div className="absolute inset-0 grid place-items-center">
                    <Card className="glass max-w-sm text-center">
                      <CardContent className="p-6">
                        <Lock className="h-8 w-8 mx-auto mb-3 text-primary" />
                        <h3 className="font-semibold mb-1">Conteúdo Premium</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Este script é exclusivo para assinantes Premium.
                        </p>
                        {user ? (
                          <Button
                            asChild
                            className="bg-gradient-to-r from-primary to-accent text-white border-0 w-full"
                          >
                            <Link to="/premium">Assinar Premium</Link>
                          </Button>
                        ) : (
                          <Button
                            onClick={() => router.navigate({ to: "/auth" })}
                            className="bg-gradient-to-r from-primary to-accent text-white border-0 w-full"
                          >
                            Entrar para liberar
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
