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
import { toast } from "sonner";
import { brl, calcOrderSplit } from "@/lib/marketplace";
import { Shield, Star, ShoppingCart, MessageCircle, Flag, BadgeCheck, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/market/$slug")({ component: ListingPage });

function ListingPage() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [question, setQuestion] = useState("");
  const [buying, setBuying] = useState(false);

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing", slug],
    queryFn: async () => (await supabase.from("listings")
      .select("*, category:marketplace_categories(name, slug), images:listing_images(*), questions:listing_questions(*)")
      .eq("slug", slug).maybeSingle()).data,
  });

  const { data: seller } = useQuery({
    queryKey: ["listing-seller", listing?.seller_id],
    enabled: !!listing?.seller_id,
    queryFn: async () => {
      const [p, sp] = await Promise.all([
        supabase.from("profiles").select("username, display_name, avatar_url").eq("id", listing!.seller_id).maybeSingle(),
        supabase.from("seller_profiles").select("*").eq("user_id", listing!.seller_id).maybeSingle(),
      ]);
      return { profile: p.data, seller_profile: sp.data };
    },
  });

  if (isLoading) return <PageShell><div className="mx-auto max-w-6xl px-4 py-12">Carregando…</div></PageShell>;
  if (!listing) return <PageShell><div className="mx-auto max-w-6xl px-4 py-12">Anúncio não encontrado.</div></PageShell>;

  const l = listing;
  const split = calcOrderSplit(l.price_cents);

  async function buy() {
    if (!user) { router.navigate({ to: "/auth" }); return; }
    if (user.id === l.seller_id) { toast.error("Você não pode comprar o próprio anúncio"); return; }
    setBuying(true);
    const { data: order, error } = await supabase.from("marketplace_orders").insert({
      listing_id: l.id, buyer_id: user.id, seller_id: l.seller_id,
      amount_cents: l.price_cents,
      gateway_fee_cents: split.gateway, platform_fee_cents: split.platform, seller_amount_cents: split.seller,
      status: "awaiting_payment",
    }).select().single();
    if (error || !order) { setBuying(false); toast.error(error?.message ?? "Erro"); return; }
    await supabase.from("marketplace_chat_rooms").insert({ order_id: order.id, buyer_id: user.id, seller_id: l.seller_id });
    router.navigate({ to: "/market/orders/$id", params: { id: order.id } });
  }

  async function askQuestion() {
    if (!user) { router.navigate({ to: "/auth" }); return; }
    if (!question.trim()) return;
    const { error } = await supabase.from("listing_questions").insert({ listing_id: l.id, user_id: user.id, question });
    if (error) { toast.error(error.message); return; }
    setQuestion(""); toast.success("Pergunta enviada");
    qc.invalidateQueries({ queryKey: ["listing", slug] });
  }

  const sp = seller?.seller_profile;
  const sellerProfile = seller?.profile;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="aspect-video rounded-xl overflow-hidden bg-gradient-to-br from-primary/10 to-accent/10 relative">
            {l.cover_image_url ? <img src={l.cover_image_url} alt={l.title} className="absolute inset-0 w-full h-full object-cover" /> : null}
          </div>
          {l.images && l.images.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {l.images.map((img: { id: string; url: string }) => <img key={img.id} src={img.url} alt="" className="aspect-square object-cover rounded-lg" loading="lazy" />)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-2">
              {l.category && <Badge variant="outline">{(l.category as { name: string }).name}</Badge>}
              {l.game_name && <Badge variant="outline">{l.game_name}</Badge>}
            </div>
            <h1 className="text-3xl font-bold mb-3">{l.title}</h1>
            {l.short_description && <p className="text-muted-foreground mb-4">{l.short_description}</p>}
            <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm">{l.description}</div>
          </div>

          <Card>
            <CardContent className="p-6">
              <h2 className="font-semibold mb-3 flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Perguntas</h2>
              <div className="flex gap-2 mb-4">
                <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tire suas dúvidas com o vendedor…" rows={2} />
                <Button onClick={askQuestion}>Perguntar</Button>
              </div>
              <div className="space-y-3">
                {l.questions?.length ? (l.questions as Array<{ id: string; question: string; answer: string | null }>).map((q) => (
                  <div key={q.id} className="border border-white/5 rounded-lg p-3">
                    <div className="text-sm"><span className="font-semibold">P:</span> {q.question}</div>
                    {q.answer ? <div className="text-sm text-muted-foreground mt-2"><span className="font-semibold text-primary">R:</span> {q.answer}</div> : <div className="text-xs text-muted-foreground mt-1">Aguardando resposta</div>}
                  </div>
                )) : <p className="text-sm text-muted-foreground">Nenhuma pergunta ainda.</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="sticky top-20">
            <CardContent className="p-6 space-y-4">
              <div>
                <div className="text-3xl font-bold text-gradient-brand">{brl(l.price_cents)}</div>
                {l.original_price_cents && l.original_price_cents > l.price_cents && (
                  <div className="text-sm text-muted-foreground line-through">{brl(l.original_price_cents)}</div>
                )}
              </div>
              <Button onClick={buy} disabled={buying} className="w-full bg-gradient-to-r from-primary to-accent text-white border-0">
                <ShoppingCart className="h-4 w-4" /> {buying ? "Criando pedido…" : "Comprar agora (PIX)"}
              </Button>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg p-3">
                <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <span>Pagamento protegido por escrow. Liberamos pro vendedor só após 7 dias da confirmação de entrega.</span>
              </div>
            </CardContent>
          </Card>

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
                  <div className="text-xs text-muted-foreground capitalize">{sp?.level ?? "bronze"}</div>
                </div>
              </Link>
              <div className="grid grid-cols-2 gap-3 mt-4 text-center text-xs">
                <div className="bg-white/5 rounded p-2">
                  <div className="font-bold flex items-center justify-center gap-1"><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {Number(sp?.rating ?? 0).toFixed(1)}</div>
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
              <span><strong>Nunca envie dinheiro fora da plataforma.</strong> Use sempre o chat do pedido — é a única forma de garantir suas evidências em caso de disputa.</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
