import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, Download } from "lucide-react";

export const Route = createFileRoute("/executors")({
  head: () => ({
    meta: [
      { title: "Executores Roblox – RBXScripts" },
      { name: "description", content: "Catálogo de executores Roblox gratuitos e premium." },
    ],
  }),
  component: ExecutorsPage,
});

function ExecutorsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["executors"],
    queryFn: async () =>
      (
        await supabase
          .from("executors")
          .select("*")
          .order("is_featured", { ascending: false })
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">
            Executores <span className="text-gradient-brand">Roblox</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Os melhores executores testados pela nossa equipe.
          </p>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-56 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((e) => (
              <Card key={e.id} className="border-white/10 bg-card/50 card-hover overflow-hidden">
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center">
                  {e.image_url ? (
                    <img src={e.image_url} alt={e.name} className="h-full w-full object-cover" />
                  ) : (
                    <Cpu className="h-12 w-12 text-primary/60" />
                  )}
                </div>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg">{e.name}</h3>
                    {e.is_free ? (
                      <Badge variant="secondary">Grátis</Badge>
                    ) : (
                      <Badge className="bg-gradient-to-r from-primary to-accent border-0">
                        R$ {Number(e.price_brl).toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{e.description}</p>
                  {e.supported_games && e.supported_games.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {e.supported_games.slice(0, 3).map((g: string) => (
                        <Badge key={g} variant="outline" className="text-[10px]">
                          {g}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Button
                    asChild
                    className="w-full mt-4 bg-gradient-to-r from-primary to-accent text-white border-0"
                  >
                    <a href={e.download_url} target="_blank" rel="noreferrer">
                      <Download className="h-4 w-4" /> Baixar
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-white/10">
            <CardContent className="p-16 text-center text-muted-foreground">
              Nenhum executor publicado ainda.
            </CardContent>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
