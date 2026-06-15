import { Link, useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Code2,
  Crown,
  Cpu,
  LayoutDashboard,
  LogOut,
  Shield,
  Menu,
  X,
  ShoppingBag,
  MessageCircle,
  HelpCircle,
  Gift,
  Star,
} from "lucide-react";
import { useState } from "react";

export function Header() {
  const { user, isAdmin, isPremium, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: "/scripts", label: "Scripts", icon: Code2 },
    { to: "/executors", label: "Executores", icon: Cpu },
    { to: "/market", label: "Marketplace", icon: ShoppingBag },
    { to: "/community", label: "Comunidade", icon: MessageCircle },
    { to: "/premium", label: "Premium", icon: Crown },
  ];

  return (
    <header className="sticky top-0 z-[9999] bg-background/95 backdrop-blur-sm glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="grid h-12 w-12 place-items-center">
            <img src="/BuxHub.png" alt="BuxHub" className="h-12 w-12 object-contain" />
          </div>
          <span className="text-gradient-brand">BuxHub</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              activeProps={{ className: "text-foreground bg-white/5" }}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              {isPremium && (
                <span className="hidden lg:inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 px-3 py-1 text-xs font-semibold">
                  <Crown className="h-3 w-3 text-primary" /> Premium
                </span>
              )}
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">
                    <Shield className="h-4 w-4" /> Admin
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link to="/dashboard">
                  <LayoutDashboard className="h-4 w-4" /> Painel
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await signOut();
                  router.navigate({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Entrar</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-gradient-to-r from-primary to-accent text-white border-0"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Criar conta
                </Link>
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/10 px-4 py-3 space-y-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/5"
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/5"
              >
                <LayoutDashboard className="h-4 w-4" /> Painel
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/5"
                >
                  <Shield className="h-4 w-4" /> Admin
                </Link>
              )}
              <button
                onClick={async () => {
                  await signOut();
                  setOpen(false);
                  router.navigate({ to: "/" });
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-white/5"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-white/5"
            >
              Entrar / Criar conta
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
