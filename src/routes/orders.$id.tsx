import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Copy, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "./dashboard";

export const Route = createFileRoute("/orders/$id")({
  head: () => ({ meta: [{ title: "Pedido – RBXScripts" }] }),
  component: OrderPage,
});

function OrderPage() {
  const { id } = Route.useParams();
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);

  const { data: order } = useQuery({
    queryKey: ["order", id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("premium_orders")
          .select("*, premium_plans(name, duration_days)")
          .eq("id", id)
          .maybeSingle()
      ).data,
  });

  const { data: pix } = useQuery({
    queryKey: ["pix-settings"],
    queryFn: async () =>
      (await supabase.from("pix_settings").select("*").eq("id", 1).maybeSingle()).data,
  });

  const { data: messages } = useQuery({
    queryKey: ["order-messages", id],
    enabled: !!user,
    refetchInterval: 5000,
    queryFn: async () =>
      (await supabase.from("order_messages").select("*").eq("order_id", id).order("created_at"))
        .data ?? [],
  });

  if (!user || !order)
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl px-4 py-16">Carregando…</div>
      </PageShell>
    );

  async function send() {
    if (!msg.trim() || !user) return;
    setSending(true);
    const { error } = await supabase
      .from("order_messages")
      .insert({ order_id: id, user_id: user.id, message: msg.trim(), is_admin: isAdmin });
    if (error) toast.error(error.message);
    else {
      setMsg("");
      qc.invalidateQueries({ queryKey: ["order-messages", id] });
    }
    setSending(false);
  }

  async function uploadProof(file: File) {
    if (!user) return;
    const path = `${user.id}/${id}-${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file);
    if (upErr) {
      toast.error(upErr.message);
      return;
    }
    const { data: signed } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    await supabase
      .from("premium_orders")
      .update({ pix_proof_url: path, status: "awaiting_proof" })
      .eq("id", id);
    await supabase.from("order_messages").insert({
      order_id: id,
      user_id: user.id,
      message: "📎 Comprovante enviado.",
      attachment_url: signed?.signedUrl ?? path,
    });
    toast.success("Comprovante enviado! Aguarde a confirmação.");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["order-messages", id] });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-white/10 bg-card/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-lg">
                  {(order.premium_plans as { name?: string } | null)?.name ?? "Plano"}
                </h2>
                <StatusBadge status={order.status} />
              </div>
              <div className="text-3xl font-extrabold text-gradient-brand mb-4">
                R$ {Number(order.amount_brl).toFixed(2)}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Chave PIX
                </div>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-sm break-all">
                    {pix?.pix_key || "(admin não configurou)"}
                  </code>
                  {pix?.pix_key && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(pix.pix_key);
                        toast.success("Chave copiada");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tipo: {pix?.pix_key_type ?? "—"} · Nome: {pix?.recipient_name ?? "—"}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">{pix?.instructions}</p>

              <div className="mt-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadProof(f);
                  }}
                />
                <Button
                  onClick={() => fileRef.current?.click()}
                  variant="outline"
                  className="w-full"
                >
                  <Paperclip className="h-4 w-4" /> Enviar comprovante
                </Button>
              </div>
              {order.status === "confirmed" && (
                <Badge className="w-full justify-center mt-4 bg-success/20 text-success border-success/30">
                  ✓ Premium liberado
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/50 flex flex-col">
            <CardContent className="p-4 flex-1 flex flex-col h-[500px]">
              <h2 className="font-bold mb-3 px-2">Chat com o admin</h2>
              <div className="flex-1 overflow-y-auto space-y-3 px-2">
                {(messages ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Envie o comprovante ou uma mensagem. O admin responde em breve.
                  </p>
                )}
                {(messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.is_admin ? "justify-start" : "justify-end"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.is_admin ? "bg-secondary" : "bg-gradient-to-r from-primary to-accent text-white"}`}
                    >
                      <div className="text-[10px] opacity-70 mb-0.5">
                        {m.is_admin ? "Admin" : "Você"} ·{" "}
                        {new Date(m.created_at).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      {m.message}
                      {m.attachment_url && (
                        <div className="mt-2">
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="underline text-xs"
                          >
                            📎 ver anexo
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3 px-2">
                <Input
                  value={msg}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Escreva uma mensagem…"
                />
                <Button
                  onClick={send}
                  disabled={sending || !msg.trim()}
                  className="bg-gradient-to-r from-primary to-accent text-white border-0"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
