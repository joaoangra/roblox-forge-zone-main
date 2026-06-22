import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Cpu, Download, ExternalLink, MessageCircle, Github, Globe,
  Shield, ShieldCheck, ShieldAlert, Smartphone, Monitor,
  Apple, Check, X, Star, Heart, ThumbsDown, Bookmark,
  Search, SlidersHorizontal, ChevronDown, Sparkles,
  Crown, Trophy, Info, ArrowRight, CheckCircle2, AlertTriangle,
  TrendingUp, Clock, Users, Gamepad2, Share2, Flag,
  Copy, Maximize2, Minus, DollarSign, Lock,
} from "lucide-react";

export const Route = createFileRoute("/executors")({
  head: () => ({
    meta: [
      { title: "Executores Roblox – RBXScripts" },
      { name: "description", content: "Central definitiva de executores Roblox. Compare, avalie e baixe os melhores executores." },
    ],
  }),
  component: ExecutorsPage,
});

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  online: { label: "Online", color: "text-green-400", dot: "bg-green-400" },
  unstable: { label: "Instável", color: "text-yellow-400", dot: "bg-yellow-400" },
  offline: { label: "Offline", color: "text-red-400", dot: "bg-red-400" },
};

const SECURITY_CONFIG: Record<string, { label: string; color: string }> = {
  undetected: { label: "Não Detectado", color: "text-green-400" },
  medium_risk: { label: "Médio Risco", color: "text-yellow-400" },
  detected: { label: "Detectado", color: "text-red-400" },
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  Windows: <Monitor className="h-3.5 w-3.5" />,
  Android: <Smartphone className="h-3.5 w-3.5" />,
  iOS: <Apple className="h-3.5 w-3.5" />,
  macOS: <Apple className="h-3.5 w-3.5" />,
};

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
  return `${months}meses`;
}

function ExecutorsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [selectedSecurity, setSelectedSecurity] = useState<string>("");
  const [priceFilter, setPriceFilter] = useState<string>("");
  const [keyFilter, setKeyFilter] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedExecutor, setSelectedExecutor] = useState<any>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const { data: executors, isLoading } = useQuery({
    queryKey: ["executors"],
    queryFn: async () =>
      ((await supabase
        .from("executors")
        .select("*")
        .order("is_featured", { ascending: false })
        .order("trust_score", { ascending: false })
        .order("created_at", { ascending: false })
      ).data ?? []) as any[],
  });

  const stats = useMemo(() => {
    if (!executors) return { total: 0, online: 0, offline: 0, unstable: 0 };
    return {
      total: executors.length,
      online: executors.filter((e: any) => e.status === "online").length,
      unstable: executors.filter((e: any) => e.status === "unstable").length,
      offline: executors.filter((e: any) => e.status === "offline").length,
    };
  }, [executors]);

  const platforms = useMemo(() => {
    if (!executors) return [];
    const set = new Set<string>();
    executors.forEach((e: any) => (e.platform ?? []).forEach((p: string) => set.add(p)));
    return Array.from(set).sort();
  }, [executors]);

  const filtered = useMemo(() => {
    if (!executors) return [];
    return executors.filter((e: any) => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.description?.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedPlatforms.length > 0 && !selectedPlatforms.some((p) => (e.platform ?? []).includes(p))) return false;
      if (selectedStatus && e.status !== selectedStatus) return false;
      if (selectedSecurity && e.security_status !== selectedSecurity) return false;
      if (priceFilter === "free" && !e.is_free) return false;
      if (priceFilter === "paid" && e.is_free) return false;
      if (keyFilter === "yes" && !e.key_system) return false;
      if (keyFilter === "no" && e.key_system) return false;
      return true;
    });
  }, [executors, search, selectedPlatforms, selectedStatus, selectedSecurity, priceFilter, keyFilter]);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const openModal = useCallback((e: any) => {
    setSelectedExecutor(e);
    document.body.style.overflow = "hidden";
  }, []);

  const closeModal = useCallback(() => {
    setSelectedExecutor(null);
    document.body.style.overflow = "";
  }, []);

  useEffect(() => {
    return () => { document.body.style.overflow = ""; };
  }, []);

  useEffect(() => {
    if (!selectedExecutor) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedExecutor, closeModal]);

  async function handleLike(e: any) {
    if (!user) { toast.error("Faça login"); return; }
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch("/admin-api/like-executor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ executor_id: e.id }),
    });
    const data = await res.json();
    if (res.ok) {
      const upd = (old: any) => old?.map((x: any) => x.id === e.id ? { ...x, likes_count: data.likes_count, liked_by: data.liked ? [...(x.liked_by ?? []), user.id] : (x.liked_by ?? []).filter((id: string) => id !== user.id), dislikes_count: data.likes_count !== undefined ? data.dislikes_count ?? x.dislikes_count : x.dislikes_count, disliked_by: data.liked ? (x.disliked_by ?? []).filter((id: string) => id !== user.id) : x.disliked_by } : x);
      qc.setQueryData(["executors"], upd);
      setSelectedExecutor((prev: any) => prev?.id === e.id ? upd([prev])?.[0] ?? prev : prev);
    }
  }

  async function handleDislike(e: any) {
    if (!user) { toast.error("Faça login"); return; }
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch("/admin-api/dislike-executor", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ executor_id: e.id }),
    });
    const data = await res.json();
    if (res.ok) {
      const upd = (old: any) => old?.map((x: any) => x.id === e.id ? { ...x, dislikes_count: data.dislikes_count, disliked_by: data.disliked ? [...(x.disliked_by ?? []), user.id] : (x.disliked_by ?? []).filter((id: string) => id !== user.id), likes_count: data.likes_count ?? x.likes_count, liked_by: data.disliked ? (x.liked_by ?? []).filter((id: string) => id !== user.id) : x.liked_by } : x);
      qc.setQueryData(["executors"], upd);
      setSelectedExecutor((prev: any) => prev?.id === e.id ? upd([prev])?.[0] ?? prev : prev);
    }
  }

  async function handleShare(e: any) {
    const url = `${window.location.origin}/executors/${e.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Erro ao copiar");
    }
  }

  function handleReport(e: any) {
    toast.info("Use o link do executor para abrir um ticket no suporte.");
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-accent/30 border border-white/10 p-8 md:p-12 mb-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Cpu className="h-6 w-6 text-primary" />
              <Badge variant="outline" className="text-xs">Central de Executores</Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold mb-2">
              Executores <span className="text-gradient-brand">Roblox</span>
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl mb-6">
              A central mais completa de executores Roblox. Compare, avalie e baixe com segurança.
            </p>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="font-semibold">{stats.total}</span>
                <span className="text-muted-foreground">executores</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="font-semibold text-green-400">{stats.online}</span>
                <span className="text-muted-foreground">online</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                <span className="font-semibold text-yellow-400">{stats.unstable}</span>
                <span className="text-muted-foreground">instável</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="font-semibold text-red-400">{stats.offline}</span>
                <span className="text-muted-foreground">offline</span>
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH + FILTERS */}
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar executor..."
                className="w-full h-10 pl-9 pr-4 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`gap-1.5 transition-all ${showFilters ? "border-primary/30 bg-primary/10" : ""}`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtros
              <ChevronDown className={`h-3 w-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </Button>
          </div>

          {showFilters && (
            <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-4 animate-in slide-in-from-top-2">
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Plataforma</p>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((p) => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        selectedPlatforms.includes(p)
                          ? "bg-primary/20 border-primary/30 text-primary"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
                      }`}
                    >
                      {PLATFORM_ICONS[p] ?? null}
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["", "online", "unstable", "offline"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedStatus(selectedStatus === s ? "" : s)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                          selectedStatus === s
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-white/5 border-white/10 text-muted-foreground"
                        }`}
                      >
                        {s ? STATUS_CONFIG[s]?.label : "Todos"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Segurança</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["", "undetected", "medium_risk", "detected"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSecurity(selectedSecurity === s ? "" : s)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                          selectedSecurity === s
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-white/5 border-white/10 text-muted-foreground"
                        }`}
                      >
                        {s ? SECURITY_CONFIG[s]?.label : "Todos"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Preço</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["", "free", "paid"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriceFilter(priceFilter === p ? "" : p)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                          priceFilter === p
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-white/5 border-white/10 text-muted-foreground"
                        }`}
                      >
                        {p === "free" ? "Grátis" : p === "paid" ? "Pago" : "Todos"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Sistema de Key</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["", "yes", "no"].map((k) => (
                      <button
                        key={k}
                        onClick={() => setKeyFilter(keyFilter === k ? "" : k)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                          keyFilter === k
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-white/5 border-white/10 text-muted-foreground"
                        }`}
                      >
                        {k === "yes" ? "Com Key" : k === "no" ? "Sem Key" : "Todos"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* CARDS GRID */}
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-muted/40 animate-pulse aspect-[3/4]" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((e: any) => {
              const sc = STATUS_CONFIG[e.status] ?? STATUS_CONFIG.offline;
              const isLiked = user ? (e.liked_by ?? []).includes(user.id) : false;
              const isDisliked = user ? (e.disliked_by ?? []).includes(user.id) : false;

              return (
                <button
                  key={e.id}
                  onClick={() => openModal(e)}
                  className="group relative text-left w-full rounded-xl bg-card/50 border border-white/10 overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  {/* Image */}
                  <div className="aspect-[2/1] bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
                    {e.image_url ? (
                      <img src={e.image_url} alt={e.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="h-full w-full grid place-items-center">
                        <Cpu className="h-10 w-10 text-primary/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

                    {/* Featured badge */}
                    {e.is_featured && (
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 text-[10px] px-1.5 py-0.5 shadow-lg">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Destaque
                        </Badge>
                      </div>
                    )}

                    {/* Trust score badge */}
                    {e.trust_score > 0 && (
                      <div className="absolute top-2 right-2">
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0.5 shadow-lg">
                          <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                          Confiança {e.trust_score}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm leading-tight">{e.name}</h3>
                      {e.is_free ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">Grátis</Badge>
                      ) : e.price_brl > 0 && (
                        <Badge className="bg-gradient-to-r from-primary to-accent border-0 text-[10px] px-1.5 py-0 shrink-0">
                          R$ {Number(e.price_brl).toFixed(2)}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`flex items-center gap-1 ${sc.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                      {e.version && (
                        <>
                          <span className="text-white/10">|</span>
                          <span className="flex items-center gap-1">
                            v{e.version}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(e.platform ?? []).slice(0, 3).map((p: string) => (
                        <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-muted-foreground">
                          {PLATFORM_ICONS[p] ?? null} {p}
                        </span>
                      ))}
                    </div>

                    {/* Badges row */}
                    {(e.badges ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(e.badges ?? []).slice(0, 2).map((b: string) => (
                          <Badge key={b} variant="outline" className="text-[9px] px-1 py-0">{b}</Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hover glow */}
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ring-1 ring-inset ring-primary/20" />
                </button>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed border-white/10">
            <CardContent className="p-16 text-center text-muted-foreground">
              <Cpu className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium mb-1">Nenhum executor encontrado</p>
              <p className="text-sm">Tente ajustar os filtros ou buscar por outro nome.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedExecutor && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-2 sm:p-4"
          onClick={closeModal}
        >
          <div className="absolute inset-0 bg-background/80 backdrop-blur-md animate-in fade-in duration-200" />

          <div
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-gradient-to-b from-card via-card/95 to-card border border-white/10 shadow-2xl shadow-primary/5 animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Gradient header bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary" />

            <button
              onClick={closeModal}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center transition-all hover:scale-110"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="p-5 sm:p-6 space-y-5">
              {/* Header with glass card */}
              <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/15 via-accent/10 to-primary/5 border border-white/10 p-4 sm:p-5">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
                <div className="relative z-10 flex flex-col sm:flex-row gap-4">
                  <div className="shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-primary/40 to-accent/40 overflow-hidden border-2 border-white/10 shadow-lg shadow-primary/10">
                    {selectedExecutor.image_url ? (
                      <img src={selectedExecutor.image_url} alt={selectedExecutor.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center">
                        <Cpu className="h-8 w-8 text-primary/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-bold">{selectedExecutor.name}</h2>
                      {selectedExecutor.is_featured && (
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 text-[10px] shadow-lg">
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" /> Destaque
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 font-medium ${STATUS_CONFIG[selectedExecutor.status]?.color ?? "text-muted-foreground"}`}>
                        <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[selectedExecutor.status]?.dot ?? "bg-gray-400"}`} />
                        {STATUS_CONFIG[selectedExecutor.status]?.label ?? "—"}
                      </span>
                      {selectedExecutor.trust_score > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-medium">
                          <TrendingUp className="h-3.5 w-3.5" />
                          {selectedExecutor.trust_score}/100
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground/80 mt-2 leading-relaxed">{selectedExecutor.description}</p>
                  </div>
                </div>
              </div>

              {/* Badges */}
              {(selectedExecutor.badges ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedExecutor.badges ?? []).map((b: string) => (
                    <Badge key={b} variant="secondary" className="text-xs shadow-sm">{b}</Badge>
                  ))}
                </div>
              )}

              {/* Long description */}
              {selectedExecutor.long_description && (
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
                  <p className="text-sm text-muted-foreground/80 leading-relaxed whitespace-pre-line">{selectedExecutor.long_description}</p>
                </div>
              )}

              {/* Features */}
              {selectedExecutor.features?.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Check className="h-3 w-3 text-green-400" /> Recursos
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedExecutor.features.map((f: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs gap-1 bg-white/[0.02]">
                        <Check className="h-3 w-3 text-green-400" /> {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Primary button: Download (grátis) ou Site Oficial (pago) */}
              {selectedExecutor.is_free ? (
                <a
                  href={selectedExecutor.download_url || "#"}
                  target={selectedExecutor.download_url ? "_blank" : undefined}
                  rel="noreferrer"
                  onClick={!selectedExecutor.download_url ? (e) => { e.preventDefault(); toast.info("URL de download será adicionada em breve!"); } : undefined}
                  className="relative overflow-hidden group block w-full text-center px-5 py-4 rounded-xl bg-gradient-to-r from-primary via-primary/90 to-accent text-white font-bold text-base transition-all duration-300 hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <Download className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span>Baixar {selectedExecutor.name}</span>
                    {selectedExecutor.version && <span className="text-white/50 text-xs">v{selectedExecutor.version}</span>}
                  </div>
                </a>
              ) : (
                <a
                  href={selectedExecutor.official_site || "#"}
                  target={selectedExecutor.official_site ? "_blank" : undefined}
                  rel="noreferrer"
                  onClick={!selectedExecutor.official_site ? (e) => { e.preventDefault(); toast.info("Link do site oficial será adicionado em breve!"); } : undefined}
                  className="relative overflow-hidden group block w-full text-center px-5 py-4 rounded-xl bg-gradient-to-r from-primary via-accent to-primary text-white font-bold text-base transition-all duration-300 hover:shadow-xl hover:shadow-accent/20 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <div className="relative z-10 flex items-center justify-center gap-3">
                    <Globe className="h-5 w-5 group-hover:scale-110 transition-transform" />
                    <span>Acessar {selectedExecutor.name}</span>
                    <span className="text-white/50 text-xs">Site Oficial</span>
                  </div>
                </a>
              )}

              {/* Secondary buttons grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <a
                  href={selectedExecutor.official_site || "#"}
                  target={selectedExecutor.official_site ? "_blank" : undefined}
                  rel="noreferrer"
                  onClick={!selectedExecutor.official_site ? (e) => { e.preventDefault(); toast.info("Link oficial será adicionado em breve!"); } : undefined}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/10 hover:border-primary/30 text-xs font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group"
                >
                  <Globe className="h-4 w-4 text-primary group-hover:scale-110 transition-transform" />
                  Site Oficial
                </a>
                <a
                  href={selectedExecutor.discord_url || "#"}
                  target={selectedExecutor.discord_url ? "_blank" : undefined}
                  rel="noreferrer"
                  onClick={!selectedExecutor.discord_url ? (e) => { e.preventDefault(); toast.info("Link do Discord será adicionado em breve!"); } : undefined}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/10 hover:border-indigo-400/30 text-xs font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group"
                >
                  <MessageCircle className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                  Discord
                </a>
                {selectedExecutor.github_url && (
                  <a href={selectedExecutor.github_url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/10 hover:border-white/30 text-xs font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group"
                  >
                    <Github className="h-4 w-4 group-hover:scale-110 transition-transform" />
                    GitHub
                  </a>
                )}
                {selectedExecutor.tutorial_url && (
                  <a href={selectedExecutor.tutorial_url} target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/10 border border-white/10 hover:border-amber-400/30 text-xs font-medium transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 group"
                  >
                    <ExternalLink className="h-4 w-4 text-amber-400 group-hover:scale-110 transition-transform" />
                    Tutorial
                  </a>
                )}
              </div>

              {/* Alternate downloads */}
              {selectedExecutor.downloads_json?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Downloads Alternativos</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(selectedExecutor.downloads_json as any[]).map((d: any, i: number) => (
                      <a key={i} href={d.url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5 group"
                      >
                        <Download className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                        {d.name ?? `Download ${i + 1}`}
                        {d.type && <Badge variant="outline" className="text-[9px] ml-auto">{d.type}</Badge>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Info Grid with glass effect */}
              <div className="relative overflow-hidden rounded-xl bg-white/[0.02] border border-white/10 p-4 sm:p-5">
                <div className="absolute top-0 left-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
                <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  {selectedExecutor.developer && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Users className="h-3 w-3" /> Desenvolvedor</p>
                      <p className="font-medium mt-0.5">{selectedExecutor.developer}</p>
                    </div>
                  )}
                  {selectedExecutor.version && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3" /> Versão</p>
                      <p className="font-medium mt-0.5">{selectedExecutor.version}</p>
                    </div>
                  )}
                  {selectedExecutor.created_at && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="h-3 w-3" /> Atualização</p>
                      <p className="font-medium mt-0.5">{timeAgo(selectedExecutor.created_at)}</p>
                    </div>
                  )}
                  {selectedExecutor.execution_method && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Cpu className="h-3 w-3" /> Método</p>
                      <p className="font-medium mt-0.5">{selectedExecutor.execution_method}</p>
                    </div>
                  )}
                  {(selectedExecutor.platform ?? []).length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Monitor className="h-3 w-3" /> Plataformas</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {selectedExecutor.platform.map((p: string) => (
                          <Badge key={p} variant="outline" className="text-[10px] gap-1 bg-white/[0.03]">
                            {PLATFORM_ICONS[p] ?? null} {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><DollarSign className="h-3 w-3" /> Preço</p>
                    <p className="font-medium mt-0.5">
                      {selectedExecutor.is_free ? "Grátis" : `R$ ${Number(selectedExecutor.price_brl).toFixed(2)}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Lock className="h-3 w-3" /> Key System</p>
                    <p className={`font-medium mt-0.5 ${selectedExecutor.key_system ? "text-amber-400" : "text-green-400"}`}>
                      {selectedExecutor.key_system ? "Sim" : "Não"}
                    </p>
                  </div>
                  {selectedExecutor.rating > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Star className="h-3 w-3 text-yellow-400" /> Avaliação</p>
                      <p className="font-medium mt-0.5 flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                        {Number(selectedExecutor.rating).toFixed(1)}
                        {selectedExecutor.review_count > 0 && (
                          <span className="text-muted-foreground text-xs">({selectedExecutor.review_count})</span>
                        )}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Download className="h-3 w-3" /> Downloads</p>
                    <p className="font-medium mt-0.5">{formatCount(selectedExecutor.downloads ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Like / Dislike + Extra Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => handleLike(selectedExecutor)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 hover:scale-105 active:scale-95 ${
                    user && (selectedExecutor.liked_by ?? []).includes(user.id)
                      ? "bg-red-500/20 border-red-500/30 text-red-400 shadow-sm shadow-red-500/10"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <Heart className={`h-3.5 w-3.5 ${user && (selectedExecutor.liked_by ?? []).includes(user.id) ? "fill-red-400" : ""}`} />
                  {selectedExecutor.likes_count ?? 0}
                </button>
                <button
                  onClick={() => handleDislike(selectedExecutor)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 hover:scale-105 active:scale-95 ${
                    user && (selectedExecutor.disliked_by ?? []).includes(user.id)
                      ? "bg-amber-500/20 border-amber-500/30 text-amber-400 shadow-sm shadow-amber-500/10"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                  }`}
                >
                  <ThumbsDown className={`h-3.5 w-3.5 ${user && (selectedExecutor.disliked_by ?? []).includes(user.id) ? "fill-amber-400" : ""}`} />
                  {selectedExecutor.dislikes_count ?? 0}
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => handleShare(selectedExecutor)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 transition-all duration-200 hover:scale-105"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Compartilhar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
