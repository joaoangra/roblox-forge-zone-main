import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { brl, statusLabel, ESCROW_DAYS } from "@/lib/marketplace";
import { Send, Paperclip, ShieldAlert, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export const Route = createFileRoute("/market/orders/$id")({ component: OrderPage });

function OrderPage() {
  const { id } = Route.useParams();
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [loading, user, router]);

  const { data: order } = useQuery({
    queryKey: ["mp-order", id],
    queryFn: async () => {
      // marketplace_orders.buyer_id e seller_id apontam para auth.users(id).
      // Então buscamos profiles separadamente para evitar depender de relacionamentos automáticos.
      const ord = await supabase
        .from("marketplace_orders")
        .select("*, listing:listings(title, slug, cover_image_url)")
        .eq("id", id)
        .maybeSingle();

      return ord.data;
    },
    refetchInterval: 5000,
  });


  const { data: room } = useQuery({
    queryKey: ["mp-room", id],
    enabled: !!order,
    queryFn: async () => (await supabase.from("marketplace_chat_rooms").select("*").eq("order_id", id).maybeSingle()).data,
  });

  const { data: messages } = useQuery({
    queryKey: ["mp-messages", room?.id],
    enabled: !!room,
    queryFn: async () => (await supabase.from("marketplace_chat_messages").select("*").eq("room_id", room!.id).order("created_at")).data ?? [],
    refetchInterval: 3000,
  });

  const { data: pix } = useQuery({
    queryKey: ["pix-settings"],
    queryFn: async () => (await supabase.from("pix_settings").select("*").maybeSingle()).data,
  });

  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  if (!user || !order) return <PageShell><div className="mx-auto max-w-4xl p-8">Carregando…</div></PageShell>;

  const isBuyer = user.id === order.buyer_id;
  const isSeller = user.id === order.seller_id;
  const st = statusLabel(order.status);

  async function sendMessage() {
    if (!msg.trim() && !file) return;
    let attachment_url: string | null = null;
    let attachment_type: string | null = null;
    if (file) {
      const { data, error } = await supabase.storage.from("chat-attachments").upload(`${user!.id}/${Date.now()}-${file.name}`, file);
      if (error) { toast.error(error.message); return; }
      attachment_url = data.path; attachment_type = file.type;
    }
    await supabase.from("marketplace_chat_messages").insert({ room_id: room!.id, sender_id: user!.id, body: msg || null, attachment_url, attachment_type });
    setMsg(""); setFile(null);
    qc.invalidateQueries({ queryKey: ["mp-messages", room?.id] });
  }

  async function uploadProof(f: File) {
    setProofUploading(true);
    const { data, error } = await supabase.storage.from("chat-attachments").upload(`${user!.id}/proof-${Date.now()}-${f.name}`, f);
    if (error) { setProofUploading(false); toast.error(error.message); return; }
    await supabase.from("marketplace_orders").update({ payment_proof_url: data.path, status: "paid" }).eq("id", id);
    await supabase.from("marketplace_chat_messages").insert({ room_id: room!.id, sender_id: user!.id, body: "📎 Comprovante de pagamento enviado", system_message: true });
    setProofUploading(false); toast.success("Comprovante enviado. Aguarde o vendedor entregar."); qc.invalidateQueries();
  }

  async function markDelivered() {
    const releaseAt = new Date(Date.now() + ESCROW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("marketplace_orders").update({ status: "delivered", delivered_at: new Date().toISOString(), auto_release_at: releaseAt }).eq("id", id);
    await supabase.from("marketplace_chat_messages").insert({ room_id: room!.id, sender_id: user!.id, body: `✅ Vendedor marcou como entregue. Liberação automática em ${ESCROW_DAYS} dias.`, system_message: true });
    qc.invalidateQueries();
  }

  async function confirmReceived() {
    await supabase.from("marketplace_orders").update({ status: "released", released_at: new Date().toISOString() }).eq("id", id);
    await supabase.from("marketplace_chat_messages").insert({ room_id: room!.id, sender_id: user!.id, body: "✅ Comprador confirmou recebimento. Valor liberado para o vendedor.", system_message: true });
    toast.success("Pedido finalizado"); qc.invalidateQueries();
  }

  async function openDispute() {
    const reason = prompt("Descreva o problema:");
    if (!reason) return;
    await supabase.from("disputes").insert({ order_id: id, opened_by: user!.id, reason });
    await supabase.from("marketplace_orders").update({ status: "disputed" }).eq("id", id);
    await supabase.from("marketplace_chat_messages").insert({ room_id: room!.id, sender_id: user!.id, body: `⚠️ Disputa aberta: ${reason}`, system_message: true });
    toast.info("Disputa aberta. Admin irá analisar."); qc.invalidateQueries();
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-5xl px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <div className="text-xs text-muted-foreground">Pedido #{(order.id as string).slice(0, 8)}</div>
                  <h1 className="text-xl font-bold">{order.listing?.title}</h1>
                </div>
                <Badge className={st.tone + " border"}>{st.label}</Badge>
              </div>
              <div className="text-sm">Valor: <span className="font-bold text-gradient-brand">{brl(order.amount_cents)}</span></div>
            </CardContent>
          </Card>

          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="p-3 text-xs flex gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <span><strong>Nunca envie dinheiro fora da plataforma.</strong> Utilize este chat para registrar toda negociação. Todas as mensagens podem ser usadas em disputas e auditorias.</span>
            </CardContent>
          </Card>

          <Card className="flex flex-col h-[60vh]">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages?.map((m: any) => (
                <div key={m.id} className={"flex " + (m.sender_id === user.id ? "justify-end" : "justify-start")}>
                  <div className={"max-w-[80%] rounded-2xl px-4 py-2 text-sm " + (m.system_message ? "bg-primary/10 border border-primary/20 text-primary text-xs italic" : m.sender_id === user.id ? "bg-gradient-to-r from-primary to-accent text-white" : "bg-white/5")}>
                    {m.body}
                    {m.attachment_url && <a className="block underline text-xs mt-1" href="#" onClick={async (e) => { e.preventDefault(); const { data } = await supabase.storage.from("chat-attachments").createSignedUrl(m.attachment_url, 60); if (data?.signedUrl) window.open(data.signedUrl); }}>Ver anexo</a>}
                    <div className="text-[10px] opacity-60 mt-1">{new Date(m.created_at).toLocaleTimeString("pt-BR")}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/10 p-3 flex gap-2">
              <label className="cursor-pointer p-2 rounded hover:bg-white/5"><Paperclip className="h-4 w-4" /><input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
              <Textarea rows={1} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={file ? `📎 ${file.name}` : "Mensagem…"} className="resize-none" />
              <Button onClick={sendMessage}><Send className="h-4 w-4" /></Button>
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          {order.status === "awaiting_payment" && isBuyer && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="font-semibold">Pague via PIX</div>
                <div className="bg-white/5 rounded p-3 text-xs space-y-1">
                  <div><strong>Chave:</strong> {pix?.pix_key ?? "—"}</div>
                  <div><strong>Tipo:</strong> {pix?.pix_key_type ?? "—"}</div>
                  <div><strong>Em nome de:</strong> {pix?.recipient_name ?? "—"}</div>
                  <div><strong>Valor:</strong> {brl(order.amount_cents)}</div>
                </div>
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])} disabled={proofUploading} />
                <p className="text-xs text-muted-foreground">Faça o PIX e anexe o comprovante.</p>
              </CardContent>
            </Card>
          )}

          {order.status === "paid" && isSeller && (
            <Card><CardContent className="p-4 space-y-3">
              <div className="font-semibold">Entregar pedido</div>
              <p className="text-xs text-muted-foreground">Combine a entrega pelo chat. Quando entregar, marque abaixo.</p>
              <Button onClick={markDelivered} className="w-full"><CheckCircle2 className="h-4 w-4" /> Marquei como entregue</Button>
            </CardContent></Card>
          )}

          {order.status === "delivered" && isBuyer && (
            <Card><CardContent className="p-4 space-y-3">
              <div className="font-semibold flex items-center gap-2"><Clock className="h-4 w-4" /> Em escrow</div>
              <p className="text-xs text-muted-foreground">Liberação automática em {order.auto_release_at ? new Date(order.auto_release_at).toLocaleDateString("pt-BR") : "—"}.</p>
              <Button onClick={confirmReceived} className="w-full bg-gradient-to-r from-primary to-accent text-white border-0"><CheckCircle2 className="h-4 w-4" /> Confirmar e liberar agora</Button>
              <Button onClick={openDispute} variant="outline" className="w-full"><ShieldAlert className="h-4 w-4" /> Tenho um problema</Button>
            </CardContent></Card>
          )}

          {order.status === "released" && (
            <Card className="border-green-500/30 bg-green-500/5"><CardContent className="p-4 text-sm text-green-400 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Pedido finalizado com sucesso.</CardContent></Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
