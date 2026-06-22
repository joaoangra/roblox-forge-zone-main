import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Crown, Eye, ShieldCheck, Lock, Heart, Star, Sparkles, User, Gamepad2, ExternalLink, Copy, Check, Download, ThumbsDown, Bookmark, Flag, Share2, X, MessageCircle, Send, Calendar, Hash, Key, Clock, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/scripts/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} – RBXScripts` }] }),
  component: ScriptDetail,
});

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}meses`;
  return `${Math.floor(months / 12)}a`;
}

function updateCache(old: any, userId: string, opts: { like: boolean; dislike: boolean }) {
  const likedBy: string[] = old.liked_by ?? [];
  const dislikedBy: string[] = old.disliked_by ?? [];
  let likesCount = old.likes_count ?? 0;
  let dislikesCount = old.dislikes_count ?? 0;

  if (opts.like) {
    if (!likedBy.includes(userId)) { likesCount++; }
  } else {
    if (likedBy.includes(userId)) { likesCount = Math.max(0, likesCount - 1); }
  }
  if (opts.dislike) {
    if (!dislikedBy.includes(userId)) { dislikesCount++; }
  } else {
    if (dislikedBy.includes(userId)) { dislikesCount = Math.max(0, dislikesCount - 1); }
  }

  return {
    ...old,
    likes_count: likesCount,
    dislikes_count: dislikesCount,
    liked_by: opts.like
      ? [...likedBy.filter((id: string) => id !== userId), userId]
      : likedBy.filter((id: string) => id !== userId),
    disliked_by: opts.dislike
      ? [...dislikedBy.filter((id: string) => id !== userId), userId]
      : dislikedBy.filter((id: string) => id !== userId),
  };
}

function ScriptDetail() {
  const { slug } = Route.useParams();
  const { isPremium, user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  const [liking, setLiking] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliking, setDisliking] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDesc, setReportDesc] = useState("");
  const [reporting, setReporting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [favAnim, setFavAnim] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

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

  useEffect(() => {
    if (script && user) {
      setLiked(script.liked_by?.includes(user.id) ?? false);
      setDisliked(script.disliked_by?.includes(user.id) ?? false);
      setFavorited(script.favorited_by?.includes(user.id) ?? false);
    }
  }, [script?.id, user?.id]);

  useEffect(() => {
    if (script?.id) {
      supabase
        .from("scripts")
        .update({ views: (script.views ?? 0) + 1 })
        .eq("id", script.id)
        .then(() => {});
    }
  }, [script?.id]);

  async function handleLike() {
    if (!user || liking || disliking) return;
    setLiking(true);
    const wasLiked = liked;
    const wasDisliked = disliked;
    setLiked(!wasLiked);
    if (wasDisliked) setDisliked(false);
    qc.setQueryData(["script", slug], (old: any) => old ? updateCache(old, user.id, { like: !wasLiked, dislike: false }) : old);
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
      setLiked(data.liked);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, likes_count: data.likes_count, dislikes_count: data.dislikes_count, liked_by: data.liked ? [...((old.liked_by ?? []).filter((id: string) => id !== user.id)), user.id] : (old.liked_by ?? []).filter((id: string) => id !== user.id), disliked_by: (old.disliked_by ?? []).filter((id: string) => id !== user.id) } : old);
    } catch {
      setLiked(wasLiked);
      if (wasDisliked) setDisliked(true);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, likes_count: old.likes_count + (wasLiked ? 1 : -1) } : old);
    }
    setLiking(false);
  }

  async function handleDislike() {
    if (!user || disliking || liking) return;
    setDisliking(true);
    const wasDisliked = disliked;
    const wasLiked = liked;
    setDisliked(!wasDisliked);
    if (wasLiked) setLiked(false);
    qc.setQueryData(["script", slug], (old: any) => old ? updateCache(old, user.id, { like: false, dislike: !wasDisliked }) : old);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { toast.error("Faça login"); setDisliking(false); setDisliked(false); return; }
      const res = await fetch("/admin-api/dislike-script", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ script_id: script!.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setDisliked(data.disliked);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, dislikes_count: data.dislikes_count, likes_count: data.likes_count ?? old.likes_count, disliked_by: data.disliked ? [...((old.disliked_by ?? []).filter((id: string) => id !== user.id)), user.id] : (old.disliked_by ?? []).filter((id: string) => id !== user.id), liked_by: (old.liked_by ?? []).filter((id: string) => id !== user.id) } : old);
    } catch {
      setDisliked(wasDisliked);
      if (wasLiked) setLiked(true);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, dislikes_count: old.dislikes_count + (wasDisliked ? 1 : -1) } : old);
    }
    setDisliking(false);
  }

  async function handleFavorite() {
    if (!user || favoriting) return;
    setFavoriting(true);
    const was = favorited;
    setFavorited(!was);
    if (!was) { setFavAnim(true); setTimeout(() => setFavAnim(false), 600); }
    qc.setQueryData(["script", slug], (old: any) => old ? { ...old, favorites_count: (old.favorites_count ?? 0) + (was ? -1 : 1), favorited_by: was ? (old.favorited_by ?? []).filter((id: string) => id !== user.id) : [...(old.favorited_by ?? []), user.id] } : old);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { toast.error("Faça login"); setFavoriting(false); setFavorited(false); return; }
      const res = await fetch("/admin-api/favorite-script", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ script_id: script!.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      setFavorited(data.favorited);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, favorites_count: data.favorites_count, favorited_by: data.favorited ? [...((old.favorited_by ?? []).filter((id: string) => id !== user.id)), user.id] : (old.favorited_by ?? []).filter((id: string) => id !== user.id) } : old);
    } catch {
      setFavorited(was);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, favorites_count: (old.favorites_count ?? 0) + (was ? 1 : -1) } : old);
    }
    setFavoriting(false);
  }

  async function copyCode() {
    if (!script) return;
    if (!canSee) return;
    await navigator.clipboard.writeText(script.code);
    await supabase
      .from("scripts")
      .update({ copies: (script.copies ?? 0) + 1 })
      .eq("id", script.id);
    setCopied(true);
    toast.success("Script copiado! Cole no seu executor.");
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleDownload() {
    if (!script || !user || loadingDownload) return;
    setLoadingDownload(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { toast.error("Faça login"); setLoadingDownload(false); return; }
      const res = await fetch("/admin-api/download-script", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ script_id: script.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      const blob = new Blob([data.code], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.title ?? "script"}.lua`;
      a.click();
      URL.revokeObjectURL(url);
      qc.setQueryData(["script", slug], (old: any) => old ? { ...old, downloads_count: (old.downloads_count ?? 0) + 1 } : old);
      toast.success("Download iniciado!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao baixar");
    }
    setLoadingDownload(false);
  }

  async function handleReport() {
    if (!user || !reportReason || reporting) return;
    setReporting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) { toast.error("Faça login"); setReporting(false); return; }
      const res = await fetch("/admin-api/report-script", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ script_id: script!.id, reason: reportReason, description: reportDesc }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      toast.success("Relatório enviado! Obrigado.");
      setShowReport(false);
      setReportReason("");
      setReportDesc("");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar");
    }
    setReporting(false);
  }

  function shareLink(platform?: string) {
    const url = window.location.href;
    const text = `Confira este script: ${script?.title}`;
    if (platform === "discord") window.open(`https://discord.com/channels/@me`, "_blank");
    else if (platform === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
    else if (platform === "telegram") window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
    else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
    setShareOpen(false);
  }

  if (isLoading)
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl px-4 py-8 space-y-4 animate-pulse">
          <div className="h-5 w-32 bg-muted/40 rounded" />
          <div className="aspect-[21/9] rounded-xl bg-muted/40" />
          <div className="space-y-3 p-6">
            <div className="h-8 w-3/4 bg-muted/40 rounded" />
            <div className="h-4 w-full bg-muted/40 rounded" />
            <div className="h-4 w-2/3 bg-muted/40 rounded" />
          </div>
        </div>
      </PageShell>
    );

  if (!script)
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <p className="text-muted-foreground">Script não encontrado.</p>
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

  const reports = [
    { v: "broken", l: "Script quebrado" },
    { v: "malicious", l: "Script malicioso" },
    { v: "inappropriate", l: "Conteúdo impróprio" },
    { v: "spam", l: "Spam" },
    { v: "other", l: "Outro" },
  ];

  const availableTags = ["Sem Key", "Seguro", "Indetectável", "Funciona bem", "Atualizado"];

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 group">
          <Link to="/scripts">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Voltar
          </Link>
        </Button>

        <Card className="border-white/10 bg-card/50 overflow-hidden backdrop-blur-sm">
          <div className="aspect-[21/9] bg-gradient-to-br from-primary/20 via-accent/10 to-accent/20 relative overflow-hidden">
            {script.thumbnail_url ? (
              <>
                {!imgLoaded && <div className="absolute inset-0 bg-muted/40 animate-pulse" />}
                <img
                  src={script.thumbnail_url}
                  alt={script.title}
                  onLoad={() => setImgLoaded(true)}
                  className={`h-full w-full object-cover transition-all duration-700 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />
              </>
            ) : (
              <div className="h-full w-full grid place-items-center">
                <Gamepad2 className="h-16 w-16 text-white/5" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end gap-2">
              {script.is_premium && (
                <Badge className="bg-gradient-to-r from-primary to-accent border-0 shadow-lg">
                  <Crown className="h-3 w-3 mr-1" /> Premium
                </Badge>
              )}
              {script.is_featured && (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 shadow-lg">
                  <Sparkles className="h-3 w-3 mr-1" /> Destaque
                </Badge>
              )}
              {script.is_verified && (
                <Badge variant="secondary" className="shadow-lg">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Verificado
                </Badge>
              )}
              {s.has_key === false && (
                <Badge className="bg-success/90 text-success-foreground border-0 shadow-lg">
                  🔓 Sem Key
                </Badge>
              )}
              {s.has_key === true && (
                <Badge className="bg-amber-600/90 text-white border-0 shadow-lg">
                  🔒 Com Key
                </Badge>
              )}
              <Badge className={`bg-gradient-to-br ${tierColors[tier]} border-0 shadow-lg backdrop-blur-sm`}>
                <span className="mr-1">{tierIcons[tier]}</span>
                {tier === "elite" ? "Elite" : tier === "good" ? "Good" : "Basic"}
              </Badge>
            </div>
          </div>

          <CardContent className="p-5 md:p-8">
            <div className="flex flex-col lg:flex-row lg:items-start gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 text-xs text-muted-foreground">
                  {s.game_name && (
                    <span className="inline-flex items-center gap-1">
                      <Gamepad2 className="h-3 w-3" /> {s.game_name}
                    </span>
                  )}
                  {script.created_at && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> {timeAgo(script.created_at)}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl md:text-3xl font-bold mt-1">{script.title}</h1>
                <p className="text-muted-foreground mt-2 text-sm md:text-base leading-relaxed">{script.description}</p>

                {s.tags && s.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(s.tags as string[]).map((tag: string) => {
                      const colors: Record<string, string> = {
                        "Sem Key": "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
                        Seguro: "bg-blue-500/15 text-blue-400 border-blue-500/25",
                        Indetectável: "bg-purple-500/15 text-purple-400 border-purple-500/25",
                        "Funciona bem": "bg-green-500/15 text-green-400 border-green-500/25",
                        Atualizado: "bg-cyan-500/15 text-cyan-400 border-cyan-500/25",
                      };
                      return (
                        <span key={tag} className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${colors[tag] ?? "bg-white/5 border-white/10 text-muted-foreground"}`}>
                          {tag}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                    <Eye className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-semibold">{formatCount(s.views ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Visualizações</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                    <Download className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-semibold">{formatCount(s.downloads_count ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Downloads</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                    <Heart className="h-4 w-4 mx-auto mb-1 text-red-400" />
                    <p className="text-sm font-semibold">{formatCount(s.likes_count ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Likes</p>
                  </div>
                  <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-center">
                    <ThumbsDown className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm font-semibold">{formatCount(s.dislikes_count ?? 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Dislikes</p>
                  </div>
                </div>

                <div className="rounded-lg bg-white/[0.03] border border-white/10 p-4 mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Categoria</p>
                    <p className="font-medium">{s.game_name ?? "Universal"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Key</p>
                    <p className="font-medium">{s.has_key ? "Sim" : "Não"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Qualidade</p>
                    <p className="font-medium">{s.quality_score ?? "—"}/100</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Postado</p>
                    <p className="font-medium">{timeAgo(s.created_at)}</p>
                  </div>
                  {s.supported_executors && s.supported_executors.length > 0 && (
                    <div className="col-span-full">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Compatível com</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(s.supported_executors as string[]).map((ex: string) => (
                          <span key={ex} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
                            {ex}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                <Button
                  variant={liked ? "default" : "outline"}
                  size="sm"
                  onClick={handleLike}
                  disabled={!user || liking}
                  className={`gap-1.5 transition-all duration-200 ${liked ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30 shadow-sm" : "hover:border-red-500/30"}`}
                >
                  <Heart className={`h-4 w-4 transition-all ${liking ? "animate-pulse" : ""} ${liked ? "fill-red-400 scale-110" : ""}`} />
                  {s.likes_count ?? 0}
                </Button>
                <Button
                  variant={disliked ? "default" : "outline"}
                  size="sm"
                  onClick={handleDislike}
                  disabled={!user || disliking}
                  className={`gap-1.5 transition-all duration-200 ${disliked ? "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30 shadow-sm" : "hover:border-amber-500/30"}`}
                >
                  <ThumbsDown className={`h-4 w-4 transition-all ${disliking ? "animate-pulse" : ""} ${disliked ? "fill-amber-400" : ""}`} />
                  {s.dislikes_count ?? 0}
                </Button>
                <Button
                  variant={favorited ? "default" : "outline"}
                  size="sm"
                  onClick={handleFavorite}
                  disabled={!user || favoriting}
                  className={`gap-1.5 transition-all duration-200 ${favorited ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30 shadow-sm" : "hover:border-yellow-500/30"}`}
                >
                  <Bookmark className={`h-4 w-4 transition-all ${favAnim ? "scale-125" : ""} ${favorited ? "fill-yellow-400" : ""}`} />
                  {s.favorites_count ?? 0}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShareOpen(!shareOpen)} className="gap-1.5 hover:border-blue-500/30 relative">
                  <Share2 className="h-4 w-4" />
                  Compartilhar
                </Button>
                {shareOpen && (
                  <div className="absolute z-50 mt-10 right-0 bg-card border border-white/10 rounded-lg p-2 shadow-xl flex flex-col gap-1 min-w-[160px]">
                    <button onClick={() => shareLink()} className="flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-white/5 transition-colors text-left">
                      <Copy className="h-3.5 w-3.5" /> Copiar link
                    </button>
                    <button onClick={() => shareLink("discord")} className="flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-white/5 transition-colors text-left">
                      <MessageCircle className="h-3.5 w-3.5 text-indigo-400" /> Discord
                    </button>
                    <button onClick={() => shareLink("whatsapp")} className="flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-white/5 transition-colors text-left">
                      <Send className="h-3.5 w-3.5 text-green-400" /> WhatsApp
                    </button>
                    <button onClick={() => shareLink("telegram")} className="flex items-center gap-2 px-3 py-2 text-xs rounded-md hover:bg-white/5 transition-colors text-left">
                      <Send className="h-3.5 w-3.5 text-blue-400" /> Telegram
                    </button>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowReport(true)} disabled={!user} className="gap-1.5 hover:border-red-500/30 hover:text-red-400">
                  <Flag className="h-4 w-4" />
                  Reportar
                </Button>
                {s.game_link && (
                  <Button variant="outline" size="sm" onClick={() => window.open(s.game_link, "_blank")} className="gap-1.5 hover:border-white/20">
                    <ExternalLink className="h-4 w-4" /> Jogo
                  </Button>
                )}
              </div>
            </div>

            {s.user_id && (
              <div className="flex items-center gap-3 mt-6 pt-5 border-t border-white/5">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden ring-2 ring-white/10 shrink-0">
                  {s.profile?.avatar_url ? (
                    <img src={s.profile.avatar_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{s.profile?.username ?? "Usuário"}</p>
                  <p className="text-[11px] text-muted-foreground">Autor</p>
                </div>
                {s.points_rewarded > 0 && (
                  <div className="ml-auto inline-flex items-center gap-1 text-yellow-400 text-xs font-medium bg-yellow-500/10 px-2.5 py-1 rounded-full">
                    <Star className="h-3 w-3" /> +{s.points_rewarded} SP
                  </div>
                )}
              </div>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Código</h2>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDownload}
                    disabled={!canSee || !user || loadingDownload}
                    size="sm"
                    variant="outline"
                    className="gap-1.5 transition-all"
                  >
                    <Download className={`h-4 w-4 ${loadingDownload ? "animate-bounce" : ""}`} />
                    {loadingDownload ? "Baixando..." : "Download"}
                  </Button>
                  <Button
                    onClick={copyCode}
                    disabled={!canSee}
                    size="sm"
                    className={`gap-1.5 transition-all duration-300 ${copied ? "bg-success text-success-foreground border-success" : "bg-gradient-to-r from-primary to-accent text-white border-0"}`}
                  >
                    {copied ? (
                      <><Check className="h-4 w-4" /> Copiado</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copiar script</>
                    )}
                  </Button>
                </div>
              </div>
              <div className="relative group">
                <pre
                  className={`rounded-lg border border-white/10 bg-black/40 p-4 text-xs md:text-sm overflow-x-auto max-h-96 transition-all duration-300 ${!canSee ? "blur-md select-none" : ""} ${copied ? "border-success/30 ring-1 ring-success/20" : ""}`}
                >
                  <code>{script.code}</code>
                </pre>
                {copied && (
                  <div className="absolute top-3 right-3 bg-success/20 text-success text-[11px] font-medium px-2.5 py-1 rounded-full border border-success/30 animate-in fade-in slide-in-from-top-1 duration-300">
                    <Check className="h-3 w-3 inline mr-1" />Copiado!
                  </div>
                )}
                {!canSee && (
                  <div className="absolute inset-0 grid place-items-center backdrop-blur-sm">
                    <Card className="glass max-w-sm text-center border-white/10 shadow-2xl">
                      <CardContent className="p-6">
                        <Lock className="h-8 w-8 mx-auto mb-3 text-primary" />
                        <h3 className="font-semibold mb-1">Conteúdo Premium</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Este script é exclusivo para assinantes Premium.
                        </p>
                        {user ? (
                          <Button asChild className="bg-gradient-to-r from-primary to-accent text-white border-0 w-full">
                            <Link to="/premium">Assinar Premium</Link>
                          </Button>
                        ) : (
                          <Button onClick={() => router.navigate({ to: "/auth" })} className="bg-gradient-to-r from-primary to-accent text-white border-0 w-full">
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

      {showReport && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowReport(false)}>
          <div className="bg-card border border-white/10 rounded-xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Denunciar Script</h3>
              <button onClick={() => setShowReport(false)} className="p-1 rounded-md hover:bg-white/5 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Motivo</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {reports.map((r) => (
                    <button
                      key={r.v}
                      onClick={() => setReportReason(r.v)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        reportReason === r.v
                          ? "bg-destructive/20 border-destructive/40 text-destructive"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {r.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Descrição (opcional)</Label>
                <textarea
                  value={reportDesc}
                  onChange={(e) => setReportDesc(e.target.value)}
                  rows={3}
                  className="w-full mt-1 rounded-md border border-white/10 bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Descreva o problema..."
                />
              </div>
              <Button onClick={handleReport} disabled={!reportReason || reporting} className="w-full gap-1.5">
                {reporting ? "Enviando..." : "Enviar relatório"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
