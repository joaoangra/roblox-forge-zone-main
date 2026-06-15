import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Crown, Eye, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export const Route = createFileRoute("/scripts/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} – RBXScripts` }] }),
  component: ScriptDetail,
});

function ScriptDetail() {
  const { slug } = Route.useParams();
  const { isPremium, user } = useAuth();
  const router = useRouter();

  const { data: script, isLoading } = useQuery({
    queryKey: ["script", slug],
    queryFn: async () => (await supabase.from("scripts").select("*").eq("slug", slug).maybeSingle()).data,
  });

  useEffect(() => {
    if (script?.id) {
      supabase.rpc as never; // noop type guard
      supabase.from("scripts").update({ views: (script.views ?? 0) + 1 }).eq("id", script.id).then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [script?.id]);

  if (isLoading) return <PageShell><div className="mx-auto max-w-4xl px-4 py-16">Carregando…</div></PageShell>;
  if (!script) return <PageShell><div className="mx-auto max-w-4xl px-4 py-16 text-center"><p>Script não encontrado.</p><Button asChild className="mt-4"><Link to="/scripts">Voltar</Link></Button></div></PageShell>;

  const canSee = !script.is_premium || isPremium;

  async function copyCode() {
    if (!script) return;
    if (!canSee) return;
    await navigator.clipboard.writeText(script.code);
    await supabase.from("scripts").update({ copies: (script.copies ?? 0) + 1 }).eq("id", script.id);
    toast.success("Script copiado! Cole no seu executor.");
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4"><Link to="/scripts"><ArrowLeft className="h-4 w-4" /> Voltar ao catálogo</Link></Button>

        <Card className="border-white/10 bg-card/50 overflow-hidden">
          <div className="aspect-[21/9] bg-gradient-to-br from-primary/20 to-accent/20 relative">
            {script.thumbnail_url && <img src={script.thumbnail_url} alt={script.title} className="h-full w-full object-cover" />}
          </div>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {script.is_premium && <Badge className="bg-gradient-to-r from-primary to-accent border-0"><Crown className="h-3 w-3 mr-1" /> Premium</Badge>}
                  {script.is_verified && <Badge variant="secondary"><ShieldCheck className="h-3 w-3 mr-1" /> Verificado</Badge>}
                  {script.game_name && <Badge variant="outline">{script.game_name}</Badge>}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold">{script.title}</h1>
                <p className="text-muted-foreground mt-2">{script.description}</p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div className="inline-flex items-center gap-1"><Eye className="h-4 w-4" /> {script.views} visualizações</div>
                <div className="mt-1">{script.copies} cópias</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-semibold">Código</h2>
                <Button onClick={copyCode} disabled={!canSee} className="bg-gradient-to-r from-primary to-accent text-white border-0">
                  <Copy className="h-4 w-4" /> Copiar script
                </Button>
              </div>
              <div className="relative">
                <pre className={`rounded-lg border border-white/10 bg-black/40 p-4 text-xs md:text-sm overflow-x-auto max-h-96 ${!canSee ? "blur-md select-none" : ""}`}>
                  <code>{script.code}</code>
                </pre>
                {!canSee && (
                  <div className="absolute inset-0 grid place-items-center">
                    <Card className="glass max-w-sm text-center">
                      <CardContent className="p-6">
                        <Lock className="h-8 w-8 mx-auto mb-3 text-primary" />
                        <h3 className="font-semibold mb-1">Conteúdo Premium</h3>
                        <p className="text-sm text-muted-foreground mb-4">Este script é exclusivo para assinantes Premium.</p>
                        {user ? (
                          <Button asChild className="bg-gradient-to-r from-primary to-accent text-white border-0 w-full">
                            <Link to="/premium">Assinar Premium</Link>
                          </Button>
                        ) : (
                          <Button onClick={() => router.navigate({ to: "/auth" })} className="bg-gradient-to-r from-primary to-accent text-white border-0 w-full">Entrar para liberar</Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
