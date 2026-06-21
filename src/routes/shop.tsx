import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Gift, ShoppingBag, Star, Tag, Percent } from "lucide-react";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "Bux Store – BuxHub" }] }),
  component: ShopPage,
});

function ShopPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["shop-items"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("shop_items")
        .select("*")
        .eq("active", true)
        .order("price_points");
      return (data ?? []) as any[];
    },
  });

  const { data: userPoints } = useQuery({
    queryKey: ["my-points", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("user_points")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return (data ?? { points: 0, level: 0 }) as any;
    },
  });

  async function buy(itemId: string) {
    if (!user) {
      toast.error("Faça login");
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) return;
    const res = await fetch("/shop/purchase-item", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ item_id: itemId }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(d.error ?? "Erro ao comprar item");
      return;
    }
    toast.success("Item adquirido!");
    qc.invalidateQueries({ queryKey: ["shop-items"] });
    qc.invalidateQueries({ queryKey: ["my-points", user.id] });
  }

  const pts = (userPoints as any) || { points: 0, level: 0 };

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-400 mb-4">
            <Gift className="h-3 w-3" /> Loja Oficial
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            Bux Store
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Troque seus pontos BuxHub por descontos exclusivos e produtos especiais.
          </p>
          {user && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 text-yellow-400">
              <Star className="h-4 w-4" /> {pts.points} pontos · Nível {pts.level}
            </div>
          )}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(items ?? []).length > 0 ? (
            (items ?? []).map((item: any) => (
              <Card key={item.id} className="border-white/10 bg-card/50 card-hover">
                <CardContent className="p-6 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20 mx-auto mb-4">
                    {item.discount_pct ? (
                      <Percent className="h-8 w-8 text-pink-400" />
                    ) : (
                      <Tag className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <h3 className="font-semibold mb-1">{item.name}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                  {item.discount_pct && (
                    <Badge className="bg-gradient-to-r from-pink-500 to-rose-500 border-0 mb-2">
                      {item.discount_pct}% OFF
                    </Badge>
                  )}
                  <div className="text-2xl font-bold text-gradient-brand mb-4">
                    {item.price_points} pts
                  </div>
                  <Button
                    onClick={() => buy(item.id)}
                    disabled={!user || (pts.points ?? 0) < item.price_points}
                    className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0"
                  >
                    <ShoppingBag className="h-4 w-4" /> Adquirir
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="border-dashed border-white/10 col-span-full">
              <CardContent className="p-16 text-center text-muted-foreground">
                <Gift className="h-10 w-10 mx-auto mb-3 opacity-50" />
                Nenhum item disponível na loja no momento.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
