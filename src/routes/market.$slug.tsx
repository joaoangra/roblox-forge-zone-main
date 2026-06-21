import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { brl } from "@/lib/marketplace";
import {
  Shield,
  Star,
  ShoppingCart,
  MessageCircle,
  Flag,
  BadgeCheck,
  AlertTriangle,
  Share2,
  Copy,
  Home,
  ChevronRight,
  Clock,
  Package,
  Eye,
} from "lucide-react";

export const Route = createFileRoute("/market/$slug")({ component: ListingPage });

function ListingPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", slug],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("listings")
          .select(
            "*, category:marketplace_categories(name, slug), roblox_game:roblox_games(name), images:listing_images(*), questions:listing_questions(*)",
          )
          .eq("slug", slug)
          .maybeSingle()
      ).data as any,
  });

  const { data: options } = useQuery({
    queryKey: ["listing-options", slug],
    queryFn: async () => {
      const { data: optData } = await (supabase as any)
        .from("listing_options")
        .select("*")
        .eq("listing_id", (listing as any)?.id ?? "")
        .order("sort_order");
      return (optData ?? []) as any[];
    },
    enabled: !!listing,
  });

  const { data: seller } = useQuery({
    queryKey: ["listing-seller", listing?.seller_id],
    enabled: !!listing?.seller_id,
    queryFn: async () => {
      const [p, sp] = await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name, avatar_url")
          .eq("id", listing!.seller_id)
          .maybeSingle(),
        supabase
          .from("seller_profiles")
          .select("*")
          .eq("user_id", listing!.seller_id)
          .maybeSingle(),
      ]);
      return { profile: p.data, seller_profile: sp.data };
    },
  });

  if (isLoading)
    return (
      <PageShell>
        <div className="mx-auto max-w-6xl px-4 py-12">Carregando…</div>
      </PageShell>
    );
  if (!listing)
    return (
      <PageShell>
        <div className="mx-auto max-w-6xl px-4 py-12">Anúncio não encontrado.</div>
      </PageShell>
    );

  const l = listing as any;

  const effectivePrice = (() => {
    let base = l.price_cents;
    if (selectedOptionId && options) {
      const opt = options.find((o: any) => o.id === selectedOptionId);
      if (opt) base = l.price_cents + opt.price_adjustment_cents;
    }
    return base * Math.max(1, quantity);
  })();

  function buy() {
    if (!user) {
      router.navigate({ to: "/auth" });
      return;
    }
    if (user.id === l.seller_id) {
      toast.error("Você não pode comprar o próprio anúncio");
      return;
    }
    router.navigate({
      to: "/checkout",
      search: {
        listing_id: l.id,
        option_id: selectedOptionId || undefined,
        quantity,
      } as any,
    });
  }

  async function askQuestion() {
    if (!user) {
      router.navigate({ to: "/auth" });
      return;
    }
    if (!question.trim()) return;
    const { error } = await supabase
      .from("listing_questions")
      .insert({ listing_id: l.id, user_id: user.id, question });
    if (error) {
      toast.error(error.message);
      return;
    }
    setQuestion("");
    toast.success("Pergunta enviada");
    qc.invalidateQueries({ queryKey: ["listing", slug] });
  }

  const sp = seller?.seller_profile;
  const sellerProfile = seller?.profile;

  // Track view (fire and forget)
  if (l?.id && typeof window !== "undefined") {
    (supabase as any).from("listing_events").insert({
      listing_id: l.id,
      actor_id: user?.id ?? null,
      event_type: "view",
    }).then(() => {
      (supabase as any).rpc("increment_listing_views", { row_id: l.id }).catch(() => {});
    }).catch(() => {});
  }

  // Related products (same category, excluding current)
  const { data: related } = useQuery({
    queryKey: ["related-listings", l.category_id, l.id],
    enabled: !!l.category_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("listings")
        .select("id, title, slug, price_cents, cover_image_url, rating, total_reviews")
        .eq("status", "active")
        .eq("category_id", l.category_id)
        .neq("id", l.id)
        .order("featured", { ascending: false })
        .order("sales_count", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  async function shareClick(channel: string) {
    const url = window.location.href;
    const text = `Confira este anúncio: ${l.title}`;
    const encoded = encodeURIComponent(text + " " + url);
    switch (channel) {
      case "copy":
        await navigator.clipboard.writeText(url);
        toast.success("Link copiado!");
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encoded}`, "_blank");
        break;
      case "discord":
        window.open(`https://discord.com/share?text=${encoded}`, "_blank");
        break;
      case "telegram":
        window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encoded}`, "_blank");
        break;
    }
    (supabase as any).from("listing_events").insert({
      listing_id: l.id, actor_id: user?.id ?? null, event_type: "share", channel,
    }).catch(() => {});
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/"><Home className="h-3 w-3" /></Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator><ChevronRight className="h-3 w-3" /></BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/market">Marketplace</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {(l.category as { name?: string })?.name && (
            <>
              <BreadcrumbSeparator><ChevronRight className="h-3 w-3" /></BreadcrumbSeparator>
              <BreadcrumbItem>
                <BreadcrumbLink>{(l.category as { name: string }).name}</BreadcrumbLink>
              </BreadcrumbItem>
            </>
          )}
          <BreadcrumbSeparator><ChevronRight className="h-3 w-3" /></BreadcrumbSeparator>
          <BreadcrumbItem>
            <BreadcrumbLink className="text-muted-foreground truncate max-w-[200px]">{l.title}</BreadcrumbLink>
          </BreadcrumbItem>
        </Breadcrumb>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10 relative">
              {l.cover_image_url ? (
                <img
                  src={l.cover_image_url}
                  alt={l.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : null}
              {l.featured && (
                <Badge className="absolute top-3 left-3 bg-gradient-to-r from-primary to-accent border-0">
                  Destaque
                </Badge>
              )}
            </div>
            {l.images && l.images.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {l.images.map((img: { id: string; url: string }) => (
                  <img
                    key={img.id}
                    src={img.url}
                    alt=""
                    className="aspect-square object-cover rounded-lg"
                    loading="lazy"
                  />
                ))}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {l.category && (
                  <Badge variant="outline">{(l.category as { name: string }).name}</Badge>
                )}
                {(l.roblox_game as { name?: string } | null)?.name && <Badge variant="outline">{(l.roblox_game as { name: string }).name}</Badge>}
                <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                  <Eye className="h-3 w-3" /> {l.views ?? 0} visualizações
                </div>
              </div>
              <h1 className="text-3xl font-bold mb-3">{l.title}</h1>
              {l.short_description && (
                <p className="text-muted-foreground mb-4">{l.short_description}</p>
              )}
              <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">
                {l.description}
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-white/10 bg-card/50">
                <CardContent className="p-3 text-center">
                  <Package className="h-4 w-4 mx-auto text-muted-foreground" />
                  <div className="text-xs text-muted-foreground mt-1">Estoque</div>
                  <div className="font-semibold">{l.unlimited_stock ? "∞" : l.stock ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-card/50">
                <CardContent className="p-3 text-center">
                  <ShoppingCart className="h-4 w-4 mx-auto text-muted-foreground" />
                  <div className="text-xs text-muted-foreground mt-1">Vendidos</div>
                  <div className="font-semibold">{l.sales_count ?? 0}</div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-card/50">
                <CardContent className="p-3 text-center">
                  <Star className="h-4 w-4 mx-auto text-yellow-500" />
                  <div className="text-xs text-muted-foreground mt-1">Avaliação</div>
                  <div className="font-semibold">{Number(l.rating ?? 0).toFixed(1)}</div>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-card/50">
                <CardContent className="p-3 text-center">
                  <Clock className="h-4 w-4 mx-auto text-muted-foreground" />
                  <div className="text-xs text-muted-foreground mt-1">Entrega</div>
                  <div className="font-semibold capitalize">{l.delivery_type === "manual" ? "Combinar" : l.delivery_type === "instant_code" ? "Instantânea" : "Serviço"}</div>
                </CardContent>
              </Card>
            </div>

            {/* Questions */}
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-3 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" /> Perguntas
                </h2>
                <div className="flex gap-2 mb-4">
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Tire suas dúvidas com o vendedor…"
                    rows={2}
                  />
                  <Button onClick={askQuestion}>Perguntar</Button>
                </div>
                <div className="space-y-3">
                  {l.questions?.length ? (
                    (l.questions as Array<{ id: string; question: string; answer: string | null }>).map((q) => (
                      <div key={q.id} className="border border-white/5 rounded-lg p-3">
                        <div className="text-sm">
                          <span className="font-semibold">P:</span> {q.question}
                        </div>
                        {q.answer ? (
                          <div className="text-sm text-muted-foreground mt-2">
                            <span className="font-semibold text-primary">R:</span> {q.answer}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground mt-1">Aguardando resposta</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Related Products */}
            {related && related.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="font-semibold mb-4">Produtos Relacionados</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {related.map((r: any) => (
                      <Link key={r.id} to="/market/$slug" params={{ slug: r.slug }} className="group">
                        <div className="aspect-square rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden mb-2">
                          {r.cover_image_url && (
                            <img src={r.cover_image_url} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                          )}
                        </div>
                        <p className="text-sm font-medium truncate group-hover:text-primary">{r.title}</p>
                        <p className="text-xs text-gradient-brand font-semibold">{brl(r.price_cents)}</p>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {/* Buy Card */}
            <Card className="sticky top-20">
              <CardContent className="p-6 space-y-4">
                <div>
                  <div className="text-3xl font-bold text-gradient-brand">{brl(effectivePrice)}</div>
                  {l.original_price_cents && l.original_price_cents > l.price_cents && (
                    <div className="text-sm text-muted-foreground line-through">
                      {brl(l.original_price_cents)}
                    </div>
                  )}
                </div>

                {options && options.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Opções</label>
                    <div className="space-y-1">
                      {options.map((opt: any) => (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedOptionId(opt.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                            selectedOptionId === opt.id
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-white/10 hover:border-white/30"
                          }`}
                        >
                          <div className="font-medium">{opt.label}</div>
                          {opt.description && (
                            <div className="text-xs text-muted-foreground">{opt.description}</div>
                          )}
                          {opt.price_adjustment_cents !== 0 && (
                            <div className="text-xs text-muted-foreground">
                              {opt.price_adjustment_cents > 0 ? "+" : ""}
                              {brl(opt.price_adjustment_cents)}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!l.unlimited_stock && l.stock > 1 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Quantidade</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="h-8 w-8 rounded border border-white/10 hover:bg-white/5"
                      >
                        -
                      </button>
                      <span className="w-8 text-center font-semibold">{quantity}</span>
                      <button
                        onClick={() => setQuantity(Math.min(l.stock ?? 99, quantity + 1))}
                        className="h-8 w-8 rounded border border-white/10 hover:bg-white/5"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={buy}
                  className="w-full bg-gradient-to-r from-primary to-accent text-white border-0"
                >
                  <ShoppingCart className="h-4 w-4" /> Comprar com pagamento seguro
                </Button>
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>
                    Pagamento protegido via Stripe. O saldo fica retido por 7 dias e trava se houver disputa.
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Share */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Share2 className="h-3 w-3" /> Compartilhe este anúncio
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => shareClick("copy")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors" title="Copiar link">
                    <Copy className="h-3 w-3" /> Link
                  </button>
                  <button onClick={() => shareClick("whatsapp")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors" title="Compartilhar no WhatsApp">
                    WhatsApp
                  </button>
                  <button onClick={() => shareClick("discord")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors" title="Compartilhar no Discord">
                    Discord
                  </button>
                  <button onClick={() => shareClick("telegram")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors" title="Compartilhar no Telegram">
                    Telegram
                  </button>
                  <button onClick={() => shareClick("twitter")} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors" title="Compartilhar no X/Twitter">
                    X/Twitter
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">Compartilhe para aumentar alcance, cliques e vendas.</p>
              </CardContent>
            </Card>

            {/* Seller Card */}
            <Card>
              <CardContent className="p-5">
                <Link to="/" className="flex items-center gap-3 group">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent grid place-items-center text-white font-bold">
                    {(sellerProfile?.display_name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center gap-1">
                      {sellerProfile?.display_name ?? sellerProfile?.username ?? "Vendedor"}
                      {sp?.verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {sp?.level ?? "bronze"}
                    </div>
                  </div>
                </Link>
                <div className="grid grid-cols-2 gap-3 mt-4 text-center text-xs">
                  <div className="bg-white/5 rounded p-2">
                    <div className="font-bold flex items-center justify-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />{" "}
                      {Number(sp?.rating ?? 0).toFixed(1)}
                    </div>
                    <div className="text-muted-foreground">Nota</div>
                  </div>
                  <div className="bg-white/5 rounded p-2">
                    <div className="font-bold">{sp?.total_sales ?? 0}</div>
                    <div className="text-muted-foreground">Vendas</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3">
                  <Flag className="h-3 w-3" /> Denunciar anúncio
                </Button>
              </CardContent>
            </Card>

            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardContent className="p-4 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Nunca envie dinheiro fora da plataforma.</strong> Use sempre o chat do pedido — é a única forma de garantir suas evidências em caso de disputa.
                </span>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
