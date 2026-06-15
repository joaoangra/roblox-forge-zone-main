import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Code2, Cpu, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useAuth } from "@/lib/auth";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Kyron Scipts – Scripts Premium para Roblox" },
      { name: "description", content: "Biblioteca premium de scripts, executores e ferramentas para Roblox. Cópia rápida, sempre atualizado." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, isPremium } = useAuth();
  const { data: stats } = useQuery({
    queryKey: ["home-stats"],
    queryFn: async () => {
      const [s, e, u] = await Promise.all([
        supabase.from("scripts").select("*", { count: "exact", head: true }),
        supabase.from("executors").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      return { scripts: s.count ?? 0, executors: e.count ?? 0, users: u.count ?? 0 };
    },
  });

  const { data: featured } = useQuery({
    queryKey: ["home-featured-scripts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("id, slug, title, description, game_name, thumbnail_url, is_premium, is_verified, views")
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <PageShell>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs mb-6">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Novos scripts diariamente</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            A maior biblioteca de <br />
            <span className="text-gradient-brand">scripts Roblox</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            Milhares de scripts verificados, executores premium e ferramentas para todos os jogos populares. Tudo em um só lugar.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-gradient-to-r from-primary to-accent text-white border-0 glow-brand">
              <Link to="/scripts">Explorar scripts <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline"><Link to="/premium"><Crown className="h-4 w-4" /> Ver Premium</Link></Button>
          </div>

          <div className="mt-14 grid grid-cols-3 max-w-2xl mx-auto gap-4">
            {[
              { label: "Scripts", value: stats?.scripts ?? "—" },
              { label: "Executores", value: stats?.executors ?? "—" },
              { label: "Usuários", value: stats?.users ?? "—" },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-4">
                <div className="text-2xl font-bold text-gradient-brand">{s.value}</div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: ShieldCheck, title: "Verificados", desc: "Todos os scripts são testados pela nossa equipe antes de serem publicados." },
            {icon: Zap,title: "Scripts, contas e itens",desc: "Tudo o que você precisa para Roblox, reunido em uma única plataforma."},
  {
  icon: Crown,
  title: "Premium acessível!",
  desc: (
    <>
      Acesso vitalício a todo o catálogo a partir de{" "}
      <del>R$ 23,50</del> por <strong>R$ 9,90</strong>
    </>
  )
}
          ].map((f) => (
            <Card key={f.title} className="border-white/10 bg-card/50 card-hover">
              <CardContent className="p-6">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 mb-4">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured scripts */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Novos lançamentos</h2>
            <p className="text-sm text-muted-foreground mt-1">Os scripts mais recentes da plataforma</p>
          </div>
          <Button asChild variant="ghost"><Link to="/scripts">Ver todos <ArrowRight className="h-4 w-4" /></Link></Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(featured ?? []).map((s) => (
            <Link key={s.id} to="/scripts/$slug" params={{ slug: s.slug }} className="group">
              <Card className="border-white/10 bg-card/50 overflow-hidden card-hover h-full">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
                  {s.thumbnail_url && <img src={s.thumbnail_url} alt={s.title} className="h-full w-full object-cover" />}
                  {s.is_premium && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-2 py-1 text-[10px] font-bold text-white">
                      <Crown className="h-3 w-3" /> PREMIUM
                    </span>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">{s.game_name ?? "Universal"}</div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{s.description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {featured && featured.length === 0 && (
            <Card className="border-dashed border-white/10 col-span-full">
              <CardContent className="p-10 text-center text-muted-foreground">
                <Code2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                Nenhum script publicado ainda. Volte mais tarde!
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="glass rounded-2xl p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 pointer-events-none" />
            <Cpu className="h-10 w-10 mx-auto mb-4 text-primary relative" />
            <h2 className="text-3xl font-bold mb-3 relative">Pronto pra começar?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto relative">Cria conta grátis em segundos e explora o catálogo completo.</p>
            <Button asChild size="lg" className="mt-6 bg-gradient-to-r from-primary to-accent text-white border-0 relative">
              <Link to="/auth">Criar conta grátis</Link>
            </Button>
          </div>
        </section>
      )}
    </PageShell>
  );
}
