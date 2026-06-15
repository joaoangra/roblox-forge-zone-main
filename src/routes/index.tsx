import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Crown,
  ShieldCheck,
  Zap,
  ShoppingBag,
  BadgeCheck,
  Star,
  Store,
  MessageCircle,
  Gamepad2,
  Disc,
  Gift,
  TrendingUp,
  Trophy,
  Globe,
  Code2,
  Cpu,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { getGlobalMetrics } from "@/lib/homeMetrics";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BuxHub – Sistema Roblox Completo" },
      {
        name: "description",
        content:
          "Biblioteca de scripts, marketplace, executores e comunidade Roblox. Tudo em um só lugar.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const { user, isPremium, loading } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ["home-ecosystem-stats"],
    queryFn: async () => {
      const [s, e, u, l] = await Promise.all([
        supabase.from("scripts").select("*", { count: "exact", head: true }),
        supabase.from("executors").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase
          .from("listings")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
      ]);
      return {
        scripts: s.count ?? 0,
        executors: e.count ?? 0,
        users: u.count ?? 0,
        listings: l.count ?? 0,
      };
    },
  });

  const { data: featured } = useQuery({
    queryKey: ["home-featured-scripts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scripts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      return (data ?? []) as Array<{
        id: string;
        slug: string;
        title: string;
        description: string | null;
        game_name: string | null;
        thumbnail_url: string | null;
        is_premium: boolean;
        is_verified: boolean;
        views: number;
      }>;
    },
  });

  const { data: communityNews } = useQuery({
    queryKey: ["home-community-news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const globalMetrics = getGlobalMetrics(stats);

  return (
    <PageShell>
      {/* === BANNER PRINCIPAL - ECOSSISTEMA === */}
      <section className="relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs mb-6">
            <Globe className="h-3 w-3 text-primary" />
            <span>Tudo para Roblox em um só lugar ⭐</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight">
            A Plataforma Roblox <br />
            <span className="text-gradient-brand">Mais Completa!</span>
          </h1>
          <p className="mt-6 max-w-3xl mx-auto text-lg text-muted-foreground">
            Biblioteca de scripts, marketplace, executores e comunidade — tudo integrado em um único
            ecossistema criado para a comunidade Roblox.
          </p>

          {/* === AÇÕES PRINCIPAIS === */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="bg-gradient-to-r from-primary to-accent text-white border-0 glow-brand"
            >
              <Link to="/scripts">
                Explorar Scripts <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/market">
                <ShoppingBag className="h-4 w-4" /> Marketplace
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/community">
                <MessageCircle className="h-4 w-4" /> Comunidade
              </Link>
            </Button>
          </div>

          {/* === MÉTRICAS GLOBAIS === */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 max-w-6xl mx-auto gap-3">
            {globalMetrics.map((m) => (
              <div key={m.label} className="glass rounded-xl p-3 text-center">
                <m.icon className="h-4 w-4 mx-auto text-primary mb-1" />
                <div className="text-xl font-bold text-gradient-brand">{m.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === ECOSYSTEM GRID === */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold">
            O que a <span className="text-gradient-brand">BuxHub oferece?</span>
          </h2>
          <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Tudo que você precisa para Roblox em um só lugar!
          </p>
        </div>
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Code2,
              title: "Scripts",
              desc: "Milhares de scripts verificados para todos os jogos.",
              to: "/scripts",
              color: "from-blue-500/20 to-purple-500/20",
            },
            {
              icon: ShoppingBag,
              title: "Marketplace",
              desc: "Compre itens, game passes e serviços com segurança.",
              to: "/market",
              color: "from-emerald-500/20 to-teal-500/20",
            },
            {
              icon: Cpu,
              title: "Executores",
              desc: "Os melhores executores testados pela equipe.",
              to: "/executors",
              color: "from-orange-500/20 to-red-500/20",
            },
            {
              icon: MessageCircle,
              title: "Comunidade",
              desc: "Discord, anúncios, eventos e muito mais.",
              to: "/community",
              color: "from-indigo-500/20 to-violet-500/20",
            },
            {
              icon: Crown,
              title: "Premium",
              desc: "Acesso a todo o catálogo premium.",
              to: "/premium",
              color: "from-yellow-500/20 to-amber-500/20",
            },
            {
              icon: Store,
              title: "Loja Smiiley",
              desc: "Troque seus pontos por descontos especiais.",
              to: "/shop",
              color: "from-pink-500/20 to-rose-500/20",
            },
            {
              icon: Gift,
              title: "Sistema de Pontos",
              desc: "Ganhe pontos comprando e vendendo.",
              to: "/points",
              color: "from-cyan-500/20 to-sky-500/20",
            },
            {
              icon: Users,
              title: "Anúncios",
              desc: "Divulgue serviços, projetos e equipes.",
              to: "/community?tab=ads",
              color: "from-green-500/20 to-lime-500/20",
            },
          ].map((item) => (
            <Link key={item.to} to={item.to} className="group">
              <Card className="border-white/10 bg-card/50 card-hover h-full overflow-hidden relative">
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`}
                />
                <CardContent className="p-5 relative z-10">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 mb-3">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* === FEATURES DESTAQUE === */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: ShieldCheck,
              title: "100% Verificados",
              desc: "Todos os scripts e vendedores são testados pela nossa equipe antes de serem publicados.",
            },
            {
              icon: Zap,
              title: "Ecossistema Completo",
              desc: "Scripts, marketplace, executores e comunidade — tudo integrado em uma única plataforma.",
            },
            {
              icon: Crown,
              title: "Premium Acessível",
              desc: "Acesso a todo o catálogo premium com pagamento via PIX. A partir de R$ 9,90.",
            },
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

      {/* === NOVOS LANÇAMENTOS === */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold">Novos Lançamentos</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Os scripts mais recentes da plataforma
            </p>
          </div>
          <Button asChild variant="ghost">
            <Link to="/scripts">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(featured ?? []).map((s) => (
            <Link key={s.id} to="/scripts/$slug" params={{ slug: s.slug }} className="group">
              <Card className="border-white/10 bg-card/50 overflow-hidden card-hover h-full">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 relative">
                  {s.thumbnail_url && (
                    <img
                      src={s.thumbnail_url}
                      alt={s.title}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {s.is_premium && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-2 py-1 text-[10px] font-bold text-white">
                      <Crown className="h-3 w-3" /> PREMIUM
                    </span>
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    {s.game_name ?? "Universal"}
                  </div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors line-clamp-1">
                    {s.title}
                  </h3>
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

      {/* === MARKETPLACE SECTION === */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="p-8 md:p-12 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4 w-fit">
                <ShoppingBag className="h-3 w-3" /> Marketplace
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Compre com <span className="text-gradient-brand">segurança</span>
              </h2>
              <p className="text-muted-foreground mb-6">
                Itens Roblox, game passes e serviços de vendedores verificados. Pagamento retido por
                7 dias — só liberamos pro vendedor depois que você confirma que recebeu.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  className="bg-gradient-to-r from-primary to-accent text-white border-0"
                >
                  <Link to="/market">
                    Explorar Marketplace <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/sell">Vender agora</Link>
                </Button>
              </div>
              <div className="flex items-center gap-6 mt-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BadgeCheck className="h-4 w-4 text-primary" /> Vendedores verificados
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" /> Avaliações reais
                </span>
              </div>
            </div>
            <div className="hidden md:flex bg-gradient-to-br from-primary/10 to-accent/10 items-center justify-center p-12">
              <ShoppingBag className="h-32 w-32 text-primary/30" />
            </div>
          </div>
        </div>
      </section>

      {/* === COMUNIDADE SECTION === */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="hidden md:flex bg-gradient-to-br from-indigo-500/10 to-violet-500/10 items-center justify-center p-12">
              <Disc className="h-32 w-32 text-indigo-400/30" />
            </div>
            <div className="p-8 md:p-12 flex flex-col justify-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 mb-4 w-fit">
                <MessageCircle className="h-3 w-3" /> Comunidade
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-3">
                Faça parte da <span className="text-gradient-brand">comunidade</span>
              </h2>
              <p className="text-muted-foreground mb-6">
                Participe do nosso Discord, veja anúncios, eventos e novidades. Conecte-se com
                outros membros da comunidade Roblox.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-[#5865F2] hover:bg-[#4752C4] text-white border-0">
                  <a href="https://discord.gg/buxhub" target="_blank" rel="noreferrer">
                    <Disc className="h-4 w-4" /> Discord
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/community">
                    Explorar Comunidade <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="flex items-center gap-6 mt-6 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Gamepad2 className="h-4 w-4 text-indigo-400" /> Eventos
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-indigo-400" /> Novidades
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-indigo-400" /> Anúncios
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* === LOJA SMIILEY PREVIEW === */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <Card className="border-white/10 bg-card/50 overflow-hidden">
          <CardContent className="p-8 md:p-12 text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-400 mb-4">
              <Gift className="h-3 w-3" /> Loja Oficial
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-3">
              <span className="text-gradient-brand">Smiiley</span> Store
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto mb-6">
              Ganhe pontos comprando e vendendo na plataforma. Troque seus pontos por descontos
              exclusivos na Loja Oficial Smiiley.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 mb-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4 text-yellow-500" /> Até 5% de desconto
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 text-pink-500" /> Produtos exclusivos
              </span>
              <span className="flex items-center gap-1">
                <Crown className="h-4 w-4 text-primary" /> Multiplicador Premium
              </span>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button
                asChild
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0"
              >
                <Link to="/shop">
                  Ver Loja <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/points">Meus Pontos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* === CTA === */}
      {!user && (
        <section className="mx-auto max-w-7xl px-4 py-16">
          <div className="glass rounded-2xl p-10 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 pointer-events-none" />
            <Cpu className="h-10 w-10 mx-auto mb-4 text-primary relative" />
            <h2 className="text-3xl font-bold mb-3 relative">Pronto pra começar?</h2>
            <p className="text-muted-foreground max-w-xl mx-auto relative">
              Crie sua conta grátis em segundos e explore todo o ecossistema BuxHub.
            </p>
            <Button
              asChild
              size="lg"
              className="mt-6 bg-gradient-to-r from-primary to-accent text-white border-0 relative"
            >
              <Link to="/auth">Criar conta grátis</Link>
            </Button>
          </div>
        </section>
      )}
    </PageShell>
  );
}
