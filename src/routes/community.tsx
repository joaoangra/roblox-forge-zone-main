import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MessageCircle,
  Disc,
  Megaphone,
  Calendar,
  Bell,
  Rocket,
  Briefcase,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Comunidade – BuxHub" },
      {
        name: "description",
        content: "Participe da comunidade BuxHub: Discord, anúncios, eventos e novidades.",
      },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { user } = useAuth();

  const { data: announcements } = useQuery({
    queryKey: ["community-announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("announcements" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  const { data: ads } = useQuery({
    queryKey: ["community-ads"],
    queryFn: async () => {
      const { data } = await supabase
        .from("community_ads" as any)
        .select("*, profiles(username, display_name)")
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 mb-4">
            <MessageCircle className="h-3 w-3" /> Comunidade
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            Comunidade <span className="text-gradient-brand">BuxHub</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Conecte-se com outros membros, participe de eventos, veja novidades e anuncie seus
            serviços.
          </p>
        </div>

        <Card className="border-white/10 bg-card/50 mb-8 overflow-hidden">
          <CardContent className="p-8 md:p-10">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="grid h-20 w-20 place-items-center rounded-2xl bg-[#5865F2]/10">
                <Disc className="h-10 w-10 text-[#5865F2]" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold mb-1">Servidor Discord</h2>
                <p className="text-muted-foreground text-sm">
                  Entre no nosso servidor oficial para ficar por dentro de tudo: lançamentos,
                  eventos, suporte e comunidade.
                </p>
              </div>
              <Button
                asChild
                className="bg-[#5865F2] hover:bg-[#4752C4] text-white border-0 shrink-0"
              >
                <a href="https://discord.gg/buxhub" target="_blank" rel="noreferrer">
                  <Disc className="h-4 w-4" /> Entrar no Discord{" "}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="announcements">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="announcements">
              <Megaphone className="h-4 w-4" /> Novidades
            </TabsTrigger>
            <TabsTrigger value="events">
              <Calendar className="h-4 w-4" /> Eventos
            </TabsTrigger>
            <TabsTrigger value="ads">
              <Briefcase className="h-4 w-4" /> Anúncios
            </TabsTrigger>
            <TabsTrigger value="new-ad">
              <Rocket className="h-4 w-4" /> Criar Anúncio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements">
            <div className="space-y-3">
              {(announcements ?? []).length > 0 ? (
                (announcements ?? []).map((a: any) => (
                  <Card key={a.id} className="border-white/10 bg-card/50">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 shrink-0">
                          {a.type === "update" ? (
                            <Rocket className="h-5 w-5 text-primary" />
                          ) : a.type === "event" ? (
                            <Calendar className="h-5 w-5 text-indigo-400" />
                          ) : (
                            <Bell className="h-5 w-5 text-yellow-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{a.title}</h3>
                            {a.important && (
                              <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                                Importante
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{a.content}</p>
                          <div className="text-xs text-muted-foreground mt-2">
                            {new Date(a.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-white/10">
                  <CardContent className="p-16 text-center text-muted-foreground">
                    <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    Nenhuma novidade ainda. Fique ligado!
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="events">
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-8 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-3 text-primary opacity-50" />
                <h3 className="font-semibold mb-2">Eventos em breve</h3>
                <p className="text-sm text-muted-foreground">
                  Estamos preparando eventos especiais para a comunidade. Acompanhe o Discord para
                  novidades!
                </p>
                <Button
                  asChild
                  className="mt-4 bg-[#5865F2] hover:bg-[#4752C4] text-white border-0"
                >
                  <a href="https://discord.gg/buxhub" target="_blank" rel="noreferrer">
                    <Disc className="h-4 w-4" /> Discord
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ads">
            <div className="space-y-3">
              {(ads ?? []).length > 0 ? (
                (ads ?? []).map((ad: any) => {
                  const profile = ad.profiles as {
                    username?: string;
                    display_name?: string;
                  } | null;
                  return (
                    <Card key={ad.id} className="border-white/10 bg-card/50">
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3">
                          <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 shrink-0">
                            <Briefcase className="h-5 w-5 text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold">{ad.title}</h3>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {ad.category}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{ad.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                              <span>Por @{profile?.username ?? "—"}</span>
                              <span>·</span>
                              <span>{new Date(ad.created_at).toLocaleDateString("pt-BR")}</span>
                              {ad.contact && (
                                <>
                                  <span>·</span>
                                  <span>Contato: {ad.contact}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              ) : (
                <Card className="border-dashed border-white/10">
                  <CardContent className="p-16 text-center text-muted-foreground">
                    <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    Nenhum anúncio publicado ainda.
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="new-ad">
            <NewAdForm user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

function NewAdForm({ user }: { user: any }) {
  const [form, setForm] = useState({
    title: "",
    category: "service",
    description: "",
    contact: "",
  });
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!user) {
      toast.error("Faça login para anunciar");
      return;
    }
    if (!form.title || !form.description) {
      toast.error("Preencha título e descrição");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any).from("community_ads").insert({
      user_id: user.id,
      title: form.title,
      category: form.category,
      description: form.description,
      contact: form.contact || null,
      status: "pending_review",
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Anúncio enviado para análise!");
    setForm({ title: "", category: "service", description: "", contact: "" });
  }

  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Rocket className="h-4 w-4" /> Criar Anúncio
        </h3>
        <p className="text-sm text-muted-foreground">
          Divulgue serviços, projetos, equipes ou recrutamento. Todos os anúncios são moderados.
        </p>
        <div>
          <label className="text-sm font-medium mb-1 block">Título</label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex: Procurando desenvolvedor Lua"
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Categoria</label>
          <select
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            <option value="service">Serviço</option>
            <option value="project">Projeto</option>
            <option value="recruiting">Recrutamento</option>
            <option value="team">Equipe</option>
            <option value="other">Outro</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Descrição</label>
          <Textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Descreva seu anúncio detalhadamente..."
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1 block">Contato (opcional)</label>
          <Input
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder="Discord: usuario#0000"
          />
        </div>
        <Button
          onClick={submit}
          disabled={saving}
          className="bg-gradient-to-r from-primary to-accent text-white border-0"
        >
          {saving ? "Enviando..." : "Publicar Anúncio"}
        </Button>
      </CardContent>
    </Card>
  );
}
