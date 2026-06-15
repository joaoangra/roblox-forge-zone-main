import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { brl } from "@/lib/marketplace";
import { Wallet as WalletIcon, ArrowDownToLine, History } from "lucide-react";

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "Carteira — RBXScripts" }] }),
  component: WalletPage,
});

function WalletPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [loading, user, router]);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: txs } = useQuery({
    queryKey: ["wallet-txs", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("wallet_transactions").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(50)).data ?? [],
  });
  const { data: wds } = useQuery({
    queryKey: ["my-wds", user?.id],
    enabled: !!user,
    queryFn: async () => (await supabase.from("withdrawals").select("*").eq("user_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const [amount, setAmount] = useState("");
  const [pix, setPix] = useState("");
  const [pixType, setPixType] = useState("cpf");

  if (!user) return null;

  async function requestWithdraw() {
    const cents = Math.round((parseFloat(amount.replace(",", ".")) || 0) * 100);
    if (cents <= 0) return;
    if (cents > (wallet?.available_cents ?? 0)) { toast.error("Saldo insuficiente"); return; }
    const { error } = await supabase.from("withdrawals").insert({ user_id: user!.id, amount_cents: cents, pix_key: pix, pix_key_type: pixType });
    if (error) toast.error(error.message);
    else { toast.success("Solicitação enviada"); setAmount(""); setPix(""); qc.invalidateQueries({ queryKey: ["my-wds"] }); }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center gap-2"><WalletIcon className="h-6 w-6 text-primary" /><h1 className="text-3xl font-bold">Carteira</h1></div>

        <div className="grid sm:grid-cols-3 gap-3">
          <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Disponível</div><div className="text-2xl font-bold text-gradient-brand">{brl(wallet?.available_cents ?? 0)}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Pendente (escrow)</div><div className="text-2xl font-bold">{brl(wallet?.pending_cents ?? 0)}</div></CardContent></Card>
          <Card><CardContent className="p-5"><div className="text-xs text-muted-foreground">Bloqueado</div><div className="text-2xl font-bold">{brl(wallet?.blocked_cents ?? 0)}</div></CardContent></Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><ArrowDownToLine className="h-4 w-4" /> Solicitar saque</h2>
              <div><Label>Valor (R$)</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo de chave</Label>
                  <Select value={pixType} onValueChange={setPixType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Telefone</SelectItem>
                      <SelectItem value="random">Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Chave PIX</Label><Input value={pix} onChange={(e) => setPix(e.target.value)} /></div>
              </div>
              <Button onClick={requestWithdraw} className="w-full">Solicitar</Button>
              <p className="text-xs text-muted-foreground">Saques são processados manualmente pelo admin em até 24h úteis.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-3">
              <h2 className="font-semibold">Meus saques</h2>
              {wds?.length ? wds.map((w: any) => (
                <div key={w.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                  <div><div>{brl(w.amount_cents)}</div><div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString("pt-BR")}</div></div>
                  <Badge variant="outline" className="capitalize">{w.status}</Badge>
                </div>
              )) : <p className="text-sm text-muted-foreground">Nenhum saque ainda.</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><History className="h-4 w-4" /> Extrato</h2>
            {txs?.length ? (
              <div className="space-y-1 text-sm">
                {txs.map((t: any) => (
                  <div key={t.id} className="flex justify-between border-b border-white/5 py-2">
                    <div><div className="capitalize">{t.type}</div><div className="text-xs text-muted-foreground">{t.description}</div></div>
                    <div className={t.amount_cents > 0 ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>{t.amount_cents > 0 ? "+" : ""}{brl(t.amount_cents)}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Sem movimentações.</p>}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
