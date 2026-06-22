/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { adminApi } from "@/lib/adminApi";
import { AdminLayout } from "@/components/admin/AdminLayout";
import type { TabId } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Ticket,
  Users,
  FileText,
  Megaphone,
  Shield,
  Clock,
  MessageSquare,
  Send,
  Plus,
  Cpu,
  Trash2,
  Check,
  X,
  AlertCircle,
  Activity,
  UserCheck,
  ShoppingBag,
  DollarSign,
  Edit,
  Image,
  Tag,
  Paperclip,
  BarChart3,
  Fingerprint,
  ShieldCheck,
  ShieldAlert,
  Scale,
  Code2,
  Upload,
  Star,
  Heart,
  Sparkles,
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Save,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin – BuxHub" }] }),
  component: AdminPage,
});

// ============ PAGE COMPONENT ============
function AdminPage() {
  const [tab, setTab] = useState<TabId>("dashboard");

  return (
    <AdminLayout activeTab={tab} onTabChange={setTab}>
      {tab === "dashboard" && <DashboardTab />}
      {tab === "tickets" && <TicketsTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "users" && <UsersTab />}
      {tab === "logs" && <LogsTab />}
      {tab === "staff" && <StaffTab />}
      {tab === "kyc" && <KYCTab />}
      {tab === "approvals" && <ApprovalsTab />}
      {tab === "withdrawals" && <WithdrawalsTab />}
      {tab === "disputes" && <DisputesTab />}
      {tab === "finance" && <FinanceTab />}
      {tab === "shop" && <ShopTab />}
      {tab === "executores" && <ExecutorsTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "technical" && <TechnicalTab />}
      {tab === "relatorios" && <RelatoriosTab />}
    </AdminLayout>
  );
}

// ============ DASHBOARD ============
function DashboardTab() {
  const { isOwner } = useAuth();

  const { data: metrics } = useQuery({
    queryKey: ["admin-dashboard", isOwner],
    refetchInterval: 15000,
    queryFn: async () => {
      const summary = await adminApi<{
        users: number;
        openTickets: number;
        finance?: { totalRevenue: number } | null;
      }>("dashboard-summary");
      return { ...summary, revenue: summary.finance?.totalRevenue ?? null };
    },
  });

  const cards = [
    {
      label: "Usuários",
      value: metrics?.users ?? 0,
      icon: Users,
      color: "from-blue-500/20 to-blue-600/20",
    },
    {
      label: "Tickets Abertos",
      value: metrics?.openTickets ?? 0,
      icon: Ticket,
      color: "from-orange-500/20 to-red-500/20",
    },
    isOwner
      ? {
          label: "Receita Total",
          value: `R$ ${(metrics?.revenue ?? 0).toFixed(2)}`,
          icon: DollarSign,
          color: "from-purple-500/20 to-violet-500/20",
        }
      : {
          label: "Acesso",
          value: "Limitado",
          icon: Shield,
          color: "from-slate-500/20 to-slate-600/20",
        },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Visão Geral</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-white/10 bg-card/50 overflow-hidden">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </div>
                <div
                  className={`h-10 w-10 rounded-lg bg-gradient-to-br ${c.color} grid place-items-center`}
                >
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {isOwner && (
        <Card className="border-white/10 bg-card/50">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-amber-400">
              <Shield className="h-5 w-5" />
              <span className="font-semibold">Você tem acesso total ao sistema</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Como Owner você pode gerenciar staff, finanças e configurações do site.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============ TICKETS (ADMIN VIEW) ============
function TicketsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["admin-tickets", showArchived],
    refetchInterval: 10000,
    queryFn: async () => {
      const data = await adminApi<{ tickets: any[] }>("list-tickets", { archived: showArchived });
      return data.tickets;
    },
  });

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");
  const [replyFile, setReplyFile] = useState<File | null>(null);

  const { data: messages } = useQuery({
    queryKey: ["admin-ticket-msgs", selectedTicket?.id],
    enabled: !!selectedTicket,
    queryFn: async () => {
      const data = await adminApi<{ messages: any[] }>("ticket-messages", {
        ticket_id: selectedTicket!.id,
      });
      return data.messages;
    },
    refetchInterval: 5000,
  });

  async function uploadAdminAttachment(file: File): Promise<string | null> {
    if (!file.type.startsWith("image/")) {
      toast.error("Envie apenas imagens/prints.");
      return null;
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `admin/${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage.from("support-attachments").upload(path, file);
    if (error) {
      toast.error(error.message);
      return null;
    }
    return data.path;
  }

  async function sendReply() {
    if ((!reply.trim() && !replyFile) || !selectedTicket) return;
    let attachmentUrl: string | null = null;
    if (replyFile) {
      attachmentUrl = await uploadAdminAttachment(replyFile);
      if (!attachmentUrl) return;
    }
    await adminApi("reply-ticket", {
      ticket_id: selectedTicket.id,
      body: reply.trim() || "Print anexado",
      attachment_url: attachmentUrl,
    });
    setReply("");
    setReplyFile(null);
    qc.invalidateQueries({ queryKey: ["admin-ticket-msgs", selectedTicket.id] });
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
  }

  async function updateStatus(id: string, status: string) {
    try {
      await adminApi("update-ticket-status", { id, status });
      qc.invalidateQueries({ queryKey: ["admin-tickets"] });
      toast.success(`Status atualizado para ${status}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar status");
    }
  }

  const statusColors: Record<string, string> = {
    open: "bg-green-500/20 text-green-400",
    in_progress: "bg-blue-500/20 text-blue-400",
    waiting_user: "bg-yellow-500/20 text-yellow-400",
    resolved: "bg-green-500/20 text-green-400",
    closed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Ticket className="h-5 w-5" /> Tickets de Suporte
      </h2>

      <div className="flex gap-2">
        <Button size="sm" variant={showArchived ? "outline" : "default"} onClick={() => setShowArchived(false)}>
          Ativos
        </Button>
        <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(true)}>
          Arquivados
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_2fr] gap-4">
        {/* Lista de tickets */}
        <div className="space-y-2 max-h-[70vh] overflow-y-auto">
          {ticketsLoading && (
            <p className="text-sm text-muted-foreground p-4">Carregando tickets...</p>
          )}
          {(tickets ?? []).length === 0 && !ticketsLoading && (
            <p className="text-sm text-muted-foreground p-4">Nenhum ticket encontrado. Se houver tickets, verifique se as permissões de banco estão corretas.</p>
          )}
          {(tickets ?? []).map((t: any) => (
            <button
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selectedTicket?.id === t.id
                  ? "border-primary bg-primary/5"
                  : "border-white/10 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status] ?? ""}`}
                >
                  {t.status}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="font-semibold text-sm mt-1 truncate">{t.subject}</p>
              <p className="text-xs text-muted-foreground truncate">
                {t.profiles?.username ?? "—"} · {t.category}
              </p>
            </button>
          ))}
        </div>

        {/* Chat / Detalhes do ticket */}
        {selectedTicket ? (
          <Card className="border-white/10 bg-card/50 flex flex-col h-[70vh]">
            <CardContent className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedTicket.subject}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedTicket.profiles?.username ?? "—"} · Categoria:{" "}
                    {selectedTicket.category}
                  </p>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {["open", "in_progress", "waiting_user", "resolved", "closed"].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedTicket.id, s)}
                      className={`text-[10px] px-2 py-1 rounded ${
                        selectedTicket.status === s
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      {s === "open" ? "aberto" : s === "in_progress" ? "andamento" : s === "waiting_user" ? "aguardando" : s === "resolved" ? "resolvido" : "fechado"}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
              <p className="text-[10px] font-semibold text-primary text-center mb-1">🤖 BuxHub Bot — Diretrizes</p>
              <div className="flex items-start gap-2 mb-1"><span className="shrink-0 mt-0.5">📌</span><span>Não abra tickets desnecessários. Antes de abrir, verifique se a dúvida já não foi respondida em outra seção do site.</span></div>
              <div className="flex items-start gap-2 mb-1"><span className="shrink-0 mt-0.5">⚠️</span><span>Nenhum membro da equipe pedirá seu email ou senha. Se alguém pedir, suspeite e nos informe imediatamente.</span></div>
              <div className="flex items-start gap-2 mb-1"><span className="shrink-0 mt-0.5">💡</span><span>Descreva seu problema com detalhes. Se possível, mande um print para facilitar o trabalho da equipe.</span></div>
              <div className="flex items-start gap-2"><span className="shrink-0 mt-0.5">⏳</span><span>Apenas aguarde. A equipe verificará seu ticket e responderá em breve.</span></div>
            </div>
            {(messages ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center">Nenhuma mensagem neste ticket.</p>
            )}
            {(messages ?? []).map((m: any) => {
              const attachmentUrl = m.attachment_url
                ? supabase.storage.from("support-attachments").getPublicUrl(m.attachment_url).data.publicUrl
                : null;
              return (
              <div
                key={m.id}
                className={`flex ${m.sender_id === user!.id ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.sender_id === user!.id ? "bg-primary text-white" : "bg-white/5"
                  }`}
                >
                  <p className="text-[10px] opacity-60 mb-1">{m.profiles?.username ?? "—"}</p>
                  <p>{m.body}</p>
                  {attachmentUrl && (
                    <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                      <img src={attachmentUrl} alt="print" className="max-w-[200px] rounded-lg border border-white/10 hover:opacity-80 transition-opacity" loading="lazy" />
                    </a>
                  )}
                  </div>
                </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <Textarea
                rows={1}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder..."
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
            {replyFile && (
              <p className="text-[10px] text-muted-foreground px-3 pb-2">📎 {replyFile.name}</p>
            )}
          </Card>
        ) : (
          <Card className="border-dashed border-white/10 bg-card/50">
            <CardContent className="p-10 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-50" />
              Selecione um ticket para visualizar
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============ ANNOUNCEMENTS (AVISOS) ============
function AnnouncementsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: "",
    content: "",
    priority: "normal",
    type: "permanent",
    expires_at: "",
  });

  const { data: announcements } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const data = await adminApi<{ announcements: any[] }>("list-announcements");
      return data.announcements;
    },
  });

  async function create() {
    if (!form.title || !form.content) {
      toast.error("Preencha título e conteúdo");
      return;
    }
    const payload: any = {
      title: form.title,
      content: form.content,
      priority: form.priority,
      type: form.type,
    };
    if (form.type === "temporary" && form.expires_at) {
      payload.expires_at = new Date(form.expires_at).toISOString();
    }
    try {
      await adminApi("create-announcement", payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar aviso");
      return;
    }
    toast.success("Aviso criado!");
    setForm({ title: "", content: "", priority: "normal", type: "permanent", expires_at: "" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  async function toggleActive(id: string, current: boolean) {
    await adminApi("toggle-announcement", { id, active: !current });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir aviso?")) return;
    await adminApi("delete-announcement", { id });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  const priorityColors: Record<string, string> = {
    normal: "bg-blue-500/20 text-blue-400",
    important: "bg-orange-500/20 text-orange-400",
    critical: "bg-red-500/20 text-red-400",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Megaphone className="h-5 w-5" /> Avisos Globais
      </h2>

      <Card className="border-white/10 bg-card/50">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-medium">Criar Novo Aviso</h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Prioridade</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  <option value="normal">Normal</option>
                  <option value="important">Importante</option>
                  <option value="critical">Crítico</option>
                </select>
              </div>
              <div>
                <Label>Tipo</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                >
                  <option value="permanent">Permanente</option>
                  <option value="temporary">Temporário</option>
                </select>
              </div>
            </div>
          </div>
          {form.type === "temporary" && (
            <div>
              <Label>Expira em</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
          )}
          <div>
            <Label>Conteúdo</Label>
            <Textarea
              rows={3}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <Button onClick={create}>
            <Plus className="h-4 w-4" /> Criar Aviso
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(announcements ?? []).map((a: any) => (
          <Card key={a.id} className="border-white/10 bg-card/50">
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[a.priority] ?? ""}`}
                  >
                    {a.priority}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.type} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <h3 className="font-semibold mt-1">{a.title}</h3>
                <p className="text-sm text-muted-foreground">{a.content}</p>
                {a.expires_at && (
                  <p className="text-xs text-amber-400 mt-1">
                    Expira: {new Date(a.expires_at).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant={a.active ? "outline" : "default"}
                  onClick={() => toggleActive(a.id, a.active)}
                >
                  {a.active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)} title="Remover anúncio">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ USERS ============
function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: userBundle } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      return adminApi<{ users: any[]; roles: any[]; staff: any[] }>("list-users", { search });
    },
  });

  const users = userBundle?.users ?? [];
  const adminIds = new Set(
    (userBundle?.roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id),
  );
  const staffByUser = new Map((userBundle?.staff ?? []).map((s: any) => [s.user_id, s]));

  async function togglePremium(id: string, current: boolean) {
    await adminApi("toggle-premium", { user_id: id, enabled: !current });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success(current ? "Premium removido" : "Premium concedido");
  }

  async function updateStatus(id: string, status: string) {
    await adminApi("update-user-status", { user_id: id, status });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success("Status do usuário atualizado");
  }

  async function resetPassword(id: string) {
    const data = await adminApi<{ actionLink: string | null }>("reset-user-password", {
      user_id: id,
    });
    if (data.actionLink) {
      await navigator.clipboard?.writeText(data.actionLink);
      toast.success("Link de reset copiado");
    } else {
      toast.success("Reset de senha gerado");
    }
  }

  async function deleteUser(id: string) {
    if (!confirm("Excluir permanentemente esta conta?")) return;
    await adminApi("delete-user", { user_id: id });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success("Conta deletada");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Users className="h-5 w-5" /> Usuários
      </h2>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou username..."
      />
      <div className="space-y-2">
        {users.map((p: any) => (
          <Card key={p.id} className="border-white/10 bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {p.display_name ?? p.username ?? "—"}
                  {adminIds.has(p.id) && (
                    <Badge className="bg-primary/20 text-primary text-[10px]">ADMIN</Badge>
                  )}
                  {staffByUser.get(p.id)?.role && (
                    <Badge variant="outline" className="text-[10px]">
                      {staffByUser.get(p.id).role}
                    </Badge>
                  )}
                  {p.is_premium && (
                    <Badge className="bg-gradient-to-r from-primary to-accent border-0 text-[10px]">
                      PREMIUM
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  @{p.username} · {new Date(p.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => togglePremium(p.id, p.is_premium)}
                >
                  {p.is_premium ? "Remover Premium" : "Dar Premium"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "suspended")}>
                  Suspender
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "banned")}>
                  Banir
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus(p.id, "active")}>
                  Reativar
                </Button>
                <Button size="sm" variant="outline" onClick={() => resetPassword(p.id)}>
                  Reset senha
                </Button>
                <Button size="sm" variant="ghost" onClick={() => deleteUser(p.id)} title="Excluir usuário">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ LOGS ============
function LogsTab() {
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState("");

  const { data: logs } = useQuery({
    queryKey: ["admin-logs", page, filter],
    queryFn: async () => {
      const data = await adminApi<{ logs: any[] }>("list-logs", { page, filter });
      return data.logs;
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="h-5 w-5" /> Logs do Sistema
      </h2>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filtrar por ação (ex: ticket, login, payment)..."
      />
      <Card className="border-white/10 bg-card/50">
        <CardContent className="p-4">
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {(logs ?? []).map((log: any) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 text-sm"
              >
                <Activity className="h-3 w-3 mt-1 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-primary">{log.action}</span>
                  <span className="text-muted-foreground"> — {log.entity_type}</span>
                  {log.entity_id && (
                    <span className="text-muted-foreground"> #{log.entity_id.slice(0, 8)}</span>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    {log.profiles?.username ?? "sistema"} ·{" "}
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            ))}
            {(logs ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum log encontrado.
              </p>
            )}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <Button
              size="sm"
              variant="outline"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
            <Button
              size="sm"
              variant="outline"
              disabled={(logs ?? []).length < 50}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ STAFF MANAGEMENT ============
function StaffTab() {
  const qc = useQueryClient();

  const { data: staff } = useQuery({
    queryKey: ["admin-staff"],
    queryFn: async () => {
      const data = await adminApi<{ staff: any[]; permissions: string[]; roleLevel: Record<string, number> }>("list-staff");
      return data.staff;
    },
  });

  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("helper");
  const [adding, setAdding] = useState(false);

  async function addStaff() {
    if (!newUserId) return;
    setAdding(true);
    try {
      await adminApi("add-staff", {
        user_id: newUserId,
        role: newRole,
        permissions: getDefaultPermissions(newRole),
      });
    } catch (error) {
      setAdding(false);
      toast.error(error instanceof Error ? error.message : "Erro ao adicionar staff");
      return;
    }
    setAdding(false);
    toast.success("Staff adicionado!");
    setNewUserId("");
    qc.invalidateQueries({ queryKey: ["admin-staff"] });
  }

  async function removeStaff(id: string) {
    if (!confirm("Remover membro da staff?")) return;
    await adminApi("remove-staff", { id });
    qc.invalidateQueries({ queryKey: ["admin-staff"] });
    toast.success("Staff removido");
  }

  function getDefaultPermissions(role: string): string[] {
    switch (role) {
      case "admin":
      case "moderator":
        return [
          "dashboard.read",
          "tickets.read",
          "tickets.respond",
          "tickets.resolve",
          "tickets.assign",
          "users.read",
          "users.edit",
          "users.suspend",
          "users.ban",
          "announcements.create",
          "announcements.edit",
          "announcements.delete",
          "shop.products.read_all",
          "listings.approve",
          "listings.reject",
          "logs.read",
          "technical.read",
          "disputes.resolve",
        ];
      case "staff":
      case "support":
        return [
          "dashboard.read",
          "tickets.read",
          "tickets.respond",
          "tickets.resolve",
          "users.read",
          "logs.read",
        ];
      case "helper":
        return ["dashboard.read", "tickets.read", "tickets.respond", "tickets.resolve"];
      case "official_seller":
        return ["shop.products.manage", "shop.bux.manage"];
      case "seller":
        return ["shop.products.manage"];
      default:
        return [];
    }
  }

  const roleBadges: Record<string, string> = {
    owner: "bg-amber-500/20 text-amber-400",
    admin: "bg-red-500/20 text-red-400",
    staff: "bg-cyan-500/20 text-cyan-400",
    helper: "bg-emerald-500/20 text-emerald-400",
    moderator: "bg-blue-500/20 text-blue-400",
    support: "bg-green-500/20 text-green-400",
    official_seller: "bg-pink-500/20 text-pink-400",
    seller: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Shield className="h-5 w-5" /> Gerenciar Staff
      </h2>

      <Card className="border-white/10 bg-card/50">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-medium">Adicionar Membro</h3>
          <div className="flex gap-2">
            <Input
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="UUID do usuário"
              className="flex-1"
            />
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <option value="helper">Ajudante</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="support">Suporte</option>
              <option value="moderator">Moderador</option>
              <option value="official_seller">Vendedor Oficial</option>
              <option value="seller">Vendedor Comum</option>
            </select>
            <Button onClick={addStaff} disabled={adding}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(staff ?? []).map((s: any) => (
          <Card key={s.id} className="border-white/10 bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {s.profiles?.display_name ?? s.profiles?.username ?? "—"}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadges[s.role] ?? ""}`}>
                    {s.role}
                  </span>
                  {!s.is_active && <span className="text-xs text-muted-foreground">(inativo)</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Permissões: {s.permissions?.length ?? 0} · Desde{" "}
                  {new Date(s.granted_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeStaff(s.id)} title="Remover staff">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ KYC VERIFICATION REVIEW ============
function KYCTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<any>(null);
  const [reviewStatus, setReviewStatus] = useState("approved");
  const [adminNotes, setAdminNotes] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});

  // Checklist items
  const checklistItems = [
    { id: "name_match", label: "Nome confere com documento?" },
    { id: "cpf_valid", label: "CPF parece válido?" },
    { id: "doc_legible", label: "Documento está legível?" },
    { id: "doc_authentic", label: "Documento parece autêntico?" },
    { id: "selfie_matches", label: "Selfie combina com documento?" },
    { id: "no_fraud", label: "Há sinais de fraude?" },
  ];
  const [checklist, setChecklist] = useState<Record<string, "approved" | "rejected" | null>>({});

  const { data: kycData, isLoading } = useQuery({
    queryKey: ["admin-kyc-list", filter],
    refetchInterval: 10000,
    queryFn: async () => {
      const data = await adminApi<{ verifications: any[] }>("list-kyc", { filter });
      return data.verifications;
    },
  });

  async function loadDocUrl(path: string): Promise<string> {
    if (docUrls[path]) return docUrls[path];
    try {
      const data = await adminApi<{ url: string }>("kyc-doc-url", { path });
      setDocUrls((prev) => ({ ...prev, [path]: data.url }));
      return data.url;
    } catch {
      return "";
    }
  }

  useEffect(() => {
    if (selected) {
      setReviewStatus(selected.status === "banned" ? "banned" : "approved");
      setAdminNotes(selected.admin_notes || "");
      setChecklist({});
      setDocUrls({});
    }
  }, [selected]);

  async function submitReview() {
    if (!selected) return;
    setReviewing(true);
    try {
      await adminApi("kyc-review", {
        id: selected.id,
        status: reviewStatus,
        admin_notes: adminNotes,
      });
      toast.success(`Verificação ${reviewStatus === "approved" ? "aprovada" : reviewStatus === "rejected" ? "rejeitada" : "banida"}`);
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-kyc-list"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao revisar");
    }
    setReviewing(false);
  }

  const pendingCount = kycData?.filter((v: any) => v.status === "pending").length ?? 0;

  function getRiskBadge(score: number) {
    if (score <= 30) return <Badge variant="outline" className="text-green-500 border-green-500/30">Baixo</Badge>;
    if (score <= 70) return <Badge variant="outline" className="text-amber-500 border-amber-500/30">Médio</Badge>;
    return <Badge variant="destructive">Alto</Badge>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <UserCheck className="h-5 w-5" />
        Revisão KYC
        {pendingCount > 0 && (
          <Badge variant="default" className="ml-2">{pendingCount} pendentes</Badge>
        )}
      </h2>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        {["pending", "approved", "rejected", "banned", "all"].map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => { setFilter(f); setSelected(null); }}
          >
            {f === "pending" ? "Pendentes" : f === "approved" ? "Aprovados" : f === "rejected" ? "Rejeitados" : f === "banned" ? "Banidos" : "Todos"}
          </Button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_1.5fr] gap-4">
        {/* List */}
        <div className="space-y-2 max-h-[75vh] overflow-y-auto">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
          {(kycData ?? []).length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">Nenhuma verificação encontrada.</p>
          )}
          {(kycData ?? []).map((v: any) => (
            <button
              key={v.id}
              onClick={() => setSelected(v)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selected?.id === v.id
                  ? "border-primary bg-primary/5"
                  : "border-white/10 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{v.status}</Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(v.created_at).toLocaleDateString("pt-BR")}
                </span>
              </div>
              <p className="font-medium text-sm mt-1 truncate">{v.full_name || "—"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {v.profiles?.username ?? "—"} · Score: {v.risk_score ?? "?"}
                {v.risk_score !== undefined && v.risk_score !== null && (
                  <span className="ml-1">{getRiskBadge(v.risk_score)}</span>
                )}
              </p>
            </button>
          ))}
        </div>

        {/* Detail view */}
        {selected ? (
          <Card className="border-white/10 bg-card/50">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{selected.full_name || "Sem nome"}</h3>
                <Badge variant="outline" className="capitalize">{selected.status}</Badge>
              </div>

              {/* User info */}
              <div className="grid grid-cols-2 gap-3 text-sm bg-white/5 rounded-lg p-3">
                <div>
                  <span className="text-muted-foreground text-xs">Usuário</span>
                  <p>{selected.profiles?.username ?? selected.user_id?.slice(0, 8)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">ID</span>
                  <p className="font-mono text-xs">{selected.user_id?.slice(0, 12)}...</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">CPF</span>
                  <p>{selected.cpf || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Nascimento</span>
                  <p>{selected.birth_date ? new Date(selected.birth_date).toLocaleDateString("pt-BR") : "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Documento</span>
                  <p className="capitalize">{selected.document_type || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Score de Risco</span>
                  <p className="flex items-center gap-1">
                    {selected.risk_score ?? 0}/100
                    {getRiskBadge(selected.risk_score ?? 0)}
                  </p>
                </div>
              </div>

              {/* Documents */}
              <div className="grid grid-cols-3 gap-2">
                {selected.document_front_url && (
                  <DocThumb
                    label="Frente"
                    path={selected.document_front_url}
                    loadUrl={loadDocUrl}
                    urls={docUrls}
                  />
                )}
                {selected.document_back_url && (
                  <DocThumb
                    label="Verso"
                    path={selected.document_back_url}
                    loadUrl={loadDocUrl}
                    urls={docUrls}
                  />
                )}
                {selected.selfie_url && (
                  <DocThumb
                    label="Selfie"
                    path={selected.selfie_url}
                    loadUrl={loadDocUrl}
                    urls={docUrls}
                  />
                )}
              </div>

              {/* Review Checklist */}
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Checklist de Verificação
                </h4>
                <div className="space-y-1">
                  {checklistItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm py-1">
                      <span className="text-muted-foreground">{item.label}</span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setChecklist((p) => ({ ...p, [item.id]: "approved" }))}
                          className={`text-xs px-2 py-0.5 rounded ${
                            checklist[item.id] === "approved"
                              ? "bg-green-500/20 text-green-400"
                              : "text-muted-foreground hover:bg-white/5"
                          }`}
                        >
                          ✓
                        </button>
                        <button
                          onClick={() => setChecklist((p) => ({ ...p, [item.id]: "rejected" }))}
                          className={`text-xs px-2 py-0.5 rounded ${
                            checklist[item.id] === "rejected"
                              ? "bg-red-500/20 text-red-400"
                              : "text-muted-foreground hover:bg-white/5"
                          }`}
                        >
                          ✗
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <Label>Notas do admin</Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Observações sobre esta verificação..."
                  rows={3}
                />
              </div>

              {/* Review actions */}
              <div className="flex gap-2">
                {(selected.status !== "banned") && (
                  <>
                    <Button
                      variant={reviewStatus === "approved" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReviewStatus("approved")}
                      className="flex-1"
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      variant={reviewStatus === "rejected" ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setReviewStatus("rejected")}
                      className="flex-1"
                    >
                      <X className="h-4 w-4" /> Rejeitar
                    </Button>
                  </>
                )}
                {reviewStatus !== "banned" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReviewStatus("banned")}
                    className={reviewStatus === "banned" ? "bg-red-500/20 text-red-400" : ""}
                  >
                    <ShieldAlert className="h-4 w-4" /> Banir
                  </Button>
                )}
              </div>
              {selected.status !== reviewStatus && (
                <Button onClick={submitReview} disabled={reviewing} className="w-full">
                  {reviewing ? "Processando..." : `Confirmar ${reviewStatus === "approved" ? "Aprovação" : reviewStatus === "rejected" ? "Rejeição" : "Banimento"}`}
                </Button>
              )}
              {selected.status === reviewStatus && (
                <p className="text-xs text-muted-foreground text-center">Esta verificação já está com status "{selected.status}".</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-white/10 bg-card/50">
            <CardContent className="p-10 text-center text-muted-foreground">
              <UserCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
              Selecione uma verificação para revisar
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function DocThumb({ label, path, loadUrl, urls }: {
  label: string;
  path: string;
  loadUrl: (p: string) => Promise<string>;
  urls: Record<string, string>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!urls[path] && !loading) {
      setLoading(true);
      loadUrl(path).finally(() => setLoading(false));
    }
  }, [path, urls, loadUrl, loading]);

  return (
    <div className="border border-white/10 rounded-lg overflow-hidden">
      <p className="text-[10px] text-muted-foreground px-2 py-1 bg-white/5">{label}</p>
      {loading ? (
        <div className="h-24 grid place-items-center">
          <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error || !urls[path] ? (
        <div
          className="h-24 grid place-items-center cursor-pointer text-muted-foreground hover:text-foreground"
          onClick={() => loadUrl(path)}
        >
          <Fingerprint className="h-5 w-5" />
          <p className="text-[10px]">Carregar</p>
        </div>
      ) : (
        <a href={urls[path]} target="_blank" rel="noopener noreferrer">
          <img
            src={urls[path]}
            alt={label}
            className="w-full h-24 object-cover hover:opacity-80 transition-opacity cursor-pointer"
            onError={() => setError(true)}
          />
        </a>
      )}
    </div>
  );
}

// ============ LISTING APPROVALS ============
function ApprovalsTab() {
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<"anuncios" | "scripts" | "gerenciar">("anuncios");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["admin-pending-listings"],
    queryFn: async () => {
      const data = await adminApi<{ listings: any[] }>("list-pending-listings");
      return data.listings;
    },
  });

  const { data: pendingScripts } = useQuery({
    queryKey: ["admin-scripts-pending"],
    queryFn: () => adminApi<{ scripts: any[] }>("list-scripts-pending"),
  });

  async function approve(id: string) {
    await adminApi("approve-listing", { id });
    toast.success("Anúncio aprovado");
    qc.invalidateQueries({ queryKey: ["admin-pending-listings"] });
  }

  async function reject(id: string) {
    if (!reason.trim()) {
      toast.error("Informe o motivo da recusa");
      return;
    }
    await adminApi("reject-listing", { id, reason });
    toast.success("Anúncio recusado");
    setRejecting(null);
    setReason("");
    qc.invalidateQueries({ queryKey: ["admin-pending-listings"] });
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Check className="h-5 w-5" /> Aprovações
      </h2>

      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setSubTab("anuncios")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "anuncios"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Anúncios
          <span className="ml-1.5 text-xs opacity-60">({listings?.length ?? 0})</span>
        </button>
        <button
          onClick={() => setSubTab("scripts")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "scripts"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Scripts
          <span className="ml-1.5 text-xs opacity-60">({pendingScripts?.scripts?.length ?? 0})</span>
        </button>
        <button
          onClick={() => setSubTab("gerenciar")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            subTab === "gerenciar"
              ? "bg-primary/10 text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Gerenciar
        </button>
      </div>

      {subTab === "anuncios" && (
        <>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando anúncios...</p>}

          <div className="space-y-3">
            {(listings ?? []).map((listing: any) => (
              <Card key={listing.id} className="border-white/10 bg-card/50">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{listing.title}</h3>
                        <Badge variant={listing.status === "rejected" ? "destructive" : "outline"}>
                          {listing.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        R$ {(Number(listing.price_cents ?? 0) / 100).toFixed(2)} · Estoque{" "}
                        {listing.stock ?? 0} · {new Date(listing.created_at).toLocaleString("pt-BR")}
                      </p>
                      {listing.rejection_reason && (
                        <p className="text-sm text-destructive mt-2">{listing.rejection_reason}</p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => approve(listing.id)}>
                        <Check className="h-4 w-4" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setRejecting(listing.id)}>
                        <X className="h-4 w-4" /> Recusar
                      </Button>
                    </div>
                  </div>

                  {rejecting === listing.id && (
                    <div className="flex gap-2">
                      <Input
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        placeholder="Motivo da recusa"
                      />
                      <Button variant="destructive" onClick={() => reject(listing.id)}>
                        Confirmar
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {!isLoading && (listings ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum anúncio pendente.</p>
          )}
        </>
      )}

      {subTab === "scripts" && (
        <>
          <div className="space-y-2">
            {(pendingScripts?.scripts ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum script pendente.</p>
            ) : (
              (pendingScripts?.scripts ?? []).map((script: any) => (
                <ScriptReviewCard key={script.id} script={script} qc={qc} />
              ))
            )}
          </div>
        </>
      )}

      {subTab === "gerenciar" && <ManageScriptsTab qc={qc} />}
    </div>
  );
}

// ============ GERENCIAR SCRIPTS (ADMIN) ============
function ManageScriptsTab({ qc }: { qc: ReturnType<typeof useQueryClient> }) {
  const [search, setSearch] = useState("");
  const [scripts, setScripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const q = (supabase as any).from("scripts").select("*").order("created_at", { ascending: false });
        if (search.trim()) {
          const s = search.trim().replace(/[%_]/g, "");
          q.or(`title.ilike.%${s}%,description.ilike.%${s}%,game_name.ilike.%${s}%,slug.ilike.%${s}%`);
        }
        const { data } = await q;
        const userIds = [...new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))];
        if (userIds.length > 0) {
          const { data: profs } = await (supabase as any).from("profiles").select("id, username").in("id", userIds);
          const pmap: Record<string, any> = {};
          for (const p of profs ?? []) pmap[p.id] = p;
          for (const r of data ?? []) r.profile = pmap[r.user_id] ?? null;
        }
        setScripts(data ?? []);
      } catch { /* ignore */ }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="space-y-4">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar scripts por nome, jogo, slug..."
        className="h-10"
      />
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : scripts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum script encontrado.</p>
      ) : (
        <div className="space-y-2">
          {scripts.map((s) => (
            <ScriptManageCard key={s.id} script={s} qc={qc} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptManageCard({ script, qc }: { script: any; qc: ReturnType<typeof useQueryClient> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(script.title ?? "");
  const [description, setDescription] = useState(script.description ?? "");
  const [code, setCode] = useState(script.code ?? "");
  const [gameName, setGameName] = useState(script.game_name ?? "");
  const [gameLink, setGameLink] = useState(script.game_link ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(script.thumbnail_url ?? "");
  const [qualityScore, setQualityScore] = useState(script.quality_score ?? 50);
  const [isPremium, setIsPremium] = useState(script.is_premium ?? false);
  const [isFeatured, setIsFeatured] = useState(script.is_featured ?? false);
  const [isVerified, setIsVerified] = useState(script.is_verified ?? false);
  const [tags, setTags] = useState<string[]>(script.tags ?? []);
  const [hasKey, setHasKey] = useState(script.has_key ?? false);
  const [saving, setSaving] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await adminApi("update-script", {
        id: script.id, title, description, code,
        game_name: gameName, game_link: gameLink,
        thumbnail_url: thumbnailUrl, quality_score: qualityScore,
        is_premium: isPremium, is_featured: isFeatured, is_verified: isVerified,
        tags, has_key: hasKey,
      });
      toast.success("Script atualizado!");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["admin-scripts-pending"] });
      qc.invalidateQueries({ queryKey: ["script", script.slug] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm("Tem certeza que deseja excluir este script permanentemente?")) return;
    await adminApi("delete-script", { id: script.id });
    toast.success("Script excluído.");
    qc.invalidateQueries({ queryKey: ["admin-scripts-pending"] });
  }

  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{script.title}</h3>
              <Badge variant={script.status === "approved" ? "default" : script.status === "rejected" ? "destructive" : "outline"}>
                {script.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {script.profile?.username ?? "Desconhecido"} · {script.game_name ?? "Universal"} · {script.views} views · {script.likes_count} curtidas
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {editing && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div>
              <Label className="text-xs">Código</Label>
              <Textarea value={code} onChange={(e) => setCode(e.target.value)} rows={4} className="text-sm font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Jogo</Label>
                <Input value={gameName} onChange={(e) => setGameName(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Link do Jogo</Label>
                <Input value={gameLink} onChange={(e) => setGameLink(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Imagem URL</Label>
              <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Qualidade: <span className="text-yellow-400">{qualityScore}</span></Label>
              <input type="range" min="0" max="100" value={qualityScore} onChange={(e) => setQualityScore(Number(e.target.value))} className="w-full accent-primary" />
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} className="accent-primary" />
                Premium
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="accent-primary" />
                Destaque
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} className="accent-primary" />
                Verificado
              </label>
            </div>
            <div>
              <Label className="text-xs">Tags</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {["Sem Key", "Seguro", "Indetectável", "Funciona bem", "Atualizado"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-all duration-200 ${
                      tags.includes(tag)
                        ? "bg-primary/20 border-primary text-primary border-primary/40"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
                    }`}
                  >
                    {tags.includes(tag) ? "✓ " : ""}{tag}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasKey} onChange={(e) => setHasKey(e.target.checked)} className="accent-primary" />
              {hasKey ? "🔒 Com Key" : "🔓 Sem Key"}
            </label>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} size="sm">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ SCRIPT REVIEW CARD ============
function ScriptReviewCard({ script, qc }: { script: any; qc: ReturnType<typeof useQueryClient> }) {
  const [expanded, setExpanded] = useState(false);
  const [qualityScore, setQualityScore] = useState(script.quality_score ?? 50);
  const [gameName, setGameName] = useState(script.game_name ?? "");
  const [gameLink, setGameLink] = useState(script.game_link ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(script.thumbnail_url ?? "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);

  async function uploadThumbnail(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 2MB"); return; }
    setUploadingImg(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `script-${script.id}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("script-thumbnails").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("script-thumbnails").getPublicUrl(path);
      setThumbnailUrl(pub.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao enviar imagem");
    }
    setUploadingImg(false);
  }

  async function handleAction(status: "approved" | "rejected") {
    const body: Record<string, unknown> = { id: script.id, status };
    if (status === "approved") {
      body.quality_score = qualityScore;
      if (gameName) body.game_name = gameName;
      if (gameLink) body.game_link = gameLink;
      if (thumbnailUrl) body.thumbnail_url = thumbnailUrl;
    }
    if (status === "rejected" && rejectionReason) {
      body.rejection_reason = rejectionReason;
    }
    await adminApi("review-script", body);
    toast.success(status === "approved" ? "Script aprovado!" : "Script rejeitado.");
    qc.invalidateQueries({ queryKey: ["admin-scripts-pending"] });
  }

  return (
    <Card className="border-white/10 bg-card/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3 hover:bg-white/5 transition-colors"
      >
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-accent/20 grid place-items-center shrink-0">
          <Upload className="h-5 w-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{script.title}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span>{script.profile?.username ?? "Desconhecido"}</span>
            <span>·</span>
            <span className={script.status === "rejected" ? "text-red-400" : "text-yellow-400"}>
              {script.status}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3" />
          {script.quality_score ?? "?"}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10 pt-3 space-y-3">
          <div className="text-sm">
            <p className="text-muted-foreground text-xs mb-1">Descrição:</p>
            <p className="text-sm">{script.description || "Sem descrição"}</p>
          </div>

          {script.code && (
            <div>
              <p className="text-muted-foreground text-xs mb-1">Código:</p>
              <pre className="text-xs bg-black/30 rounded-lg p-3 max-h-40 overflow-y-auto font-mono border border-white/5">
                {script.code.length > 500 ? script.code.slice(0, 500) + "..." : script.code}
              </pre>
            </div>
          )}

          {script.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {script.tags.map((t: string) => (
                <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                  {t}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Nome do Jogo</Label>
              <Input value={gameName} onChange={(e) => setGameName(e.target.value)} placeholder="Ex: Brookhaven" className="h-9 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Link do Jogo</Label>
              <Input value={gameLink} onChange={(e) => setGameLink(e.target.value)} placeholder="https://roblox.com/games/..." className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Imagem (URL ou upload)</Label>
              <div className="flex gap-1">
                <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} placeholder="https://..." className="h-9 text-sm flex-1" />
                <label className={`h-9 px-2 rounded-md border border-white/10 flex items-center cursor-pointer hover:bg-white/5 text-xs text-muted-foreground ${uploadingImg ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="h-3.5 w-3.5" />
                  <input type="file" accept="image/*" className="hidden" onChange={uploadThumbnail} disabled={uploadingImg} />
                </label>
              </div>
            </div>
          </div>

          {thumbnailUrl && (
            <div className="rounded-lg overflow-hidden border border-white/10 max-h-32 max-w-xs">
              <img src={thumbnailUrl} alt="Preview" className="w-full object-cover" referrerPolicy="no-referrer" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            </div>
          )}

          <div>
            <Label className="text-xs">
              Score de Qualidade: <span className="text-yellow-400 font-bold">{qualityScore}</span>
            </Label>
            <input type="range" min="0" max="100" value={qualityScore} onChange={(e) => setQualityScore(Number(e.target.value))} className="w-full mt-1 accent-primary" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0</span>
              <span className="text-yellow-400 font-medium">{qualityScore}%</span>
              <span>100</span>
            </div>
          </div>

          <div>
            <Label className="text-xs">Motivo da rejeição (se for rejeitar)</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} placeholder="Ex: Código quebrado, script duplicado..." className="text-sm" />
          </div>

          <div className="flex gap-2 pt-1">
            <Button size="sm" className="gap-1.5 bg-green-600 hover:bg-green-700" onClick={() => handleAction("approved")}>
              <ThumbsUp className="h-4 w-4" /> Aprovar
            </Button>
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => handleAction("rejected")}>
              <ThumbsDown className="h-4 w-4" /> Rejeitar
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={() => {
              const el = document.getElementById(`edit-script-${script.id}`);
              if (el) (el as HTMLDialogElement).showModal();
            }}>
              <Edit className="h-4 w-4" /> Editar
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-red-400 border-red-400/30 hover:bg-red-500/10" onClick={async () => {
              if (!confirm("Tem certeza que deseja excluir este script permanentemente?")) return;
              await adminApi("delete-script", { id: script.id });
              toast.success("Script excluído.");
              qc.invalidateQueries({ queryKey: ["admin-scripts-pending"] });
            }}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          </div>
        </div>
      )}

      <EditScriptDialog script={script} qc={qc} />
    </Card>
  );
}

function EditScriptDialog({ script, qc }: { script: any; qc: ReturnType<typeof useQueryClient> }) {
  const [title, setTitle] = useState(script.title ?? "");
  const [description, setDescription] = useState(script.description ?? "");
  const [code, setCode] = useState(script.code ?? "");
  const [gameName, setGameName] = useState(script.game_name ?? "");
  const [gameLink, setGameLink] = useState(script.game_link ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(script.thumbnail_url ?? "");
  const [qualityScore, setQualityScore] = useState(script.quality_score ?? 50);
  const [isPremium, setIsPremium] = useState(script.is_premium ?? false);
  const [isFeatured, setIsFeatured] = useState(script.is_featured ?? false);
  const [isVerified, setIsVerified] = useState(script.is_verified ?? false);
  const [tags, setTags] = useState<string[]>(script.tags ?? []);
  const [hasKey, setHasKey] = useState(script.has_key ?? false);
  const [saving, setSaving] = useState(false);

  function toggleTag(tag: string) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await adminApi("update-script", {
        id: script.id, title, description, code,
        game_name: gameName, game_link: gameLink,
        thumbnail_url: thumbnailUrl, quality_score: qualityScore,
        is_premium: isPremium, is_featured: isFeatured, is_verified: isVerified,
        tags, has_key: hasKey,
      });
      toast.success("Script atualizado!");
      qc.invalidateQueries({ queryKey: ["admin-scripts-pending"] });
      qc.invalidateQueries({ queryKey: ["script", script.slug] });
      const el = document.getElementById(`edit-script-${script.id}`);
      if (el) (el as HTMLDialogElement).close();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    }
    setSaving(false);
  }

  return (
    <dialog id={`edit-script-${script.id}`} className="bg-background text-foreground rounded-xl border border-white/10 p-0 backdrop:bg-black/60 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <div className="p-6 space-y-4">
        <h3 className="text-lg font-semibold">Editar Script</h3>
        <div>
          <Label className="text-xs">Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Descrição</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-sm" />
        </div>
        <div>
          <Label className="text-xs">Código</Label>
          <Textarea value={code} onChange={(e) => setCode(e.target.value)} rows={6} className="text-sm font-mono" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Jogo</Label>
            <Input value={gameName} onChange={(e) => setGameName(e.target.value)} className="h-9 text-sm" />
          </div>
          <div>
            <Label className="text-xs">Link do Jogo</Label>
            <Input value={gameLink} onChange={(e) => setGameLink(e.target.value)} className="h-9 text-sm" />
          </div>
        </div>
        <div>
          <Label className="text-xs">URL da Imagem</Label>
          <Input value={thumbnailUrl} onChange={(e) => setThumbnailUrl(e.target.value)} className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs">Qualidade: <span className="text-yellow-400">{qualityScore}</span></Label>
          <input type="range" min="0" max="100" value={qualityScore} onChange={(e) => setQualityScore(Number(e.target.value))} className="w-full accent-primary" />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPremium} onChange={(e) => setIsPremium(e.target.checked)} className="accent-primary" />
            Premium
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} className="accent-primary" />
            Destaque
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} className="accent-primary" />
            Verificado
          </label>
        </div>
        <div>
          <Label className="text-xs">Tags</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {["Sem Key", "Seguro", "Indetectável", "Funciona bem", "Atualizado"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-2 py-1 rounded-full text-[10px] font-medium border transition-all duration-200 ${
                  tags.includes(tag)
                    ? "bg-primary/20 border-primary text-primary border-primary/40"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:border-white/20"
                }`}
              >
                {tags.includes(tag) ? "✓ " : ""}{tag}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasKey} onChange={(e) => setHasKey(e.target.checked)} className="accent-primary" />
          {hasKey ? "🔒 Com Key" : "🔓 Sem Key"}
        </label>
        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
          <Button variant="outline" onClick={() => {
            const el = document.getElementById(`edit-script-${script.id}`);
            if (el) (el as HTMLDialogElement).close();
          }}>
            Cancelar
          </Button>
        </div>
      </div>
    </dialog>
  );
}

// ============ FINANCE ============
function FinanceTab() {
  const { data } = useQuery({
    queryKey: ["admin-finance"],
    refetchInterval: 20000,
    queryFn: async () =>
      adminApi<{
        marketplaceGross: number;
        marketplaceFees: number;
        premiumRevenue: number;
        totalRevenue: number;
        marketplaceOrders: any[];
        premiumOrders: any[];
        withdrawals: any[];
      }>("finance-summary"),
  });

  const cards = [
    ["Receita total", data?.totalRevenue ?? 0],
    ["Taxas marketplace", data?.marketplaceFees ?? 0],
    ["Premium", data?.premiumRevenue ?? 0],
    ["Gross marketplace", data?.marketplaceGross ?? 0],
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <DollarSign className="h-5 w-5" /> Financeiro
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([label, value]) => (
          <Card key={String(label)} className="border-white/10 bg-card/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold mt-1">R$ {Number(value).toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <MiniList
          title="Pedidos marketplace"
          rows={data?.marketplaceOrders ?? []}
          moneyField="amount_cents"
        />
        <MiniList
          title="Pedidos premium"
          rows={data?.premiumOrders ?? []}
          moneyField="amount_brl"
        />
        <MiniList title="Saques" rows={data?.withdrawals ?? []} moneyField="amount_cents" />
      </div>
    </div>
  );
}

function MiniList({ title, rows, moneyField }: { title: string; rows: any[]; moneyField: string }) {
  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-4">
        <h3 className="font-medium mb-3">{title}</h3>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {rows.map((row) => {
            const raw = Number(row[moneyField] ?? 0);
            const value = moneyField.endsWith("_cents") ? raw / 100 : raw;
            return (
              <div key={row.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs">{row.title ?? row.id}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.status ?? row.payment_method ?? "registro"}
                  </p>
                </div>
                <span className="shrink-0">R$ {value.toFixed(2)}</span>
              </div>
            );
          })}
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum registro.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ SMILEY STORE SHOP ============
function ShopTab() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["bux-settings"],
    queryFn: async () => {
      const d = await adminApi<{ settings: any }>("bux-settings-get");
      return d.settings;
    },
  });

  const { data: buxListings } = useQuery({
    queryKey: ["bux-listings"],
    queryFn: async () => {
      const d = await adminApi<{ listings: any[] }>("bux-listings");
      return d.listings;
    },
  });

  const [bannerUrl, setBannerUrl] = useState(settings?.banner_url ?? "");
  const [logoUrl, setLogoUrl] = useState(settings?.logo_url ?? "");
  const [promoTitle, setPromoTitle] = useState(settings?.promo_title ?? "");
  const [promoDesc, setPromoDesc] = useState(settings?.promo_description ?? "");
  const [promoActive, setPromoActive] = useState(settings?.promo_active ?? false);

  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCover, setNewCover] = useState("");

  useEffect(() => {
    if (settings) {
      setBannerUrl(settings.banner_url ?? "");
      setLogoUrl(settings.logo_url ?? "");
      setPromoTitle(settings.promo_title ?? "");
      setPromoDesc(settings.promo_description ?? "");
      setPromoActive(settings.promo_active ?? false);
    }
  }, [settings]);

  async function saveSettings() {
    await adminApi("bux-settings-update", {
      banner_url: bannerUrl || null,
      logo_url: logoUrl || null,
      promo_title: promoTitle || null,
      promo_description: promoDesc || null,
      promo_active: promoActive,
    });
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["bux-settings"] });
  }

  async function createProduct() {
    if (!newTitle || !newDesc || !newPrice) {
      toast.error("Preencha título, descrição e preço");
      return;
    }
    const priceCents = Math.round((parseFloat(newPrice.replace(",", ".")) || 0) * 100);
    if (priceCents <= 0) { toast.error("Preço inválido"); return; }
    await adminApi("bux-listing-create", {
      title: newTitle,
      description: newDesc,
      price_cents: priceCents,
      cover_image_url: newCover || null,
    });
    toast.success("Produto criado!");
    setShowNewForm(false);
    setNewTitle(""); setNewDesc(""); setNewPrice(""); setNewCover("");
    qc.invalidateQueries({ queryKey: ["bux-listings"] });
  }

  async function deleteProduct(id: string) {
    if (!confirm("Excluir produto da Bux Store?")) return;
    await adminApi("bux-listing-delete", { id });
    qc.invalidateQueries({ queryKey: ["bux-listings"] });
    toast.success("Produto excluído");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ShoppingBag className="h-5 w-5" /> Bux Store
      </h2>

      {/* Settings */}
      <Card className="border-white/10 bg-card/50">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-medium flex items-center gap-2">
            <Image className="h-4 w-4" /> Banner e Promoção
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>URL do Banner</Label>
              <Input value={bannerUrl} onChange={(e) => setBannerUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div>
              <Label>URL da Logo</Label>
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          {bannerUrl && (
            <div className="rounded-lg overflow-hidden border border-white/10 max-h-40">
              <img src={bannerUrl} alt="Preview banner" className="w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Título da Promoção</Label>
              <Input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} />
            </div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={promoActive} onChange={(e) => setPromoActive(e.target.checked)} id="promo-active" />
                <Label htmlFor="promo-active">Promoção ativa</Label>
              </div>
            </div>
          </div>
          <div>
            <Label>Descrição da Promoção</Label>
            <Textarea value={promoDesc} onChange={(e) => setPromoDesc(e.target.value)} rows={2} />
          </div>
          <Button onClick={saveSettings}>
            <Check className="h-4 w-4" /> Salvar Configurações
          </Button>
        </CardContent>
      </Card>

      {/* Products */}
          <Card className="border-white/10 bg-card/50">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium flex items-center gap-2">
              <Tag className="h-4 w-4" /> Produtos Oficiais
            </h3>
            <Button size="sm" onClick={() => setShowNewForm(!showNewForm)}>
              <Plus className="h-4 w-4" /> Novo Produto
            </Button>
          </div>

          {showNewForm && (
            <div className="space-y-3 p-3 border border-white/10 rounded-lg">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Título *</Label>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </div>
                <div>
                  <Label>Preço (R$) *</Label>
                  <Input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="10,00" />
                </div>
              </div>
              <div>
                <Label>URL da Capa</Label>
                <Input value={newCover} onChange={(e) => setNewCover(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label>Descrição *</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
              </div>
              <Button onClick={createProduct}>
                <Plus className="h-4 w-4" /> Criar Produto
              </Button>
            </div>
          )}

          <div className="space-y-2">
            {(buxListings ?? []).map((item: any) => (
              <Card key={item.id} className="border-white/10 bg-card/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-14 w-14 rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden shrink-0">
                    {item.cover_image_url && (
                      <img src={item.cover_image_url} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      R$ {(Number(item.price_cents ?? 0) / 100).toFixed(2)} · Estoque {item.stock} · {item.status}
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => deleteProduct(item.id)} title="Excluir produto">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            ))}
            {(buxListings ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto na Bux Store ainda.</p>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}

// ============ SETTINGS ============
function SettingsTab() {
  const { data } = useQuery({
    queryKey: ["admin-settings-summary"],
    queryFn: async () =>
      adminApi<{
        premiumPlans: any[];
        pixSettings: any | null;
      }>("settings-summary"),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Shield className="h-5 w-5" /> Configurações
      </h2>
      <Card className="border-white/10 bg-card/50">
        <CardContent className="p-4">
          <h3 className="font-medium mb-3">Planos premium</h3>
          <div className="space-y-2">
            {(data?.premiumPlans ?? []).map((plan) => (
              <div key={plan.id} className="flex items-center justify-between text-sm">
                <span>{plan.name}</span>
                <span className="text-muted-foreground">
                  R$ {Number(plan.price_brl).toFixed(2)} / {plan.duration_days} dias
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="border-white/10 bg-card/50">
        <CardContent className="p-4">
          <h3 className="font-medium">PIX</h3>
          <p className="text-sm text-muted-foreground">
            {data?.pixSettings
              ? `${data.pixSettings.recipient_name} · ${data.pixSettings.pix_key_type}`
              : "Sem configuração PIX encontrada."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ============ TECHNICAL ============
function TechnicalTab() {
  const { data } = useQuery({
    queryKey: ["admin-technical-health"],
    refetchInterval: 15000,
    queryFn: async () =>
      adminApi<{
        status: string;
        checks: { name: string; ok: boolean; error: string | null }[];
        env: Record<string, boolean>;
      }>("technical-health"),
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Activity className="h-5 w-5" /> Saúde técnica
      </h2>
      <Badge variant={data?.status === "ok" ? "default" : "destructive"}>
        {data?.status === "ok" ? "Operacional" : "Degradado"}
      </Badge>
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="border-white/10 bg-card/50">
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Banco/API</h3>
            <div className="space-y-2">
              {(data?.checks ?? []).map((check) => (
                <div key={check.name} className="flex items-center justify-between text-sm">
                  <span>{check.name}</span>
                  <Badge variant={check.ok ? "outline" : "destructive"}>
                    {check.ok ? "ok" : "falha"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-card/50">
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Ambiente</h3>
            <div className="space-y-2">
              {Object.entries(data?.env ?? {}).map(([name, ok]) => (
                <div key={name} className="flex items-center justify-between text-sm">
                  <span>{name}</span>
                  <Badge variant={ok ? "outline" : "destructive"}>
                    {ok ? "configurado" : "faltando"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============ RELATÓRIOS ============
function RelatoriosTab() {
  const [filter, setFilter] = useState<"staff" | "users">("staff");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-staff-stats"],
    queryFn: async () => {
      type StatsPayload = {
        stats: {
          staff: { staff_id: string; ticketsHandled: number; ticketsResolved: number; avgRating: number | null; totalRatings: number }[];
          topUsers: { user_id: string; count: number }[];
          totalTickets: number;
          totalRatings: number;
          avgRatingOverall: number | null;
        };
      };
      const payload = await adminApi<StatsPayload>("staff-stats", {});
      return payload.stats;
    },
    refetchInterval: 30000,
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-staff-profiles"],
    enabled: !!data,
    queryFn: async () => {
      const allIds = [...new Set([
        ...(data?.staff ?? []).map((s) => s.staff_id),
        ...(data?.topUsers ?? []).map((u) => u.user_id),
      ])];
      if (allIds.length === 0) return {};
      const { data: rows } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .in("id", allIds);
      const map: Record<string, { display_name: string | null; username: string | null; avatar_url: string | null }> = {};
      for (const r of rows ?? []) map[r.id] = r;
      return map;
    },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <BarChart3 className="h-5 w-5" /> Relatórios
      </h2>

      <div className="flex gap-2">
        <Button variant={filter === "staff" ? "default" : "outline"} size="sm" onClick={() => setFilter("staff")}>
          Staff
        </Button>
        <Button variant={filter === "users" ? "default" : "outline"} size="sm" onClick={() => setFilter("users")}>
          Usuários
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : filter === "staff" ? (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data?.totalTickets ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Tickets</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data?.totalRatings ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total Avaliações</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-card/50">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{data?.avgRatingOverall ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Média Geral</p>
              </CardContent>
            </Card>
          </div>

          {(data?.staff ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
          ) : (
            <div className="space-y-2">
              {data?.staff.map((s) => {
                const p = profiles?.[s.staff_id];
                return (
                  <Card key={s.staff_id} className="border-white/10 bg-card/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {p?.avatar_url ? (
                          <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs">
                            {p?.display_name?.[0] ?? p?.username?.[0] ?? "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-sm">{p?.display_name ?? p?.username ?? s.staff_id.slice(0, 8)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {s.ticketsHandled} tickets · {s.ticketsResolved} resolvidos
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{s.avgRating !== null ? `${s.avgRating.toFixed(1)} ⭐` : "—"}</p>
                        <p className="text-[10px] text-muted-foreground">{s.totalRatings} avaliações</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-2">Usuários que mais abriram tickets:</p>
          {(data?.topUsers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
          ) : (
            (data?.topUsers ?? []).map((u, i) => {
              const p = profiles?.[u.user_id];
              return (
                <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-card/50">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-7 w-7 rounded-full" />
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs">
                        {p?.display_name?.[0] ?? p?.username?.[0] ?? "?"}
                      </div>
                    )}
                    <span className="text-sm">{p?.display_name ?? p?.username ?? u.user_id.slice(0, 8)}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{u.count} tickets</Badge>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ============ WITHDRAWALS ============
function WithdrawalsTab() {
  const [filter, setFilter] = useState("pending");
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals", filter],
    queryFn: () => adminApi<any>("list-withdrawals", { filter }),
    refetchInterval: 10000,
  });

  async function handleProcess(id: string, action: string) {
    const ok = window.confirm(`Confirmar ${action === "approve" ? "aprovação" : "rejeição"} do saque?`);
    if (!ok) return;
    const res = await adminApi<any>("process-withdrawal", { id, action });
    if (res.error) { toast.error(res.error); return; }
    toast.success(action === "approve" ? "Saque aprovado" : "Saque rejeitado");
    qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
  }

  const withdrawals: any[] = (data as any)?.withdrawals ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["pending", "processing", "completed", "failed", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {f === "pending" ? "Pendentes" : f === "processing" ? "Processando" : f === "completed" ? "Concluídos" : f === "failed" ? "Falhos" : "Todos"}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : withdrawals.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum saque encontrado.</p>
      ) : (
        <div className="space-y-3">
          {withdrawals.map((w: any) => (
            <Card key={w.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">R$ {(w.amount_cents / 100).toFixed(2)}</span>
                      <StatusBadge status={w.status} />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {w.profiles?.display_name ?? w.profiles?.username ?? w.user_id?.slice(0, 8)}
                      {w.status === "pending" && (
                        <span className="ml-2 text-amber-400">PIX: {w.pix_key ?? "—"}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(w.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {w.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" className="h-8" onClick={() => handleProcess(w.id, "approve")}>
                        <Check className="h-3 w-3" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handleProcess(w.id, "reject")}>
                        <X className="h-3 w-3" /> Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ DISPUTES ============
function DisputesTab() {
  const [filter, setFilter] = useState("open");
  const qc = useQueryClient();
  const [resolution, setResolution] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-disputes", filter],
    queryFn: () => adminApi<any>("list-disputes", { filter }),
    refetchInterval: 10000,
  });

  async function handleResolve(id: string) {
    const res = resolution[id] || "release";
    const ok = window.confirm(`Resolver disputa como "${res === "release" ? "liberar pagamento" : "reembolsar comprador"}"?`);
    if (!ok) return;
    const result = await adminApi<any>("resolve-dispute", { id, resolution: res, admin_notes: notes[id] || "" });
    if (result.error) { toast.error(result.error); return; }
    toast.success("Disputa resolvida");
    qc.invalidateQueries({ queryKey: ["admin-disputes"] });
  }

  const disputes: any[] = (data as any)?.disputes ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["open", "under_review", "resolved", "all"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? "bg-primary text-white" : "bg-white/5 hover:bg-white/10"
            }`}
          >
            {f === "open" ? "Abertas" : f === "under_review" ? "Em análise" : f === "resolved" ? "Resolvidas" : "Todas"}
          </button>
        ))}
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : disputes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma disputa encontrada.</p>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: any) => (
            <Card key={d.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">Disputa #{d.id?.slice(0, 8)}</span>
                      <StatusBadge status={d.status} />
                      {d.resolution && (
                        <Badge variant="outline" className="text-[10px]">
                          {d.resolution === "refund" ? "Reembolsado" : "Liberado"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.profiles?.display_name ?? d.profiles?.username ?? d.opened_by?.slice(0, 8)}
                    </p>
                    {d.reason && <p className="text-xs mt-1 text-amber-200">Motivo: {d.reason}</p>}
                    {d.admin_notes && <p className="text-xs mt-1 text-muted-foreground">Notas: {d.admin_notes}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(d.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  {d.status !== "resolved" && (
                    <div className="flex flex-col gap-2 shrink-0 min-w-[140px]">
                      <select
                        value={resolution[d.id] || "release"}
                        onChange={(e) => setResolution((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1"
                      >
                        <option value="release">Liberar vendedor</option>
                        <option value="refund">Reembolsar comprador</option>
                      </select>
                      <input
                        placeholder="Notas do admin..."
                        value={notes[d.id] || ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                        className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1"
                      />
                      <Button size="sm" className="h-7 text-xs" onClick={() => handleResolve(d.id)}>
                        <Check className="h-3 w-3" /> Resolver
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    processing: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    completed: "bg-green-500/20 text-green-300 border-green-500/30",
    failed: "bg-red-500/20 text-red-300 border-red-500/30",
    cancelled: "bg-gray-500/20 text-gray-300 border-gray-500/30",
    open: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    under_review: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    resolved: "bg-green-500/20 text-green-300 border-green-500/30",
    refunded: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    approved: "bg-green-500/20 text-green-300 border-green-500/30",
    rejected: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  const c = colors[status] ?? "bg-white/5 text-muted-foreground border-white/10";

  return (
    <Badge variant="outline" className={`text-[10px] ${c}`}>
      {status}
    </Badge>
  );
}

// ============ EXECUTORES TAB (ADMIN) ============
function ExecutorsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-executors"],
    queryFn: async () => adminApi<{ executors: any[] }>("list-executors"),
  });

  function resetForm(data?: any) {
    setFormData({
      name: data?.name ?? "",
      slug: data?.slug ?? "",
      description: data?.description ?? "",
      long_description: data?.long_description ?? "",
      download_url: data?.download_url ?? "",
      image_url: data?.image_url ?? "",
      price_brl: data?.price_brl ?? 0,
      is_free: data?.is_free ?? true,
      status: data?.status ?? "offline",
      security_status: data?.security_status ?? "undetected",
      safety_level: data?.safety_level ?? "safe",
      detection_status: data?.detection_status ?? "undetected",
      is_recommended: data?.is_recommended ?? false,
      version: data?.version ?? "",
      key_system: data?.key_system ?? false,
      official_site: data?.official_site ?? "",
      discord_url: data?.discord_url ?? "",
      github_url: data?.github_url ?? "",
      tutorial_url: data?.tutorial_url ?? "",
      developer: data?.developer ?? "",
      execution_method: data?.execution_method ?? "",
      requirements: data?.requirements ?? "",
      platform: (data?.platform ?? ["Windows"]).join(", "),
      supported_games: (data?.supported_games ?? []).join(", "),
      features: (data?.features ?? []).join(", "),
      badges: (data?.badges ?? []).join(", "),
      trust_score: data?.trust_score ?? 0,
      downloads_json: data?.downloads_json ?? [],
    });
  }

  function openNew() { resetForm(); setEditing(null); setShowForm(true); }
  function openEdit(e: any) { resetForm(e); setEditing(e); setShowForm(true); }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, any> = {
        ...formData,
        platform: formData.platform ? formData.platform.split(",").map((s: string) => s.trim()).filter(Boolean) : ["Windows"],
        supported_games: formData.supported_games ? formData.supported_games.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        features: formData.features ? formData.features.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
        badges: formData.badges ? formData.badges.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      };
      if (editing) {
        body.id = editing.id;
        await adminApi("update-executor", body);
        toast.success("Executor atualizado!");
      } else {
        await adminApi("create-executor", body);
        toast.success("Executor criado!");
      }
      setShowForm(false);
      setEditing(null);
      refetch();
      qc.invalidateQueries({ queryKey: ["executors"] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza?")) return;
    try {
      await adminApi("delete-executor", { id });
      toast.success("Executor removido");
      refetch();
      qc.invalidateQueries({ queryKey: ["executors"] });
    } catch (err: any) {
      toast.error(err.message ?? "Erro");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Gerenciar Executores</h2>
        <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-4 w-4" /> Novo Executor</Button>
      </div>

      {showForm && (
        <Card className="border-white/10 bg-card/50">
          <CardContent className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Slug</Label>
                <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">URL Download</Label>
                <Input value={formData.download_url} onChange={(e) => setFormData({ ...formData, download_url: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">URL Imagem</Label>
                <Input value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Preço (BRL)</Label>
                <Input type="number" value={formData.price_brl} onChange={(e) => setFormData({ ...formData, price_brl: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Confiança (0-100)</Label>
                <Input type="number" value={formData.trust_score} onChange={(e) => setFormData({ ...formData, trust_score: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Versão</Label>
                <Input value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Desenvolvedor</Label>
                <Input value={formData.developer} onChange={(e) => setFormData({ ...formData, developer: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Método de Execução</Label>
                <Input value={formData.execution_method} onChange={(e) => setFormData({ ...formData, execution_method: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Site Oficial</Label>
                <Input value={formData.official_site} onChange={(e) => setFormData({ ...formData, official_site: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Discord URL</Label>
                <Input value={formData.discord_url} onChange={(e) => setFormData({ ...formData, discord_url: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">GitHub URL</Label>
                <Input value={formData.github_url} onChange={(e) => setFormData({ ...formData, github_url: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Tutorial URL</Label>
                <Input value={formData.tutorial_url} onChange={(e) => setFormData({ ...formData, tutorial_url: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Descrição Curta</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Descrição Longa</Label>
                <Textarea value={formData.long_description} onChange={(e) => setFormData({ ...formData, long_description: e.target.value })} rows={3} />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-xs">Requisitos</Label>
                <Textarea value={formData.requirements} onChange={(e) => setFormData({ ...formData, requirements: e.target.value })} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Plataformas (separadas por vírgula)</Label>
                <Input value={formData.platform} onChange={(e) => setFormData({ ...formData, platform: e.target.value })} placeholder="Windows, Android, iOS, macOS" />
              </div>
              <div>
                <Label className="text-xs">Games Suportados (separados por vírgula)</Label>
                <Input value={formData.supported_games} onChange={(e) => setFormData({ ...formData, supported_games: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Features (separadas por vírgula)</Label>
                <Input value={formData.features} onChange={(e) => setFormData({ ...formData, features: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Badges (separadas por vírgula)</Label>
                <Input value={formData.badges} onChange={(e) => setFormData({ ...formData, badges: e.target.value })} placeholder="Melhor Gratuito, Mais Seguro" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_free} onChange={(e) => setFormData({ ...formData, is_free: e.target.checked })} />
                Grátis
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.key_system} onChange={(e) => setFormData({ ...formData, key_system: e.target.checked })} />
                Sistema de Key
              </label>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_recommended} onChange={(e) => setFormData({ ...formData, is_recommended: e.target.checked })} />
                Recomendado
              </label>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-sm px-2">
                  <option value="online">Online</option>
                  <option value="unstable">Instável</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Nível de Segurança</Label>
                <select value={formData.safety_level} onChange={(e) => setFormData({ ...formData, safety_level: e.target.value })} className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-sm px-2">
                  <option value="safe">Seguro</option>
                  <option value="medium">Médio</option>
                  <option value="risky">Perigoso</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Status de Detecção</Label>
                <select value={formData.detection_status} onChange={(e) => setFormData({ ...formData, detection_status: e.target.value })} className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-sm px-2">
                  <option value="undetected">Não Detectado</option>
                  <option value="partial">Parcial</option>
                  <option value="detected">Detectado</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Destaque</Label>
                <select value={formData.is_featured ? "yes" : "no"} onChange={(e) => setFormData({ ...formData, is_featured: e.target.value === "yes" })} className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-sm px-2">
                  <option value="no">Não</option>
                  <option value="yes">Sim</option>
                </select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Segurança (legado)</Label>
                <select value={formData.security_status} onChange={(e) => setFormData({ ...formData, security_status: e.target.value })} className="w-full h-9 rounded-md bg-white/5 border border-white/10 text-sm px-2">
                  <option value="undetected">Não Detectado</option>
                  <option value="medium_risk">Médio Risco</option>
                  <option value="detected">Detectado</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? "Salvando..." : <Save className="h-4 w-4" />} {editing ? "Atualizar" : "Criar"}
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 rounded-lg bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.executors?.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 grid place-items-center shrink-0 overflow-hidden">
                {e.image_url ? <img src={e.image_url} alt="" className="h-full w-full object-cover" /> : <Cpu className="h-5 w-5 text-primary/60" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{e.name}</span>
                  <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{e.security_status}</Badge>
                  {e.is_featured && <Sparkles className="h-3 w-3 text-yellow-400" />}
                </div>
                <p className="text-xs text-muted-foreground truncate">{e.description ?? "Sem descrição"}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-xs text-muted-foreground">Confiança {e.trust_score}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(e)}><Edit className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-400" onClick={() => handleDelete(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
          {(!data?.executors || data.executors.length === 0) && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum executor cadastrado.</div>
          )}
        </div>
      )}
    </div>
  );
}
