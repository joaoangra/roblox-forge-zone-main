import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, Search, Star, Plus, Package, Ticket, Briefcase } from "lucide-react";
import { brl } from "@/lib/marketplace";

export const Route = createFileRoute("/market/")({
  head: () => ({ meta: [
    { title: "Marketplace Roblox — Itens, Game Passes e Serviços" },
    { name: "description", content: "Compre itens Roblox, game passes e serviços de vendedores verificados com pagamento protegido por escrow." },
  ] }),
  component: MarketIndex,
});

const ICONS: Record<string, typeof Package> = { itens: Package, "game-passes": Ticket, servicos: Briefcase };

function MarketIndex() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const { data: cats } = useQuery({
    queryKey: ["mp-cats"],
    queryFn: async () => (await supabase.from("marketplace_categories").select("*").eq("active", true).order("sort_order")).data ?? [],
  });

  const { data: listings, isLoading } = useQuery({
    queryKey: ["mp-listings", cat, q],
    queryFn: async () => {
      let query = supabase.from("listings").select("*, category:marketplace_categories(slug, name)")
        .eq("status", "active").order("featured", { ascending: false }).order("created_at", { ascending: false }).limit(60);
      if (cat) query = query.eq("category_id", cat);
      if (q) query = query.ilike("title", `%${q}%`);
      return (await query).data ?? [];
    },
  });

  return (
    <PageShell>
      <section className="border-b border-white/5 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-12">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3"><ShoppingBag className="h-4 w-4" /> Marketplace Roblox</div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-3">Compre com <span className="text-gradient-brand">segurança</span></h1>
          <p className="text-muted-foreground max-w-2xl mb-6">Itens, game passes e serviços Roblox. Pagamento retido em escrow por 7 dias — só liberamos pro vendedor depois que você confirma que recebeu.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-gradient-to-r from-primary to-accent text-white border-0">
              <Link to="/sell"><Plus className="h-4 w-4" /> Vender no Marketplace</Link>
            </Button>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar anúncios…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          <Button variant={cat === null ? "default" : "outline"} size="sm" onClick={() => setCat(null)}>Todas</Button>
          {cats?.map((c) => {
            const Icon = ICONS[c.slug] ?? Package;
            return (
              <Button key={c.id} variant={cat === c.id ? "default" : "outline"} size="sm" onClick={() => setCat(c.id)}>
                <Icon className="h-4 w-4" /> {c.name}
              </Button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Card key={i} className="h-72 animate-pulse bg-white/5" />)}
          </div>
        ) : listings && listings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {listings.map((l) => {
              const cat = l.category as { name: string } | null;
              return (
              <Link key={l.id} to="/market/$slug" params={{ slug: l.slug }} className="group">
                <Card className="overflow-hidden border-white/5 hover:border-primary/30 transition-colors h-full">
                  <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 relative overflow-hidden">
                    {l.cover_image_url && <img src={l.cover_image_url} alt={l.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />}
                    {l.featured && <Badge className="absolute top-2 left-2 bg-gradient-to-r from-primary to-accent border-0">Destaque</Badge>}
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {cat && <Badge variant="outline" className="text-xs">{cat.name}</Badge>}
                      {l.game_name && <span className="truncate">· {l.game_name}</span>}
                    </div>
                    <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">{l.title}</h3>
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-lg font-bold text-gradient-brand">{brl(l.price_cents)}</div>
                      {l.total_reviews > 0 && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {Number(l.rating).toFixed(1)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum anúncio encontrado. Seja o primeiro a vender!</p>
            <Button asChild className="mt-4"><Link to="/sell">Quero vender</Link></Button>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
