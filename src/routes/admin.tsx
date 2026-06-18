/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
      {tab === "approvals" && <ApprovalsTab />}
      {tab === "finance" && <FinanceTab />}
      {tab === "shop" && <ShopTab />}
      {tab === "settings" && <SettingsTab />}
      {tab === "technical" && <TechnicalTab />}
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

  const { data: tickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ["admin-tickets"],
    refetchInterval: 10000,
    queryFn: async () => {
      const data = await adminApi<{ tickets: any[] }>("list-tickets");
      return data.tickets;
    },
  });

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");

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

  async function sendReply() {
    if (!reply.trim() || !selectedTicket) return;
    await adminApi("reply-ticket", { ticket_id: selectedTicket.id, body: reply });
    setReply("");
    qc.invalidateQueries({ queryKey: ["admin-ticket-msgs", selectedTicket.id] });
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
  }

  async function updateStatus(id: string, status: string) {
    await adminApi("update-ticket-status", { id, status });
    qc.invalidateQueries({ queryKey: ["admin-tickets"] });
    toast.success(`Status atualizado para ${status}`);
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
                <div className="flex gap-1">
                  {["open", "in_progress", "resolved", "closed"].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedTicket.id, s)}
                      className={`text-[10px] px-2 py-1 rounded ${
                        selectedTicket.status === s
                          ? "bg-primary/20 text-primary"
                          : "text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      {s === "in_progress" ? "andamento" : s}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(messages ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center">Nenhuma mensagem neste ticket.</p>
              )}
              {(messages ?? []).map((m: any) => (
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
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <Textarea
                rows={1}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Responder..."
                className="resize-none"
              />
              <Button onClick={sendReply}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
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
        return ["shop.products.manage", "shop.smiley.manage"];
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

// ============ LISTING APPROVALS ============
function ApprovalsTab() {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["admin-pending-listings"],
    queryFn: async () => {
      const data = await adminApi<{ listings: any[] }>("list-pending-listings");
      return data.listings;
    },
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
        <Check className="h-5 w-5" /> Aprovação de Anúncios
      </h2>

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
    </div>
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
    queryKey: ["smiley-settings"],
    queryFn: async () => {
      const d = await adminApi<{ settings: any }>("smiley-settings-get");
      return d.settings;
    },
  });

  const { data: smileyListings } = useQuery({
    queryKey: ["smiley-listings"],
    queryFn: async () => {
      const d = await adminApi<{ listings: any[] }>("smiley-listings");
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
    await adminApi("smiley-settings-update", {
      banner_url: bannerUrl || null,
      logo_url: logoUrl || null,
      promo_title: promoTitle || null,
      promo_description: promoDesc || null,
      promo_active: promoActive,
    });
    toast.success("Configurações salvas");
    qc.invalidateQueries({ queryKey: ["smiley-settings"] });
  }

  async function createProduct() {
    if (!newTitle || !newDesc || !newPrice) {
      toast.error("Preencha título, descrição e preço");
      return;
    }
    const priceCents = Math.round((parseFloat(newPrice.replace(",", ".")) || 0) * 100);
    if (priceCents <= 0) { toast.error("Preço inválido"); return; }
    await adminApi("smiley-listing-create", {
      title: newTitle,
      description: newDesc,
      price_cents: priceCents,
      cover_image_url: newCover || null,
    });
    toast.success("Produto criado!");
    setShowNewForm(false);
    setNewTitle(""); setNewDesc(""); setNewPrice(""); setNewCover("");
    qc.invalidateQueries({ queryKey: ["smiley-listings"] });
  }

  async function deleteProduct(id: string) {
    if (!confirm("Excluir produto da Loja Smiley?")) return;
    await adminApi("smiley-listing-delete", { id });
    qc.invalidateQueries({ queryKey: ["smiley-listings"] });
    toast.success("Produto excluído");
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <ShoppingBag className="h-5 w-5" /> Loja Smiley
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
            {(smileyListings ?? []).map((item: any) => (
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
            {(smileyListings ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum produto na Loja Smiley ainda.</p>
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
