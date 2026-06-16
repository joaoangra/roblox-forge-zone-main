import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { brl, statusLabel, ESCROW_DAYS } from "@/lib/marketplace";
import {
  Send,
  Paperclip,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
} from "lucide-react";

export const Route = createFileRoute("/market/orders/$id")({ component: OrderPage });

function OrderPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);

  const { data: order } = useQuery({
    queryKey: ["mp-order", id],
    queryFn: async () =>
      (
        await supabase
          .from("marketplace_orders")
          .select("*, listing:listings(title, slug, cover_image_url)")
          .eq("id", id)
          .maybeSingle()
      ).data,
    refetchInterval: 5000,
  });

  const { data: room } = useQuery({
    queryKey: ["mp-room", id],
    enabled: !!order,
    queryFn: async () =>
      (await supabase.from("marketplace_chat_rooms").select("*").eq("order_id", id).maybeSingle())
        .data,
  });

  const { data: messages } = useQuery({
    queryKey: ["mp-messages", room?.id],
    enabled: !!room,
    queryFn: async () =>
      (
        await supabase
          .from("marketplace_chat_messages")
          .select("*")
          .eq("room_id", room!.id)
          .order("created_at")
      ).data ?? [],
    refetchInterval: 3000,
  });

  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  if (!user || !order)
    return (
      <PageShell>
        <div className="mx-auto max-w-4xl p-8">Carregando...</div>
      </PageShell>
    );

  const isBuyer = user.id === order.buyer_id;
  const isSeller = user.id === order.seller_id;
  const st = statusLabel(order.status);

  async function postAction(path: string, body: Record<string, unknown>) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) {
      router.navigate({ to: "/auth" });
      return null;
    }
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      toast.error(data.error ?? "Nao foi possivel concluir a acao");
      return null;
    }
    return data;
  }

  async function sendMessage() {
    if (!msg.trim() && !file) return;
    let attachment_url: string | null = null;
    let attachment_type: string | null = null;
    if (file) {
      const { data, error } = await supabase.storage
        .from("chat-attachments")
        .upload(`${user.id}/${Date.now()}-${file.name}`, file);
      if (error) {
        toast.error(error.message);
        return;
      }
      attachment_url = data.path;
      attachment_type = file.type;
    }
    await supabase.from("marketplace_chat_messages").insert({
      room_id: room!.id,
      sender_id: user.id,
      body: msg || null,
      attachment_url,
      attachment_type,
    });
    setMsg("");
    setFile(null);
    qc.invalidateQueries({ queryKey: ["mp-messages", room?.id] });
  }

  async function markDelivered() {
    const ok = await postAction("/marketplace/mark-delivered", { order_id: id });
    if (ok) {
      toast.success("Entrega marcada");
      qc.invalidateQueries();
    }
  }

  async function confirmReceived() {
    const ok = await postAction("/marketplace/release-order", { order_id: id });
    if (ok) {
      toast.success("Pedido finalizado e valor liberado");
      qc.invalidateQueries();
    }
  }

  async function openDispute() {
    const reason = prompt("Descreva o problema:");
    if (!reason) return;
    const ok = await postAction("/tickets/open-dispute", { order_id: id, reason });
    if (ok) {
      toast.info("Disputa aberta. Admin ira analisar.");
      qc.invalidateQueries();
    }
  }

  return (
    <PageShell>
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="border-white/10 bg-card/75">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Pedido #{(order.id as string).slice(0, 8)}
                  </div>
                  <h1 className="text-xl font-bold">{order.listing?.title}</h1>
                </div>
                <Badge className={st.tone + " border"}>{st.label}</Badge>
              </div>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs text-muted-foreground">Valor pago</div>
                  <div className="font-bold text-gradient-brand">{brl(order.amount_cents)}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs text-muted-foreground">Comissao BuxHub</div>
                  <div className="font-bold">{brl(order.platform_fee_cents)}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs text-muted-foreground">Vendedor recebe</div>
                  <div className="font-bold">{brl(order.seller_amount_cents)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/25 bg-amber-500/5">
            <CardContent className="flex gap-2 p-3 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
              <span>
                Nunca envie dinheiro, Robux, senha, cookie ou codigo fora da plataforma. Este chat e
                a trilha de auditoria da compra. Qualquer duvida, abra ticket ou denuncie.
              </span>
            </CardContent>
          </Card>

          <Card className="flex h-[62vh] flex-col overflow-hidden border-white/10 bg-card/75">
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages?.map((m: any) => (
                <div
                  key={m.id}
                  className={"flex " + (m.sender_id === user.id ? "justify-end" : "justify-start")}
                >
                  <div
                    className={
                      "max-w-[82%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm shadow-sm " +
                      (m.system_message
                        ? "border border-sky-500/25 bg-sky-500/10 text-sky-100"
                        : m.sender_id === user.id
                          ? "bg-primary text-primary-foreground"
                          : "border border-white/10 bg-white/[0.04]")
                    }
                  >
                    {m.body}
                    {m.attachment_url && (
                      <a
                        className="mt-1 block text-xs underline"
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          const { data } = await supabase.storage
                            .from("chat-attachments")
                            .createSignedUrl(m.attachment_url, 60);
                          if (data?.signedUrl) window.open(data.signedUrl);
                        }}
                      >
                        Ver anexo
                      </a>
                    )}
                    <div className="mt-1 text-[10px] opacity-60">
                      {new Date(m.created_at).toLocaleTimeString("pt-BR")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 border-t border-white/10 p-3">
              <label className="cursor-pointer rounded p-2 hover:bg-white/5">
                <Paperclip className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <Textarea
                rows={1}
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder={file ? `Anexo: ${file.name}` : "Mensagem..."}
                className="resize-none"
              />
              <Button onClick={sendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          {order.status === "awaiting_payment" && isBuyer && (
            <Card className="border-sky-500/25 bg-sky-500/5">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <CreditCard className="h-4 w-4" /> Pagamento via Stripe
                </div>
                <p className="text-xs text-muted-foreground">
                  Finalize o Checkout do Stripe. O pedido so muda para pago quando o webhook
                  assinado confirmar o pagamento.
                </p>
              </CardContent>
            </Card>
          )}

          {order.status === "paid" && isSeller && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="font-semibold">Entregar pedido</div>
                <p className="text-xs text-muted-foreground">
                  Combine tudo pelo chat. Depois da entrega, marque abaixo para registrar o marco.
                </p>
                <Button onClick={markDelivered} className="w-full">
                  <CheckCircle2 className="h-4 w-4" /> Marquei como entregue
                </Button>
              </CardContent>
            </Card>
          )}

          {order.status === "delivered" && isBuyer && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock className="h-4 w-4" /> Retencao de {ESCROW_DAYS} dias
                </div>
                <p className="text-xs text-muted-foreground">
                  Liberacao automatica prevista para{" "}
                  {order.auto_release_at
                    ? new Date(order.auto_release_at).toLocaleDateString("pt-BR")
                    : "a data calculada pelo sistema"}
                  . Voce pode liberar antes se recebeu tudo corretamente.
                </p>
                <Button onClick={confirmReceived} className="w-full">
                  <CheckCircle2 className="h-4 w-4" /> Confirmar e liberar agora
                </Button>
                <Button onClick={openDispute} variant="outline" className="w-full">
                  <ShieldAlert className="h-4 w-4" /> Tenho um problema
                </Button>
              </CardContent>
            </Card>
          )}

          {["paid", "delivered"].includes(order.status) && !isBuyer && (
            <Card className="border-white/10 bg-white/[0.03]">
              <CardContent className="space-y-2 p-4 text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">Regra de saldo</div>
                <p>
                  O valor do vendedor fica retido por {ESCROW_DAYS} dias. Se houver disputa, fica
                  bloqueado ate decisao do admin.
                </p>
              </CardContent>
            </Card>
          )}

          {order.status === "released" && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="flex items-center gap-2 p-4 text-sm text-green-300">
                <CheckCircle2 className="h-4 w-4" /> Pedido finalizado com sucesso.
              </CardContent>
            </Card>
          )}

          {order.status === "disputed" && (
            <Card className="border-orange-500/30 bg-orange-500/5">
              <CardContent className="flex items-start gap-2 p-4 text-sm text-orange-200">
                <ShieldAlert className="mt-0.5 h-4 w-4" />
                Pagamento travado. O admin decide entre reembolso e liberacao ao vendedor.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
