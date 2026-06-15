import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Crown, Search, ShieldCheck, Eye } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/scripts/")({
  head: () => ({ meta: [{ title: "Catálogo de Scripts – RBXScripts" }, { name: "description", content: "Explore milhares de scripts Roblox verificados, gratuitos e premium." }] }),
  component: ScriptsPage,
});

function ScriptsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });

  const { data: scripts, isLoading } = useQuery({
    queryKey: ["scripts", q, cat],
    queryFn: async () => {
      let qb = supabase.from("scripts").select("id, slug, title, description, game_name, thumbnail_url, is_premium, is_verified, views, category_id").order("created_at", { ascending: false });
      if (cat) qb = qb.eq("category_id", cat);
      if (q) qb = qb.or(`title.ilike.%${q}%,description.ilike.%${q}%,game_name.ilike.%${q}%`);
      return (await qb).data ?? [];
    },
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Catálogo de <span className="text-gradient-brand">Scripts</span></h1>
          <p className="text-muted-foreground mt-2">Encontre o script perfeito para seu jogo.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, jogo, descrição…" className="pl-9 h-11" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          <Button size="sm" variant={cat === null ? "default" : "outline"} onClick={() => setCat(null)}>Todos</Button>
          {(categories ?? []).map((c) => (
            <Button key={c.id} size="sm" variant={cat === c.id ? "default" : "outline"} onClick={() => setCat(c.id)}>{c.name}</Button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : scripts && scripts.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {scripts.map((s) => (
              <Link key={s.id} to="/scripts/$slug" params={{ slug: s.slug }} className="group">
                <Card className="border-white/10 bg-card/50 overflow-hidden card-hover h-full">
                  <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
                    {s.thumbnail_url && <img src={s.thumbnail_url} alt={s.title} className="h-full w-full object-cover" />}
                    {s.is_premium && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-2 py-1 text-[10px] font-bold text-white">
                        <Crown className="h-3 w-3" /> PREMIUM
                      </span>
                    )}
                    {s.is_verified && !s.is_premium && (
                      <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-success/90 text-success-foreground px-2 py-1 text-[10px] font-bold">
                        <ShieldCheck className="h-3 w-3" /> VERIFICADO
                      </span>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">{s.game_name ?? "Universal"}</div>
                    <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">{s.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">{s.description}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> {s.views}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-white/10"><CardContent className="p-16 text-center text-muted-foreground">Nenhum script encontrado.</CardContent></Card>
        )}
      </div>
    </PageShell>
  );
}
