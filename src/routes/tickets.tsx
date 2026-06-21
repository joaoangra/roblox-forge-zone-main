import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TicketCategory } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, Image, LifeBuoy, Loader2, Paperclip, Plus, Send, Star, XCircle } from "lucide-react";

export const Route = createFileRoute("/tickets")({
  head: () => ({ meta: [{ title: "Suporte — RBXScripts" }] }),
  component: TicketsPage,
});

const CATS = [
  { v: "support", l: "Suporte", desc: "Dúvidas gerais sobre a plataforma" },
  { v: "financial", l: "Financeiro", desc: "Pagamentos, cobranças e reembolsos" },
  { v: "dispute", l: "Disputa", desc: "Problemas com pedidos ou entregas" },
  { v: "sales", l: "Vendas", desc: "Marketplace e Bux Store" },
  { v: "bug", l: "Bug", desc: "Erros técnicos e problemas no site" },
  { v: "security", l: "Segurança", desc: "Denúncias de segurança e privacidade" },
];

const CAT_LABELS: Record<string, string> = Object.fromEntries(CATS.map((c) => [c.v, c.l]));

function TicketsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);

  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [cat, setCat] = useState<TicketCategory>("support");
  const [firstMsg, setFirstMsg] = useState("");
  const [reply, setReply] = useState("");
  const [firstFile, setFirstFile] = useState<File | null>(null);
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  type TicketRow = {
    id: string;
    subject: string;
    category: string;
    status: string;
    created_at?: string;
    assigned_to?: string | null;
  };

  type TicketMessageRow = {
    id: string;
    ticket_id: string;
    sender_id: string;
    body: string;
    attachment_url: string | null;
    created_at?: string;
  };

  const statusConfig: Record<string, { label: string; hint: string; color: string; icon: any }> = {
    open: { label: "Aberto", hint: "Aguardando atendimento", color: "text-green-400 border-green-400/30", icon: Circle },
    in_progress: { label: "Em andamento", hint: "Equipe está analisando", color: "text-blue-400 border-blue-400/30", icon: Loader2 },
    waiting_user: { label: "Aguardando você", hint: "Precisamos de mais informações", color: "text-yellow-400 border-yellow-400/30", icon: Clock },
    resolved: { label: "Resolvido", hint: "Problema solucionado", color: "text-green-500 border-green-500/30", icon: CheckCircle2 },
    closed: { label: "Fechado", hint: "Ticket encerrado", color: "text-muted-foreground border-white/10", icon: XCircle },
  };

  async function uploadSupportAttachment(file: File | null) {
    if (!file) return null;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas imagens/prints.");
      return null;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${user!.id}/${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage.from("support-attachments").upload(path, file);
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data.path;
  }

  const { data: tickets } = useQuery({
    queryKey: ["tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const res = await supabase
        .from("tickets")
        .select("id, subject, category, status, created_at, assigned_to")
        .eq("user_id", user!.id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      return (res.data ?? []) as TicketRow[];
    },
    refetchInterval: 10000,
  });

  const selectedTicket = selected && tickets
    ? tickets.find((t: TicketRow) => t.id === selected) ?? null
    : null;

  const { data: msgs } = useQuery({
    queryKey: ["t-msgs", selected],
    enabled: !!selected,
    queryFn: async () => {
      const res = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, sender_id, body, attachment_url, created_at")
        .eq("ticket_id", selected!)
        .order("created_at");

      return (res.data ?? []) as TicketMessageRow[];
    },
    refetchInterval: 3000,
  });

  if (!user) return null;

  async function createTicket() {
    try {
      if (!subject || !firstMsg) return;
      const payload = {
        user_id: user!.id,
        subject,
        category: cat,
      } satisfies Record<string, unknown>;

      const { data: t, error } = await supabase.from("tickets").insert(payload).select().single();
      if (error || !t) {
        toast.error(error?.message ?? "Erro");
        return;
      }
      const attachment_url = await uploadSupportAttachment(firstFile);
      await supabase.from("ticket_messages").insert({
        ticket_id: t.id,
        sender_id: user!.id,
        body: firstMsg,
        attachment_url,
      });
      qc.setQueryData(["tickets", user?.id], (old: TicketRow[] | undefined) => [
        { id: t.id, subject: t.subject, category: t.category, status: t.status, created_at: t.created_at, assigned_to: null },
        ...(old ?? []),
      ]);
      setSelected(t.id);
      toast.success("Ticket aberto");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar ticket");
    } finally {
      setCreating(false);
      setSubject("");
      setFirstMsg("");
      setFirstFile(null);
    }
  }

  async function sendReply() {
    if ((!reply.trim() && !replyFile) || !selected) return;
    const attachment_url = await uploadSupportAttachment(replyFile);
    await supabase.from("ticket_messages").insert({
      ticket_id: selected,
      sender_id: user!.id,
      body: reply || "Print anexado",
      attachment_url,
    });
    if (selectedTicket?.status === "waiting_user") {
      await supabase.from("tickets").update({ status: "open" }).eq("id", selected);
    }
    setReply("");
    setReplyFile(null);
    qc.invalidateQueries({ queryKey: ["t-msgs", selected] });
    qc.invalidateQueries({ queryKey: ["tickets"] });
  }

  async function closeTicket(status: "resolved" | "closed") {
    if (!selected) return;
    await (supabase as any).from("tickets").update({ status, archived_at: new Date().toISOString() }).eq("id", selected);
    qc.invalidateQueries({ queryKey: ["tickets"] });
    toast.success(status === "resolved" ? "Ticket marcado como resolvido" : "Ticket fechado");
  }

  async function submitRating(ticketId: string, staffId: string) {
    if (ratingValue < 1 || ratingValue > 5) {
      toast.error("Selecione de 1 a 5 estrelas");
      return;
    }
    const { error } = await supabase.from("ticket_ratings").insert({
      ticket_id: ticketId,
      staff_id: staffId,
      user_id: user!.id,
      rating: ratingValue,
      comment: ratingComment.trim() || null,
    } as never);
    if (error) {
      if (error.code === "23505") {
        toast.info("Você já avaliou este ticket");
      } else {
        toast.error(error.message);
      }
      return;
    }
    setRatingSubmitted(true);
    toast.success("Avaliação enviada! Obrigado.");
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Suporte</h1>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Novo ticket
          </Button>
        </div>

        {creating && (
          <Card className="mb-4">
            <CardContent className="p-6 space-y-3">
              <div>
                <Label>Assunto</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <Label>Categoria</Label>
                <p className="text-xs text-muted-foreground mb-1">Selecione o assunto do seu problema</p>
                <Select value={cat} onValueChange={(value) => setCat(value as TicketCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => (
                      <SelectItem key={c.v} value={c.v}>
                        <div>
                          <span>{c.l}</span>
                          <span className="block text-[10px] text-muted-foreground">{c.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea rows={4} value={firstMsg} onChange={(e) => setFirstMsg(e.target.value)} />
              </div>
              <div>
                <Label>Print opcional</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFirstFile(e.target.files?.[0] ?? null)}
                />
              </div>
                <p className="text-xs text-muted-foreground/70">
                  💡 Você receberá notificações por e-mail quando sua equipe responder.
                </p>
                <div className="flex gap-2">
                  <Button onClick={createTicket}>Abrir Ticket</Button>
                  <Button variant="outline" onClick={() => setCreating(false)}>
                    Cancelar
                  </Button>
                </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="w-full lg:w-[300px] shrink-0 space-y-2">
            {tickets?.length ? (
              tickets.map((t) => {
                const sc = statusConfig[t.status] ?? statusConfig.closed;
                const Icon = sc.icon;
                return (
                <button
                  key={t.id}
                  type="button"
                  onPointerDown={() => { setSelected(t.id); }}
                  className={
                    "w-full text-left p-3 rounded-lg border cursor-pointer " +
                    (selected === t.id
                      ? "border-primary bg-primary/5"
                      : "border-white/5 hover:bg-white/5")
                  }
                >
                  <div className="font-semibold text-sm truncate">{t.subject}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">
                      {CAT_LABELS[t.category] ?? t.category}
                    </Badge>
                    <Badge variant="outline" className={"text-[10px] capitalize " + sc.color}>
                      <Icon className="h-3 w-3 inline mr-0.5" /> {sc.label}
                    </Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {sc.hint}
                  </div>
                  {t.created_at && (
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(t.created_at).toLocaleString("pt-BR")}
                    </div>
                  )}
                </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground p-4">Nenhum ticket.</p>
            )}
          </div>

          {selected ? (() => {
            const ticket = tickets?.find((t: TicketRow) => t.id === selected);
            if (!ticket) return (
              <Card className="flex-1 flex items-center justify-center h-[65vh] text-muted-foreground text-sm">
                Carregando ticket…
              </Card>
            );
            const sc = statusConfig[ticket.status] ?? statusConfig.closed;
            const StatusIcon = sc.icon;
            const isClosed = ticket.status === "closed" || ticket.status === "resolved";
            return (
            <Card className="flex-1 flex flex-col h-[65vh]">
              <div className="border-b border-white/10 p-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <StatusIcon className={"h-4 w-4 " + sc.color} />
                  <span className="font-semibold">{ticket.subject}</span>
                  <Badge variant="outline" className={"text-[10px] capitalize " + sc.color}>
                    {sc.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/60 italic">{sc.hint}</span>
                </div>
                {!isClosed && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => closeTicket("resolved")}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Resolvido
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => closeTicket("closed")}>
                      <XCircle className="h-3 w-3 mr-1" /> Fechar
                    </Button>
                  </div>
                )}
              </div>

              {(() => {
                const steps = ["open", "in_progress", "waiting_user", "resolved", "closed"];
                const labels = ["Aberto", "Em andamento", "Aguardando", "Resolvido", "Fechado"];
                const idx = steps.indexOf(ticket.status);
                return (
                  <div className="border-b border-white/10 px-4 py-2 overflow-x-auto">
                    <div className="flex items-center min-w-[400px]">
                      {steps.map((s, i) => {
                        const active = i === idx;
                        const done = i < idx;
                        return (
                          <div key={s} className="flex items-center flex-1 last:flex-none">
                            <div className="flex flex-col items-center">
                              <div className={"w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold " +
                                (active ? "bg-primary text-white" : done ? "bg-green-500/20 text-green-400" : "bg-white/10 text-muted-foreground")
                              }>
                                {done ? "✓" : active ? "●" : "○"}
                              </div>
                              <span className={"text-[9px] mt-0.5 whitespace-nowrap " + (active ? "text-primary font-semibold" : "text-muted-foreground/60")}>
                                {labels[i]}
                              </span>
                            </div>
                            {i < steps.length - 1 && (
                              <div className={"flex-1 h-px mx-1 " + (i < idx ? "bg-green-500/30" : "bg-white/10")} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="space-y-2 rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                  <p className="text-[10px] font-semibold text-primary text-center mb-1">🤖 BuxHub Bot — Diretrizes</p>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">📌</span>
                    <span>Não abra tickets desnecessários. Antes de abrir, verifique se a dúvida já não foi respondida em outra seção do site.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⚠️</span>
                    <span>Nenhum membro da equipe pedirá seu email ou senha. Se alguém pedir, suspeite e nos informe imediatamente.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">💡</span>
                    <span>Descreva seu problema com detalhes. Se possível, mande um print para facilitar o trabalho da equipe.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5">⏳</span>
                    <span>Apenas aguarde. A equipe verificará seu ticket e responderá em breve. Você será notificado por e-mail quando houver resposta.</span>
                  </div>
                </div>
                {msgs?.map((m) => {
                  return (
                  <div
                    key={m.id}
                    className={"flex flex-col " + (m.sender_id === user!.id ? "items-end" : "items-start")}
                  >
                    <div
                      className={
                        "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
                        (m.sender_id === user!.id
                          ? "bg-gradient-to-r from-primary to-accent text-white"
                          : "bg-white/5")
                      }
                    >
                      {m.body}
                      {m.attachment_url && (() => {
                        const imgUrl = supabase.storage.from("support-attachments").getPublicUrl(m.attachment_url).data.publicUrl;
                        return (
                          <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                            <img src={imgUrl} alt="print" className="max-w-[200px] rounded-lg border border-white/10 hover:opacity-80 transition-opacity" loading="lazy" />
                          </a>
                        );
                      })()}
                    </div>
                    {m.created_at && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 px-1">
                        {new Date(m.created_at).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                  );
                })}

                {isClosed && ticket.assigned_to && !ratingSubmitted && (
                  <div className="space-y-3 border-t border-white/10 pt-4 mt-4">
                    <p className="text-sm font-semibold text-center">Avalie o atendimento</p>
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} type="button" onClick={() => setRatingValue(star)}>
                          <Star className={"h-8 w-8 " + (star <= ratingValue ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      rows={2}
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      placeholder="Comentário opcional..."
                    />
                    <Button className="w-full" onClick={() => submitRating(ticket.id, ticket.assigned_to!)}>
                      Enviar Avaliação
                    </Button>
                  </div>
                )}
                {isClosed && ratingSubmitted && (
                  <div className="text-center text-sm text-muted-foreground border-t border-white/10 pt-4 mt-4">
                    ⭐ Obrigado pela sua avaliação!
                  </div>
                )}
              </div>
              {!isClosed && (
              <div className="border-t border-white/10 p-3 flex gap-2">
                <Textarea
                  rows={1}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder…"
                  className="resize-none"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                />
                <label className="cursor-pointer flex items-center justify-center h-9 w-9 rounded-md border border-input hover:bg-accent">
                  <Paperclip className="h-4 w-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setReplyFile(e.target.files?.[0] ?? null)} />
                </label>
                <Button onClick={sendReply}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              )}
            </Card>
            );
          })() : (
            <div className="flex-1 flex items-center justify-center h-[65vh] text-sm text-muted-foreground">
              Selecione um ticket ao lado para visualizar
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
