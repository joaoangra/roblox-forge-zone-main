import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Painel – RBXScripts" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile, isPremium, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);

  const { data: orders } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("premium_orders")
          .select("id, amount_brl, status, created_at, premium_plans(name)")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  if (!user) return null;

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              Olá, <span className="text-gradient-brand">{profile?.display_name ?? "jogador"}</span>
            </h1>
            <p className="text-muted-foreground mt-1">{user.email}</p>
          </div>
          {isPremium ? (
            <Badge className="bg-gradient-to-r from-primary to-accent border-0 text-sm py-1.5 px-3">
              <Crown className="h-4 w-4 mr-1" /> Premium ativo
            </Badge>
          ) : (
            <Button asChild className="bg-gradient-to-r from-primary to-accent text-white border-0">
              <Link to="/premium">
                <Crown className="h-4 w-4" /> Virar Premium
              </Link>
            </Button>
          )}
        </div>

        <Card className="border-white/10 bg-card/50">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-5 w-5" />
              <h2 className="font-semibold">Meus pedidos</h2>
            </div>
            {orders && orders.length > 0 ? (
              <div className="divide-y divide-white/10">
                {orders.map((o) => (
                  <Link
                    key={o.id}
                    to="/orders/$id"
                    params={{ id: o.id }}
                    className="flex items-center justify-between py-3 hover:bg-white/5 -mx-2 px-2 rounded-md"
                  >
                    <div>
                      <div className="font-medium">
                        {(o.premium_plans as { name?: string } | null)?.name ?? "Plano"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">R$ {Number(o.amount_brl).toFixed(2)}</span>
                      <StatusBadge status={o.status} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Você ainda não tem pedidos.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending: { label: "Aguardando pagamento", cls: "bg-warning/20 text-warning border-warning/30" },
    awaiting_proof: {
      label: "Aguardando confirmação",
      cls: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    },
    confirmed: { label: "Confirmado", cls: "bg-success/20 text-success border-success/30" },
    rejected: {
      label: "Rejeitado",
      cls: "bg-destructive/20 text-destructive border-destructive/30",
    },
  };
  const m = map[status] ?? map.pending;
  return <span className={`text-xs px-2 py-1 rounded-full border ${m.cls}`}>{m.label}</span>;
}
