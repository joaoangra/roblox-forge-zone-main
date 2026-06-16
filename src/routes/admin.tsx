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
      {tab === "shop" && <ShopTab />}
      {tab === "settings" && <SettingsTab />}
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
      const [users, tickets] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting_user"]),
      ]);

      const finance = isOwner ? await adminApi<{ totalRevenue: number }>("owner-finance-summary") : null;

      return {
        users: users.count ?? 0,
        openTickets: tickets.count ?? 0,
        revenue: finance?.totalRevenue ?? null,
      };
    },
  });

  const cards = [
    { label: "Usuários", value: metrics?.users ?? 0, icon: Users, color: "from-blue-500/20 to-blue-600/20" },
    { label: "Tickets Abertos", value: metrics?.openTickets ?? 0, icon: Ticket, color: "from-orange-500/20 to-red-500/20" },
    isOwner
      ? { label: "Receita Total", value: `R$ ${(metrics?.revenue ?? 0).toFixed(2)}`, icon: DollarSign, color: "from-purple-500/20 to-violet-500/20" }
      : { label: "Acesso", value: "Limitado", icon: Shield, color: "from-slate-500/20 to-slate-600/20" },
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
                <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${c.color} grid place-items-center`}>
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

  const { data: tickets } = useQuery({
    queryKey: ["admin-tickets"],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase
        .from("tickets")
        .select("*, profiles!tickets_user_id_fkey(username, display_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as any[];
    },
  });

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [reply, setReply] = useState("");

  const { data: messages } = useQuery({
    queryKey: ["admin-ticket-msgs", selectedTicket?.id],
    enabled: !!selectedTicket,
    queryFn: async () => {
      const { data } = await supabase
        .from("ticket_messages")
        .select("*, profiles!ticket_messages_sender_id_fkey(username)")
        .eq("ticket_id", selectedTicket!.id)
        .order("created_at");
      return (data ?? []) as any[];
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
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[t.status] ?? ""}`}>
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
          {(tickets ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground p-4">Nenhum ticket.</p>
          )}
        </div>

        {/* Chat / Detalhes do ticket */}
        {selectedTicket ? (
          <Card className="border-white/10 bg-card/50 flex flex-col h-[70vh]">
            <CardContent className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedTicket.subject}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedTicket.profiles?.username ?? "—"} · Categoria: {selectedTicket.category}
                  </p>
                </div>
                <div className="flex gap-1">
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
                      {s === "in_progress" ? "andamento" : s === "waiting_user" ? "aguardando" : s}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {(messages ?? []).map((m: any) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender_id === user!.id ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      m.sender_id === user!.id
                        ? "bg-primary text-white"
                        : "bg-white/5"
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
              <Button onClick={sendReply}><Send className="h-4 w-4" /></Button>
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
      const { data } = await (supabase as any)
        .from("site_announcements")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
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
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
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
              <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
          )}
          <div>
            <Label>Conteúdo</Label>
            <Textarea rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </div>
          <Button onClick={create}><Plus className="h-4 w-4" /> Criar Aviso</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(announcements ?? []).map((a: any) => (
          <Card key={a.id} className="border-white/10 bg-card/50">
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${priorityColors[a.priority] ?? ""}`}>
                    {a.priority}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.type} · {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <h3 className="font-semibold mt-1">{a.title}</h3>
                <p className="text-sm text-muted-foreground">{a.content}</p>
                {a.expires_at && (
                  <p className="text-xs text-amber-400 mt-1">Expira: {new Date(a.expires_at).toLocaleDateString("pt-BR")}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant={a.active ? "outline" : "default"} onClick={() => toggleActive(a.id, a.active)}>
                  {a.active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
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

  const { data: users } = useQuery({
    queryKey: ["admin-users", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, username, display_name, is_premium, premium_until, created_at, avatar_url")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search) {
        query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
      }
      const { data } = await query;
      return (data ?? []) as any[];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  const adminIds = new Set((roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id));

  async function togglePremium(id: string, current: boolean) {
    await adminApi("toggle-premium", { user_id: id, enabled: !current });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    toast.success(current ? "Premium removido" : "Premium concedido");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Users className="h-5 w-5" /> Usuários
      </h2>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou username..." />
      <div className="space-y-2">
        {(users ?? []).map((p: any) => (
          <Card key={p.id} className="border-white/10 bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {p.display_name ?? p.username ?? "—"}
                  {adminIds.has(p.id) && <Badge className="bg-primary/20 text-primary text-[10px]">ADMIN</Badge>}
                  {p.is_premium && <Badge className="bg-gradient-to-r from-primary to-accent border-0 text-[10px]">PREMIUM</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">@{p.username} · {new Date(p.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => togglePremium(p.id, p.is_premium)}>
                {p.is_premium ? "Remover Premium" : "Dar Premium"}
              </Button>
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
      let query = (supabase as any)
        .from("audit_logs_new")
        .select("*, profiles!audit_logs_new_actor_id_fkey(username, display_name)")
        .order("created_at", { ascending: false })
        .range(page * 50, (page + 1) * 50 - 1);
      if (filter) query = query.ilike("action", `%${filter}%`);
      const { data } = await query;
      return (data ?? []) as any[];
    },
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <FileText className="h-5 w-5" /> Logs do Sistema
      </h2>
      <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar por ação (ex: ticket, login, payment)..." />
      <Card className="border-white/10 bg-card/50">
        <CardContent className="p-4">
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {(logs ?? []).map((log: any) => (
              <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 text-sm">
                <Activity className="h-3 w-3 mt-1 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-xs text-primary">{log.action}</span>
                  <span className="text-muted-foreground"> — {log.entity_type}</span>
                  {log.entity_id && <span className="text-muted-foreground"> #{log.entity_id.slice(0, 8)}</span>}
                  <div className="text-[10px] text-muted-foreground">
                    {log.profiles?.username ?? "sistema"} · {new Date(log.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
              </div>
            ))}
            {(logs ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground p-4 text-center">Nenhum log encontrado.</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
            <Button size="sm" variant="outline" disabled={(logs ?? []).length < 50} onClick={() => setPage(page + 1)}>Próxima</Button>
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
      const { data } = await (supabase as any)
        .from("staff_members")
        .select("*, profiles!staff_members_user_id_fkey(username, display_name)")
        .order("granted_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("support");
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
      case "moderator":
        return ["tickets.read", "tickets.respond", "tickets.resolve", "users.read", "users.warn", "logs.read", "disputes.resolve"];
      case "support":
        return ["tickets.read", "tickets.respond"];
      case "seller":
        return ["shop.products.manage"];
      default:
        return [];
    }
  }

  const roleBadges: Record<string, string> = {
    owner: "bg-amber-500/20 text-amber-400",
    moderator: "bg-blue-500/20 text-blue-400",
    support: "bg-green-500/20 text-green-400",
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
            <Input value={newUserId} onChange={(e) => setNewUserId(e.target.value)} placeholder="UUID do usuário" className="flex-1" />
            <select
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              <option value="support">Suporte</option>
              <option value="moderator">Moderador</option>
              <option value="seller">Vendedor</option>
            </select>
            <Button onClick={addStaff} disabled={adding}><Plus className="h-4 w-4" /> Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {(staff ?? []).map((s: any) => (
          <Card key={s.id} className="border-white/10 bg-card/50">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.profiles?.display_name ?? s.profiles?.username ?? "—"}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${roleBadges[s.role] ?? ""}`}>{s.role}</span>
                  {!s.is_active && <span className="text-xs text-muted-foreground">(inativo)</span>}
                </div>
                <p className="text-xs text-muted-foreground">
                  Permissões: {s.permissions?.length ?? 0} · Desde {new Date(s.granted_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeStaff(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============ SHOP (placeholder) ============
function ShopTab() {
  return (
    <Card className="border-dashed border-white/10 bg-card/50">
      <CardContent className="p-10 text-center text-muted-foreground">
        <ShoppingBag className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <h3 className="font-semibold mb-2">Gerenciamento da Loja</h3>
        <p className="text-sm">Sistema de vendedores e produtos será integrado aqui.</p>
      </CardContent>
    </Card>
  );
}

// ============ SETTINGS (placeholder) ============
function SettingsTab() {
  return (
    <Card className="border-dashed border-white/10 bg-card/50">
      <CardContent className="p-10 text-center text-muted-foreground">
        <Shield className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <h3 className="font-semibold mb-2">Configurações do Site</h3>
        <p className="text-sm">Configurações gerais do sistema serão implementadas aqui.</p>
      </CardContent>
    </Card>
  );
}
