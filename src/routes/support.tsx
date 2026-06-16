import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TicketCategory } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  HelpCircle,
  MessageCircle,
  Shield,
  CreditCard,
  ShoppingBag,
  Crown,
  Bug,
  AlertTriangle,
  Plus,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Central de Suporte – BuxHub" },
      {
        name: "description",
        content: "Central de suporte BuxHub. Abra um ticket, tire dúvidas e resolva problemas.",
      },
    ],
  }),
  component: SupportPage,
});

const categories = [
  { value: "duvidas", label: "Dúvidas", icon: HelpCircle, color: "text-blue-400" },
  { value: "financial", label: "Financeiro", icon: CreditCard, color: "text-green-400" },
  { value: "marketplace", label: "Marketplace", icon: ShoppingBag, color: "text-emerald-400" },
  { value: "premium", label: "Premium", icon: Crown, color: "text-yellow-400" },
  { value: "security", label: "Segurança", icon: Shield, color: "text-red-400" },
  { value: "technical", label: "Problemas Técnicos", icon: Bug, color: "text-purple-400" },
  { value: "report", label: "Denúncias", icon: AlertTriangle, color: "text-orange-400" },
];

// Map support categories to the TicketCategory enum values expected by the DB
function mapCategoryToTicketEnum(cat: string): TicketCategory {
  const map: Record<string, TicketCategory> = {
    duvidas: "support",
    financial: "financial",
    marketplace: "support",
    premium: "sales",
    security: "security",
    technical: "bug",
    report: "support",
  };
  return map[cat] ?? "support";
}

type TicketRow = {
  id: string;
  subject: string;
  category: string;
  status: string;
  created_at: string;
};

function SupportPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { data: tickets } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("id, subject, category, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);

      return (data ?? []) as TicketRow[];
    },
  });

  async function openTicket() {
    if (!user) {
      toast.error("Faça login");
      return;
    }
    if (!selectedCategory || !subject || !message) {
      toast.error("Preencha todos os campos");
      return;
    }
    setSending(true);

    // Map the support category to the DB ticket_category enum
    const dbCategory = mapCategoryToTicketEnum(selectedCategory);

    // 1) Insert into tickets table
    const { data: t, error } = await supabase
      .from("tickets")
      .insert({
        user_id: user.id,
        category: dbCategory,
        subject,
      })
      .select()
      .single();

    if (error || !t) {
      toast.error(error?.message ?? "Erro ao abrir ticket");
      setSending(false);
      return;
    }

    // 2) Insert first message into ticket_messages
    const { error: msgError } = await supabase
      .from("ticket_messages")
      .insert({
        ticket_id: t.id,
        sender_id: user.id,
        body: message,
      });

    setSending(false);

    if (msgError) {
      toast.error(msgError.message);
      return;
    }

    toast.success("Ticket aberto! Responderemos em breve.");
    setSelectedCategory("");
    setSubject("");
    setMessage("");
    qc.invalidateQueries({ queryKey: ["my-tickets"] });
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      open: { label: "Aberto", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
      in_progress: {
        label: "Em andamento",
        cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      },
      waiting_user: {
        label: "Aguardando resposta",
        cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      },
      resolved: { label: "Resolvido", cls: "bg-green-500/20 text-green-400 border-green-500/30" },
      closed: { label: "Fechado", cls: "bg-muted text-muted-foreground border-white/10" },
    };
    return map[status] ?? map.open;
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-4">
            <HelpCircle className="h-3 w-3" /> Suporte
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            Central de <span className="text-gradient-brand">Suporte</span>
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
            Tire dúvidas, resolva problemas e entre em contato com nossa equipe.
          </p>
        </div>

        <Tabs defaultValue="new">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="new">
              <Plus className="h-4 w-4" /> Abrir Ticket
            </TabsTrigger>
            <TabsTrigger value="my">
              <Clock className="h-4 w-4" /> Meus Tickets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="new">
            <Card className="border-white/10 bg-card/50 max-w-2xl mx-auto">
              <CardContent className="p-6 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Escolha a categoria e descreva seu problema. Responderemos o mais rápido possível.
                </p>
                <div>
                  <label className="text-sm font-medium mb-2 block">Categoria</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setSelectedCategory(cat.value)}
                        className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors text-left ${
                          selectedCategory === cat.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <cat.icon className={`h-4 w-4 ${cat.color}`} />
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Assunto</label>
                  <Input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Resumo do problema"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Mensagem</label>
                  <Textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descreva detalhadamente seu problema..."
                  />
                </div>
                <Button
                  onClick={openTicket}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-primary to-accent text-white border-0"
                >
                  {sending ? "Enviando..." : "Abrir Ticket"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my">
            {(tickets ?? []).length > 0 ? (
              <div className="space-y-3 max-w-2xl mx-auto">
                {(tickets ?? []).map((t) => {
                  const s = statusBadge(t.status);
                  return (
                    <Card key={t.id} className="border-white/10 bg-card/50">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold truncate">{t.subject}</h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${s.cls}`}>
                                {s.label}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {categories.find((c) => c.value === t.category)?.label ?? t.category}{" "}
                              · {new Date(t.created_at).toLocaleString("pt-BR")}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-white/10">
                <CardContent className="p-16 text-center text-muted-foreground">
                  <MessageCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  Nenhum ticket ainda. Abra um ticket para receber suporte.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}