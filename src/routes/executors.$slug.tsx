import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";
import {
  Cpu, Download, ExternalLink, MessageCircle, Globe, Github,
  Shield, ShieldCheck, ShieldAlert, Smartphone, Monitor, Apple,
  Heart, ThumbsDown, Star, Copy, Check, ArrowLeft,
  Clock, Gamepad2, Users, Sparkles, Crown, TrendingUp,
  BarChart3, X, Send, Calendar, DollarSign, Lock, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/executors/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} – Executor Roblox` }] }),
  component: ExecutorDetail,
});

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  online: { label: "Online", color: "text-green-400", icon: "🟢" },
  unstable: { label: "Instável", color: "text-yellow-400", icon: "🟡" },
  offline: { label: "Offline", color: "text-red-400", icon: "🔴" },
};

const SECURITY_CONFIG: Record<string, { label: string; color: string }> = {
  undetected: { label: "Não Detectado", color: "text-green-400" },
  medium_risk: { label: "Médio Risco", color: "text-yellow-400" },
  detected: { label: "Detectado", color: "text-red-400" },
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  Windows: <Monitor className="h-4 w-4" />,
  Android: <Smartphone className="h-4 w-4" />,
  iOS: <Apple className="h-4 w-4" />,
  macOS: <Apple className="h-4 w-4" />,
};

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
  return `${months}meses`;
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function ExecutorDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [liking, setLiking] = useState(false);
  const [disliking, setDisliking] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewContent, setReviewContent] = useState("");
  const [reviewWorking, setReviewWorking] = useState<boolean | null>(null);
  const [reviewDetected, setReviewDetected] = useState<boolean | null>(null);
  const [reviewBugs, setReviewBugs] = useState<boolean | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const { data: executor, isLoading } = useQuery({
    queryKey: ["executor", slug],
    queryFn: async () =>
      ((await supabase.from("executors").select("*").eq("slug", slug).maybeSingle()).data ?? null) as any,
  });

  const { data: reviews, refetch: refetchReviews } = useQuery({
    queryKey: ["executor-reviews", executor?.id],
    enabled: !!executor?.id,
    queryFn: async () =>
      ((await supabase
        .from("executor_reviews")
        .select("*")
        .eq("executor_id", executor!.id)
        .order("created_at", { ascending: false })
      ).data ?? []) as any[],
  });

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ["executor-comments", executor?.id],
    enabled: !!executor?.id,
    queryFn: async () =>
      ((await supabase
        .from("executor_comments")
        .select("*")
        .eq("executor_id", executor!.id)
        .order("created_at", { ascending: false })
      ).data ?? []) as any[],
  });

  async function handleLike() {
    if (!user || liking || !executor) return;
    setLiking(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setLiking(false); return; }
    const res = await fetch("/admin-api/like-executor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ executor_id: executor.id }),
    });
    const data = await res.json();
    if (res.ok) {
      qc.setQueryData(["executor", slug], (old: any) => old ? { ...old, likes_count: data.likes_count, liked_by: data.liked ? [...(old.liked_by ?? []), user.id] : (old.liked_by ?? []).filter((id: string) => id !== user.id), dislikes_count: data.dislikes_count ?? old.dislikes_count, disliked_by: data.liked ? (old.disliked_by ?? []).filter((id: string) => id !== user.id) : old.disliked_by } : old);
    }
    setLiking(false);
  }

  async function handleDislike() {
    if (!user || disliking || !executor) return;
    setDisliking(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setDisliking(false); return; }
    const res = await fetch("/admin-api/dislike-executor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ executor_id: executor.id }),
    });
    const data = await res.json();
    if (res.ok) {
      qc.setQueryData(["executor", slug], (old: any) => old ? { ...old, dislikes_count: data.dislikes_count, disliked_by: data.disliked ? [...(old.disliked_by ?? []), user.id] : (old.disliked_by ?? []).filter((id: string) => id !== user.id), likes_count: data.likes_count ?? old.likes_count, liked_by: data.disliked ? (old.liked_by ?? []).filter((id: string) => id !== user.id) : old.liked_by } : old);
    }
    setDisliking(false);
  }

  async function handleSubmitReview() {
    if (!user || !executor || reviewRating === 0) { toast.error("Selecione uma nota"); return; }
    setSubmittingReview(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setSubmittingReview(false); return; }
    const res = await fetch("/admin-api/review-executor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        executor_id: executor.id,
        rating: reviewRating,
        title: reviewTitle,
        content: reviewContent,
        is_working: reviewWorking,
        is_detected: reviewDetected,
        has_bugs: reviewBugs,
      }),
    });
    if (res.ok) {
      toast.success("Review enviada!");
      setReviewRating(0);
      setReviewTitle("");
      setReviewContent("");
      setReviewWorking(null);
      setReviewDetected(null);
      setReviewBugs(null);
      refetchReviews();
      qc.invalidateQueries({ queryKey: ["executor", slug] });
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Erro ao enviar review");
    }
    setSubmittingReview(false);
  }

  async function handleSubmitComment() {
    if (!user || !executor || !commentText.trim()) return;
    setSubmittingComment(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setSubmittingComment(false); return; }
    const res = await fetch("/admin-api/comment-executor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ executor_id: executor.id, content: commentText.trim() }),
    });
    if (res.ok) {
      toast.success("Comentário enviado!");
      setCommentText("");
      refetchComments();
    } else {
      toast.error("Erro ao enviar comentário");
    }
    setSubmittingComment(false);
  }

  if (isLoading) {
    return (
      <PageShell>
        <div className="mx-auto max-w-5xl px-4 py-8 space-y-4 animate-pulse">
          <div className="h-5 w-32 bg-muted/40 rounded" />
          <div className="aspect-[3/1] rounded-2xl bg-muted/40" />
          <div className="h-8 w-3/4 bg-muted/40 rounded" />
          <div className="h-4 w-full bg-muted/40 rounded" />
          <div className="h-4 w-2/3 bg-muted/40 rounded" />
        </div>
      </PageShell>
    );
  }

  if (!executor) {
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <Cpu className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">Executor não encontrado.</p>
          <Button asChild className="mt-4">
            <Link to="/executors"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const e = executor;
  const sc = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.offline;
  const sec = SECURITY_CONFIG[e.security_status] ?? SECURITY_CONFIG.undetected;
  const isLiked = user ? (e.liked_by ?? []).includes(user.id) : false;
  const isDisliked = user ? (e.disliked_by ?? []).includes(user.id) : false;
  const downloadsArr: { name?: string; url?: string; type?: string }[] = e.downloads_json ?? [];

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4 group">
          <Link to="/executors">
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" /> Executores
          </Link>
        </Button>

        {/* BANNER */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/30 via-accent/20 to-primary/10 border border-white/10 mb-6">
          <div className="aspect-[3/1] md:aspect-[4/1] relative">
            {e.image_url ? (
              <img src={e.image_url} alt={e.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center">
                <Cpu className="h-20 w-20 text-primary/20" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-end gap-2">
              {e.is_featured && (
                <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 shadow-lg">
                  <Sparkles className="h-3 w-3 mr-1" /> Destaque
                </Badge>
              )}
              {(e.badges ?? []).map((b: string) => (
                <Badge key={b} variant="secondary" className="shadow-lg text-xs">{b}</Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* MAIN CONTENT */}
          <div className="flex-1 min-w-0 space-y-6">
            {/* HEADER */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold">{e.name}</h1>
                {e.is_free ? (
                  <Badge variant="secondary">Grátis</Badge>
                ) : (
                  <Badge className="bg-gradient-to-r from-primary to-accent border-0">R$ {Number(e.price_brl).toFixed(2)}</Badge>
                )}
              </div>
              <p className="text-muted-foreground text-sm">{e.description}</p>
            </div>

            {/* TRUST SCORE */}
            {e.trust_score > 0 && (
              <Card className="border-white/10 bg-card/50 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="relative w-16 h-16 shrink-0">
                      <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/10" />
                        <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={`${(e.trust_score / 100) * 97.39} 97.39`} className="text-green-400" strokeLinecap="round" />
                      </svg>
                      <span className="absolute inset-0 grid place-items-center text-sm font-bold text-green-400">{e.trust_score}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-green-400" /> Confiança
                      </p>
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {e.trust_score_components && (
                          <>
                            <span>Segurança {(e.trust_score_components as any).security ?? 0}%</span>
                            <span>Feedback {(e.trust_score_components as any).feedback ?? 0}%</span>
                            <span>Atualizações {(e.trust_score_components as any).updates ?? 0}%</span>
                            <span>Estabilidade {(e.trust_score_components as any).stability ?? 0}%</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* DESCRIPTION */}
            {e.long_description && (
              <div>
                <h2 className="font-semibold text-lg mb-2">Sobre</h2>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{e.long_description}</p>
              </div>
            )}

            {/* FEATURES */}
            {e.features && e.features.length > 0 && (
              <div>
                <h2 className="font-semibold text-lg mb-2">Recursos</h2>
                <div className="grid sm:grid-cols-2 gap-2">
                  {e.features.map((f: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-green-400 shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DOWNLOADS */}
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
                  <Download className="h-4 w-4 text-primary" /> Downloads
                </h3>
                <div className="space-y-2">
                  {e.download_url && (
                    <Button asChild className="w-full bg-gradient-to-r from-primary to-accent text-white border-0 gap-2">
                      <a href={e.download_url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" /> Download Principal
                      </a>
                    </Button>
                  )}
                  {downloadsArr.map((d, i) => (
                    <Button key={i} asChild variant="outline" className="w-full gap-2">
                      <a href={d.url} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4" /> {d.name ?? `Download ${i + 1}`}
                        {d.type && <Badge variant="secondary" className="text-[10px] ml-auto">{d.type}</Badge>}
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* REVIEWS */}
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-1.5">
                  <Star className="h-4 w-4 text-yellow-400" /> Avaliações ({reviews?.length ?? 0})
                </h3>

                {/* Review form */}
                {user && (
                  <div className="mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/10 space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">Sua avaliação</p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((r) => (
                        <button key={r} onClick={() => setReviewRating(r)} className="transition-all hover:scale-110">
                          <Star className={`h-5 w-5 ${r <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-white/20"}`} />
                        </button>
                      ))}
                    </div>
                    <input
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Título (opcional)"
                      className="w-full h-9 px-3 rounded-md bg-white/5 border border-white/10 text-sm"
                    />
                    <textarea
                      value={reviewContent}
                      onChange={(e) => setReviewContent(e.target.value)}
                      placeholder="Escreva sua avaliação..."
                      rows={3}
                      className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm resize-none"
                    />
                    <div className="flex flex-wrap gap-2 text-xs">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={reviewWorking === true} onChange={() => setReviewWorking(reviewWorking === true ? null : true)} className="rounded" />
                        Funcionando
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={reviewDetected === true} onChange={() => setReviewDetected(reviewDetected === true ? null : true)} className="rounded" />
                        Detectado
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={reviewBugs === true} onChange={() => setReviewBugs(reviewBugs === true ? null : true)} className="rounded" />
                        Com Bugs
                      </label>
                    </div>
                    <Button size="sm" onClick={handleSubmitReview} disabled={reviewRating === 0 || submittingReview} className="gap-1.5">
                      {submittingReview ? "Enviando..." : <Send className="h-3.5 w-3.5" />} Enviar Avaliação
                    </Button>
                  </div>
                )}

                {/* Reviews list */}
                <div className="space-y-3">
                  {reviews?.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma avaliação ainda.</p>
                  )}
                  {reviews?.map((r: any) => (
                    <div key={r.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-white/10"}`} />
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-auto">{timeAgo(r.created_at)}</span>
                      </div>
                      {r.title && <p className="text-sm font-medium">{r.title}</p>}
                      {r.content && <p className="text-xs text-muted-foreground mt-0.5">{r.content}</p>}
                      <div className="flex gap-2 mt-1.5">
                        {r.is_working === true && <Badge variant="outline" className="text-[10px] text-green-400">Funcionando</Badge>}
                        {r.is_detected === true && <Badge variant="outline" className="text-[10px] text-red-400">Detectado</Badge>}
                        {r.has_bugs === true && <Badge variant="outline" className="text-[10px] text-yellow-400">Com Bugs</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* COMMENTS */}
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-1.5">
                  <MessageCircle className="h-4 w-4 text-primary" /> Comentários ({comments?.length ?? 0})
                </h3>

                {user && (
                  <div className="flex gap-2 mb-4">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Comente algo sobre este executor..."
                      className="flex-1 h-9 px-3 rounded-md bg-white/5 border border-white/10 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
                    />
                    <Button size="sm" onClick={handleSubmitComment} disabled={!commentText.trim() || submittingComment}>
                      {submittingComment ? "..." : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {comments?.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum comentário ainda.</p>
                  )}
                  {comments?.map((c: any) => (
                    <div key={c.id} className="p-3 rounded-lg bg-white/[0.02] border border-white/5">
                      <p className="text-sm">{c.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(c.created_at)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SIDEBAR */}
          <div className="w-full lg:w-72 shrink-0 space-y-4">
            {/* Status card */}
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{sc.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold ${sc.color}`}>{sc.label}</p>
                    <p className="text-[10px] text-muted-foreground">Status</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sec.color === "text-green-400" ? <ShieldCheck className="h-4 w-4 text-green-400" /> : <ShieldAlert className={`h-4 w-4 ${sec.color}`} />}
                  <div>
                    <p className={`text-sm font-semibold ${sec.color}`}>{sec.label}</p>
                    <p className="text-[10px] text-muted-foreground">Segurança</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info card */}
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Versão</span>
                  <span className="font-medium">{e.version ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Desenvolvedor</span>
                  <span className="font-medium">{e.developer ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Sistema de Key</span>
                  <span className={e.key_system ? "text-amber-400" : "text-green-400"}>{e.key_system ? "Sim" : "Não"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Método</span>
                  <span className="font-medium">{e.execution_method ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Downloads</span>
                  <span className="font-medium">{formatCount(e.downloads ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Avaliação</span>
                  <span className="font-medium">{e.rating > 0 ? `⭐ ${Number(e.rating).toFixed(1)}` : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Criado em</span>
                  <span className="font-medium text-xs">{new Date(e.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </CardContent>
            </Card>

            {/* Platforms */}
            {e.platform && e.platform.length > 0 && (
              <Card className="border-white/10 bg-card/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Plataformas</p>
                  <div className="flex flex-wrap gap-2">
                    {e.platform.map((p: string) => (
                      <Badge key={p} variant="outline" className="gap-1 text-xs">
                        {PLATFORM_ICONS[p] ?? null} {p}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Links */}
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Links</p>
                {e.official_site && (
                  <Button asChild variant="outline" size="sm" className="w-full gap-1.5 justify-start">
                    <a href={e.official_site} target="_blank" rel="noreferrer"><Globe className="h-3.5 w-3.5" /> Site Oficial</a>
                  </Button>
                )}
                {e.discord_url && (
                  <Button asChild variant="outline" size="sm" className="w-full gap-1.5 justify-start">
                    <a href={e.discord_url} target="_blank" rel="noreferrer"><MessageCircle className="h-3.5 w-3.5 text-indigo-400" /> Discord</a>
                  </Button>
                )}
                {e.github_url && (
                  <Button asChild variant="outline" size="sm" className="w-full gap-1.5 justify-start">
                    <a href={e.github_url} target="_blank" rel="noreferrer"><Github className="h-3.5 w-3.5" /> GitHub</a>
                  </Button>
                )}
                {e.tutorial_url && (
                  <Button asChild variant="outline" size="sm" className="w-full gap-1.5 justify-start">
                    <a href={e.tutorial_url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Tutorial</a>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Like/Dislike */}
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <Button
                    variant={isLiked ? "default" : "outline"}
                    size="sm"
                    onClick={handleLike}
                    disabled={!user || liking}
                    className={`flex-1 gap-1.5 ${isLiked ? "bg-red-500/20 text-red-400 border-red-500/30" : ""}`}
                  >
                    <Heart className={`h-4 w-4 ${isLiked ? "fill-red-400" : ""}`} />
                    {e.likes_count ?? 0}
                  </Button>
                  <Button
                    variant={isDisliked ? "default" : "outline"}
                    size="sm"
                    onClick={handleDislike}
                    disabled={!user || disliking}
                    className={`flex-1 gap-1.5 ${isDisliked ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : ""}`}
                  >
                    <ThumbsDown className={`h-4 w-4 ${isDisliked ? "fill-amber-400" : ""}`} />
                    {e.dislikes_count ?? 0}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Requirements */}
            {e.requirements && (
              <Card className="border-white/10 bg-card/50">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Requisitos</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{e.requirements}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
