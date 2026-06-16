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
import { Image, LifeBuoy, Paperclip, Plus, Send } from "lucide-react";

export const Route = createFileRoute("/tickets")({
  head: () => ({ meta: [{ title: "Suporte — RBXScripts" }] }),
  component: TicketsPage,
});

const CATS = [
  { v: "support", l: "Suporte" },
  { v: "financial", l: "Financeiro" },
  { v: "dispute", l: "Disputa" },
  { v: "sales", l: "Vendas" },
  { v: "bug", l: "Bug" },
  { v: "security", l: "Segurança" },
];

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

  type TicketRow = {
    id: string;
    subject: string;
    category: string;
    status: string;
  };

  type TicketMessageRow = {
    id: string;
    ticket_id: string;
    sender_id: string;
    body: string;
    attachment_url: string | null;
    created_at?: string;
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
        .select("id, subject, category, status")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      return (res.data ?? []) as TicketRow[];
    },
  });

  const { data: msgs } = useQuery({
    queryKey: ["t-msgs", selected],
    enabled: !!selected,
    queryFn: async () => {
      const res = await supabase
        .from("ticket_messages")
        .select("id, ticket_id, sender_id, body, attachment_url")
        .eq("ticket_id", selected!)
        .order("created_at");

      return (res.data ?? []) as TicketMessageRow[];
    },
    refetchInterval: 5000,
  });

  if (!user) return null;

  async function createTicket() {
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
    await supabase.from("ticket_messages").insert({
      ticket_id: t.id,
      sender_id: user!.id,
      body:
        "BuxHub Support: descreva seu problema com detalhes, envie prints se possível e evite abrir múltiplos tickets sobre o mesmo assunto.",
    });
    const attachment_url = await uploadSupportAttachment(firstFile);
    await supabase.from("ticket_messages").insert({
      ticket_id: t.id,
      sender_id: user!.id,
      body: firstMsg,
      attachment_url,
    });
    toast.success("Ticket aberto");
    setCreating(false);
    setSubject("");
    setFirstMsg("");
    setFirstFile(null);
    qc.invalidateQueries({ queryKey: ["tickets"] });
    setSelected(t.id);
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
    setReply("");
    setReplyFile(null);
    qc.invalidateQueries({ queryKey: ["t-msgs", selected] });
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
                <Select value={cat} onValueChange={(value) => setCat(value as TicketCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATS.map((c) => (
                      <SelectItem key={c.v} value={c.v}>
                        {c.l}
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
              <div className="flex gap-2">
                <Button onClick={createTicket}>Abrir</Button>
                <Button variant="outline" onClick={() => setCreating(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-[300px_1fr] gap-4">
          <div className="space-y-2">
            {tickets?.length ? (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelected(t.id)}
                  className={
                    "w-full text-left p-3 rounded-lg border " +
                    (selected === t.id
                      ? "border-primary bg-primary/5"
                      : "border-white/5 hover:bg-white/5")
                  }
                >
                  <div className="font-semibold text-sm truncate">{t.subject}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.category}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {t.status}
                    </Badge>
                  </div>
                </button>
              ))
            ) : (
              <p className="text-sm text-muted-foreground p-4">Nenhum ticket.</p>
            )}
          </div>

          {selected && (
            <Card className="flex flex-col h-[60vh]">
              <div className="border-b border-white/10 p-3 text-xs text-muted-foreground flex gap-2">
                <LifeBuoy className="h-4 w-4 text-primary shrink-0" />
                <span>
                  Descreva seu problema com detalhes, envie prints quando possível e evite abrir
                  múltiplos tickets sobre o mesmo caso.
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {msgs?.map((m) => (
                  <div
                    key={m.id}
                    className={
                      "flex " + (m.sender_id === user!.id ? "justify-end" : "justify-start")
                    }
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
                      {m.attachment_url && (
                        <span className="mt-2 flex items-center gap-1 text-xs opacity-80">
                          <Image className="h-3 w-3" /> Print anexado
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/10 p-3 flex gap-2">
                <Textarea
                  rows={1}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Responder…"
                  className="resize-none"
                />
                <Button onClick={sendReply}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </PageShell>
  );
}
