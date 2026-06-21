import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Crown, Search, ShieldCheck, Eye, Heart, Sparkles, Star, Upload, Info, Gift, Zap, Flame, User, Gamepad2, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/scripts/")({
  head: () => ({
    meta: [
      { title: "Catálogo de Scripts – RBXScripts" },
      {
        name: "description",
        content: "Explore milhares de scripts Roblox verificados, gratuitos e premium.",
      },
    ],
  }),
  component: ScriptsPage,
});

function ScriptsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<"newest" | "views" | "likes">("newest");
  const [tab, setTab] = useState<"catalog" | "upload">("catalog");
  const { user } = useAuth();

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["scripts", q, cat, tagFilter, sort],
    queryFn: async () => {
      let qb = (supabase as any)
        .from("scripts")
        .select(
          "id, slug, title, description, game_name, game_link, thumbnail_url, is_premium, is_verified, is_featured, quality_score, points_rewarded, likes_count, views, copies, tags, category_id, user_id, has_key",
        )
        .eq("status", "approved");
      if (sort === "views") qb = qb.order("views", { ascending: false });
      else if (sort === "likes") qb = qb.order("likes_count", { ascending: false });
      else qb = qb.order("created_at", { ascending: false });
      if (cat) qb = qb.eq("category_id", cat);
      if (tagFilter.length > 0) qb = qb.filter('tags', 'ov', `{${tagFilter.join(',')}}`);
      if (q) qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%,game_name.ilike.%${q}%`);
      const raw = ((await qb).data ?? []) as any[];
      const userIds = [...new Set(raw.map((r: any) => r.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", userIds);
        const profileMap: Record<string, any> = {};
        for (const p of profs ?? []) profileMap[p.id] = p;
        for (const r of raw) r.profile = profileMap[r.user_id] ?? null;
      }
      return raw;
    },
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold">
                Catálogo de <span className="text-gradient-brand">Scripts</span>
              </h1>
              <p className="text-muted-foreground mt-2">Encontre o script perfeito para seu jogo.</p>
            </div>
            <Button asChild variant="outline" className="gap-2">
              <Link to="/points">
                <Star className="h-4 w-4 text-yellow-400" /> Ganhe Pontos
              </Link>
            </Button>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <Button
            size="sm"
            variant={tab === "catalog" ? "default" : "outline"}
            onClick={() => setTab("catalog")}
          >
            <Search className="h-4 w-4 mr-1" /> Catálogo
          </Button>
          {user && (
            <Button
              size="sm"
              variant={tab === "upload" ? "default" : "outline"}
              onClick={() => setTab("upload")}
            >
              <Upload className="h-4 w-4 mr-1" /> Enviar Script
            </Button>
          )}
        </div>

        {tab === "upload" && user ? (
          <ScriptUploadForm user={user} onDone={() => setTab("catalog")} />
        ) : tab === "upload" && !user ? (
          <Card className="border-white/10 bg-card/50">
            <CardContent className="p-10 text-center">
              <p className="text-muted-foreground mb-4">Faça login para enviar scripts.</p>
              <Button asChild><Link to="/auth">Entrar</Link></Button>
            </CardContent>
          </Card>
        ) : null}

        {tab === "catalog" && (
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, jogo, descrição…"
              className="pl-9 h-11"
            />
          </div>
          <div className="flex gap-1 shrink-0">
            {(["newest", "views", "likes"] as const).map((opt) => (
              <Button
                key={opt}
                size="sm"
                variant={sort === opt ? "default" : "outline"}
                onClick={() => setSort(opt)}
              >
                {opt === "newest" && "Novos"}
                {opt === "views" && <><Eye className="h-3.5 w-3.5 mr-1" />Visualizações</>}
                {opt === "likes" && <><Heart className="h-3.5 w-3.5 mr-1" />Curtidas</>}
              </Button>
            ))}
          </div>
        </div>
        )}

        {tab === "catalog" && (
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            size="sm"
            variant={cat === null ? "default" : "outline"}
            onClick={() => setCat(null)}
          >
            Todos
          </Button>
          {(categories ?? []).map((c) => (
            <Button
              key={c.id}
              size="sm"
              variant={cat === c.id ? "default" : "outline"}
              onClick={() => setCat(c.id)}
            >
              {c.name}
            </Button>
          ))}
        </div>
        )}

        {tab === "catalog" && (
        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-muted-foreground self-center mr-1">Tags:</span>
          <button
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${tagFilter.length === 0 ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"}`}
            onClick={() => setTagFilter([])}
          >Todas</button>
          {["Sem Key", "Seguro", "Indetectável", "Funciona bem", "Atualizado"].map((tag) => (
            <button
              key={tag}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-200 ${
                tagFilter.includes(tag)
                  ? "bg-primary/20 border-primary text-primary"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
              }`}
              onClick={() => setTagFilter(tagFilter.includes(tag) ? tagFilter.filter(t => t !== tag) : [...tagFilter, tag])}
            >
              {tagFilter.includes(tag) ? "✓ " : ""}{tag}
            </button>
          ))}
        </div>
        )}

        {tab === "catalog" && (isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : scripts && scripts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scripts.map((s) => {
              const pf = s.profile ?? {};
              const pfp = pf.avatar_url;
              return (
                <Link key={s.id} to="/scripts/$slug" params={{ slug: s.slug }} className="group">
                <Card className="border-white/10 bg-card/50 overflow-hidden card-hover h-full flex flex-col relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
                    {s.thumbnail_url ? (
                      <img
                        src={s.thumbnail_url}
                        alt={s.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    ) : (
                      <div className="h-full w-full grid place-items-center">
                        <Gamepad2 className="h-10 w-10 text-white/10" />
                      </div>
                    )}
                    {s.is_premium && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-2 py-1 text-[10px] font-bold text-white shadow-lg">
                        <Crown className="h-3 w-3" /> PREMIUM
                      </span>
                    )}
                    {(s.is_featured && !s.is_premium) && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-purple-600 text-white px-2 py-1 text-[10px] font-bold shadow-lg">
                        <Sparkles className="h-3 w-3" /> DESTAQUE
                      </span>
                    )}
                    {s.is_verified && !s.is_premium && !s.is_featured && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-success/90 text-success-foreground px-2 py-1 text-[10px] font-bold shadow-lg">
                        <ShieldCheck className="h-3 w-3" /> VERIFICADO
                      </span>
                    )}
                    {s.quality_score >= 80 && !s.is_premium && !s.is_featured && !s.is_verified && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 px-2 py-1 text-[10px] font-bold text-purple-300 border border-purple-500/30">
                        💎 Elite
                      </span>
                    )}
                    {s.has_key === false && (
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-success/90 text-success-foreground px-2 py-1 text-[10px] font-bold shadow-lg z-20">
                        🔓 Sem Key
                      </span>
                    )}
                    {s.has_key === true && (
                      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-600/90 text-white px-2 py-1 text-[10px] font-bold shadow-lg z-20">
                        🔒 Com Key
                      </span>
                    )}
                  </div>
                  <CardContent className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
                      <Gamepad2 className="h-3 w-3" />
                      <span>{s.game_name ?? "Universal"}</span>
                    </div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">
                      {s.title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem] flex-1">
                      {s.description}
                    </p>
                    {s.tags && s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(s.tags as string[]).map((tag: string) => (
                          <span
                            key={tag}
                            className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3 w-3" /> {s.views}
                      </span>
                      {s.likes_count > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-3 w-3" /> {s.likes_count}
                        </span>
                      )}
                      {s.copies > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Copy className="h-3 w-3" /> {s.copies}
                        </span>
                      )}
                      {s.points_rewarded > 0 && (
                        <span className="inline-flex items-center gap-1 text-yellow-400 font-medium">
                          <Star className="h-3 w-3" /> +{s.points_rewarded} SP
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden shrink-0 ring-1 ring-white/10">
                        {pfp ? (
                          <img src={pfp} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full grid place-items-center">
                            <User className="h-3 w-3 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate">
                        {pf.username ?? "Usuário"}
                      </span>
                      {s.game_link && (
                        <span className="ml-auto text-[10px] text-primary flex items-center gap-0.5"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(s.game_link, "_blank"); }}
                        >
                          <ExternalLink className="h-3 w-3" /> Jogo
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )})}
          </div>
        ) : (
          <Card className="border-dashed border-white/10">
            <CardContent className="p-16 text-center text-muted-foreground">
              Nenhum script encontrado.
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}

function ScriptUploadForm({ user, onDone }: { user: any; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [gameName, setGameName] = useState("");
  const [gameLink, setGameLink] = useState("");
  const [supportedExecutorsRaw, setSupportedExecutorsRaw] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  async function uploadThumbnail(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 2MB"); return; }
    setUploadingImg(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `upload-${user.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("script-thumbnails").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("script-thumbnails").getPublicUrl(path);
      setThumbnailUrl(pub.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar imagem");
    }
    setUploadingImg(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !code.trim()) return;
    setSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) return;
      const body: Record<string, unknown> = {
        title: title.trim(),
        code,
        description: description.trim(),
        game_name: gameName.trim(),
        game_link: gameLink.trim(),
        thumbnail_url: thumbnailUrl || null,
        has_key: !tags.includes("Sem Key"),
        is_obfuscated: false,
        tags,
        category_id: categoryId,
      };
      const executors = supportedExecutorsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (executors.length > 0) body.supported_executors = executors;

      const res = await fetch("/admin-api/submit-script", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      toast.success("Script enviado para revisão! " + (data.estimated_points ? `(~${data.estimated_points} SP estimados)` : ""));
      onDone();
    } catch (err: any) {
      toast.error(err.message);
    }
    setSubmitting(false);
  }

  return (
    <Card className="border-white/10 bg-card/50 mb-8">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" /> Enviar Script
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Meu Script Incrível" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Descreva o que seu script faz..." />
          </div>
          <div>
            <Label>Código *</Label>
            <Textarea value={code} onChange={(e) => setCode(e.target.value)} rows={10} required placeholder="-- Cole seu código Lua aqui" className="font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Jogo</Label>
              <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Ex: Brookhaven" />
            </div>
            <div>
              <Label>Link do Jogo</Label>
              <Input value={gameLink} onChange={(e) => setGameLink(e.target.value)} placeholder="https://roblox.com/games/..." />
            </div>
          </div>
          <div>
            <Label>Imagem (URL ou upload)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://..." className="flex-1" />
              <label className={`h-10 px-3 rounded-md border border-white/10 flex items-center cursor-pointer hover:bg-white/5 text-xs text-muted-foreground ${uploadingImg ? "opacity-50 pointer-events-none" : ""}`}>
                <Upload className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={uploadThumbnail} disabled={uploadingImg} />
              </label>
            </div>
            {thumbnailUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-white/10 max-h-32 max-w-xs">
                <img src={thumbnailUrl} alt="Preview" className="w-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
          </div>
          <div>
            <Label>Executores Suportados (separados por vírgula)</Label>
            <Input value={supportedExecutorsRaw} onChange={(e) => setSupportedExecutorsRaw(e.target.value)} placeholder="Solara, Xeno, Codex" />
          </div>
          <div>
            <Label>Categoria</Label>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="flex h-10 w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
            >
              <option value="">Sem categoria</option>
              {(categories ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Marque o que se aplica ao seu script:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {["Sem Key", "Seguro", "Indetectável", "Funciona bem", "Atualizado"].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                    tags.includes(tag)
                      ? "bg-primary/20 border-primary text-primary border-primary/40"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  {tags.includes(tag) ? "✓ " : ""}{tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <ShieldCheck className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-300/90">
              <p className="font-semibold mb-1">⚠️ A equipe BuxHub verifica manualmente todas as informações.</p>
              <p className="opacity-80">Informações falsas podem resultar em <span className="font-medium">remoção de pontos ou suspensão</span> da conta.</p>
            </div>
          </div>

          <details className="group border border-white/10 rounded-lg">
            <summary className="flex items-center gap-2 p-3 cursor-pointer text-sm font-medium hover:text-primary transition-colors">
              <Info className="h-4 w-4 text-primary" /> Como funcionam os pontos
            </summary>
            <div className="px-3 pb-4 text-xs text-muted-foreground space-y-3">

              <p>Ganhe <span className="text-yellow-400 font-medium">Bux Points (SP)</span> quando seu script for <span className="text-green-400 font-medium">aprovado</span> pela equipe.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="font-semibold text-yellow-400 mb-1">📦 Basic</div>
                  <p>Qualidade &lt; 50</p>
                  <p className="text-yellow-400 font-bold text-sm mt-1">+2 SP</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="font-semibold text-yellow-400 mb-1">⭐ Good</div>
                  <p>Qualidade ≥ 50</p>
                  <p className="text-yellow-400 font-bold text-sm mt-1">+5 SP</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="font-semibold text-yellow-400 mb-1">💎 Elite</div>
                  <ul className="list-disc list-inside text-[11px] opacity-80 space-y-0.5">
                    <li>Qualidade ≥ 80</li>
                    <li>Sem key system</li>
                    <li>Funcionando</li>
                    <li>Atualizado</li>
                    <li>Aprovado pela equipe</li>
                  </ul>
                  <p className="text-yellow-400 font-bold text-sm mt-1">+10 SP</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="font-semibold text-purple-400 mb-1"><Sparkles className="h-3 w-3 inline" /> Destaque</div>
                  <p>Selecionado pela equipe BuxHub</p>
                  <p className="text-yellow-400 font-bold text-sm mt-1">+25 SP bônus</p>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <h4 className="font-medium mb-2 flex items-center gap-1.5 text-xs"><Crown className="h-3.5 w-3.5 text-primary" /> Bônus Premium</h4>
                <p>Usuários Premium ganham <span className="text-primary font-semibold">1.5x mais pontos</span> em uploads de scripts.</p>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div className="bg-primary/10 rounded-lg p-2 text-center">
                    <div className="text-[10px] opacity-70">Basic</div>
                    <div className="text-sm font-bold text-primary">3 SP</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-2 text-center">
                    <div className="text-[10px] opacity-70">Good</div>
                    <div className="text-sm font-bold text-primary">8 SP</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-2 text-center">
                    <div className="text-[10px] opacity-70">Elite</div>
                    <div className="text-sm font-bold text-primary">15 SP</div>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-3">
                <h4 className="font-medium mb-2 flex items-center gap-1.5 text-xs"><Flame className="h-3.5 w-3.5 text-orange-400" /> Limite diário de uploads recompensados</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-2.5">
                    <div className="font-medium text-xs">Usuário Free</div>
                    <p className="text-[11px] opacity-70">Máximo de <span className="text-yellow-400 font-medium">3 uploads</span> recompensados por dia.</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2.5">
                    <div className="font-medium text-xs">Usuário Premium</div>
                    <p className="text-[11px] opacity-70">Máximo de <span className="text-yellow-400 font-medium">10 uploads</span> recompensados por dia.</p>
                  </div>
                </div>
                <p className="text-[11px] opacity-60 mt-1">Após atingir o limite, ainda pode enviar scripts normalmente, porém não ganhará SP.</p>
              </div>

              <div className="border-t border-white/10 pt-3">
                <h4 className="font-medium mb-2 flex items-center gap-1.5 text-xs"><Zap className="h-3.5 w-3.5 text-yellow-400" /> Sistema Anti-Spam (redução de recompensas)</h4>
                <p className="text-[11px] opacity-70 mb-2">Quanto mais scripts você enviar no mesmo dia, menor será a recompensa. Isso existe para evitar spam e manter a economia saudável.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-2.5">
                    <div className="font-medium text-xs mb-1">Usuários Free</div>
                    <div className="space-y-0.5 text-[11px]">
                      <p>1º upload → <span className="text-green-400">100%</span></p>
                      <p>2º upload → <span className="text-yellow-400">80%</span></p>
                      <p>3º upload → <span className="text-orange-400">60%</span></p>
                      <p className="text-red-400">4º+ upload → 0%</p>
                    </div>
                    <p className="text-[10px] opacity-50 mt-1">Ex: Elite = 10 + 8 + 6 = 24 SP máximo/dia</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-2.5">
                    <div className="font-medium text-xs mb-1">Usuários Premium</div>
                    <div className="space-y-0.5 text-[11px]">
                      <p>1º upload → <span className="text-green-400">100%</span></p>
                      <p>2º upload → <span className="text-green-400">95%</span></p>
                      <p>3º upload → <span className="text-yellow-400">90%</span></p>
                      <p>4º upload → <span className="text-yellow-400">85%</span></p>
                      <p>5º upload → <span className="text-yellow-400">80%</span></p>
                      <p>6º upload → <span className="text-orange-400">70%</span></p>
                      <p>7º upload → <span className="text-orange-400">60%</span></p>
                      <p>8º upload → <span className="text-red-400">50%</span></p>
                      <p>9º upload → <span className="text-red-400">40%</span></p>
                      <p>10º upload → <span className="text-red-400">30%</span></p>
                      <p className="text-red-400">11º+ upload → 0%</p>
                    </div>
                  </div>
                </div>
                <div className="bg-primary/5 rounded-lg p-2.5 mt-2">
                  <p className="font-medium text-xs">Exemplo Premium (Script Elite Premium = 15 SP base):</p>
                  <div className="grid grid-cols-2 gap-x-4 text-[11px] mt-1">
                    <p>1º = <span className="text-yellow-400">15 SP</span></p>
                    <p>2º = <span className="text-yellow-400">14,25 SP</span></p>
                    <p>3º = <span className="text-yellow-400">13,5 SP</span></p>
                    <p>4º = <span className="text-yellow-400">12,75 SP</span></p>
                    <p>5º = <span className="text-yellow-400">12 SP</span></p>
                    <p>6º = <span className="text-yellow-400">10,5 SP</span></p>
                    <p>7º = <span className="text-yellow-400">9 SP</span></p>
                    <p>8º = <span className="text-yellow-400">7,5 SP</span></p>
                    <p>9º = <span className="text-yellow-400">6 SP</span></p>
                    <p>10º = <span className="text-yellow-400">4,5 SP</span></p>
                  </div>
                  <p className="text-[11px] text-primary font-medium mt-1">Total máximo ≈ 104 SP por dia</p>
                </div>
              </div>

            </div>
          </details>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Enviando..." : "Enviar para Revisão"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
