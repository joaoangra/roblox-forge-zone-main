import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/adminApi";
import { PageShell } from "@/components/site/PageShell";
import {
  Shield,
  Ticket,
  Bell,
  FileText,
  Users,
  Settings,
  LogOut,
  LayoutDashboard,
  ShoppingBag,
  Megaphone,
  ChevronDown,
  Check,
  BarChart3,
  UserCheck,
  Wallet,
  Scale,
  Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type TabId =
  | "dashboard"
  | "tickets"
  | "announcements"
  | "users"
  | "logs"
  | "staff"
  | "kyc"
  | "approvals"
  | "withdrawals"
  | "disputes"
  | "finance"
  | "shop"
  | "executores"
  | "settings"
  | "technical"
  | "relatorios";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType; permission?: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "tickets", label: "Tickets", icon: Ticket, permission: "tickets.read" },
  { id: "announcements", label: "Avisos", icon: Megaphone, permission: "announcements.create" },
  { id: "users", label: "Usuários", icon: Users, permission: "users.read" },
  { id: "kyc", label: "KYC", icon: UserCheck, permission: "users.read" },
  { id: "logs", label: "Logs", icon: FileText, permission: "logs.read" },
  { id: "staff", label: "Staff", icon: Shield, permission: "staff.manage" },
  { id: "approvals", label: "Aprovações", icon: Check, permission: "listings.approve" },
  { id: "withdrawals", label: "Saques", icon: Wallet, permission: "finance.read" },
  { id: "disputes", label: "Disputas", icon: Scale, permission: "disputes.resolve" },
  { id: "finance", label: "Financeiro", icon: Users, permission: "finance.read" },
  { id: "shop", label: "Bux Store", icon: ShoppingBag, permission: "shop.bux.manage" },
  { id: "executores", label: "Executores", icon: Cpu, permission: "shop.bux.manage" },
  { id: "settings", label: "Config", icon: Settings, permission: "settings.read" },
  { id: "technical", label: "Técnico", icon: Settings, permission: "technical.read" },
  { id: "relatorios", label: "Relatórios", icon: BarChart3, permission: "relatorios" },
];

export function AdminLayout({ activeTab, onTabChange, children }: Props) {
  const { user, isAdmin, isOwner, isStaff, roleLabel, hasPermission, signOut, loading } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: summary } = useQuery({
    queryKey: ["admin-layout-summary"],
    refetchInterval: 10000,
    enabled: isAdmin || isStaff || isOwner,
    queryFn: async () =>
      adminApi<{
        openTickets: number;
        unreadNotifications: number;
      }>("dashboard-summary"),
  });



  useEffect(() => {
    // Evita redirect “prematuro” enquanto o AuthProvider ainda está carregando.
    if (loading) return;

    if (!user) {
      router.navigate({ to: "/" });
      return;
    }

    if (!isAdmin && !isStaff && !isOwner) {
      router.navigate({ to: "/" });
    }
  }, [loading, user, isAdmin, isStaff, isOwner, router]);


  useEffect(() => {
    const item = NAV_ITEMS.find((nav) => nav.id === activeTab);
    if (!item) return;
    if (item.permission && !isOwner && !hasPermission(item.permission)) onTabChange("dashboard");
    if (item.id === "settings" && !isOwner) onTabChange("dashboard");
  }, [activeTab, hasPermission, isOwner, onTabChange]);

  // Mark notifications as read when the admin panel is opened
  useEffect(() => {
    if (user && (isAdmin || isStaff || isOwner) && (summary?.unreadNotifications ?? 0) > 0) {
      adminApi("mark-notifications-read").catch(() => {});
    }
  }, [user, isAdmin, isStaff, isOwner, summary?.unreadNotifications]);

  if (loading || !user || (!isAdmin && !isStaff && !isOwner)) return null;

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Painel {isOwner ? "do Dono" : "de Controle"}</h1>
              <p className="text-xs text-muted-foreground">
                {isOwner ? "Acesso total ao sistema" : roleLabel}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notifications */}
            <button
              className="relative"
              onClick={() => {
                adminApi("mark-notifications-read").catch(() => {});
                qc.invalidateQueries({ queryKey: ["admin-layout-summary"] });
              }}
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              {(summary?.unreadNotifications ?? 0) > 0 && (
                <span className="absolute -top-1.5 -right-1.5 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {summary?.unreadNotifications}
                </span>
              )}
            </button>
            {/* Open tickets badge */}
            <Badge variant="outline" className="gap-1">
              <Ticket className="h-3 w-3" />
              {summary?.openTickets ?? 0} abertos
            </Badge>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile nav toggle */}
        <button
          className="flex items-center gap-2 text-sm text-muted-foreground mb-4 lg:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`}
          />
          Navegação
        </button>

        <div className="flex gap-6">
          {/* Sidebar */}
          <nav
            className={`${
              mobileOpen ? "flex" : "hidden"
            } lg:flex flex-col gap-1 w-full lg:w-48 shrink-0`}
          >
            {NAV_ITEMS.map((item) => {
              // Se requer permissão e usuário não tem, esconde
              if (item.permission && !isOwner && !hasPermission(item.permission)) return null;
              // settings só owner
              if (item.id === "settings" && !isOwner) return null;

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                    activeTab === item.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-white/5"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {item.id === "tickets" && (summary?.openTickets ?? 0) > 0 && (
                    <span className="ml-auto text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
                      {summary?.openTickets}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </PageShell>
  );
}

// Re-export the TabId type
export type { TabId };
