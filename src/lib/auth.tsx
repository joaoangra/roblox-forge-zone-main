import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { canUsePermission, defaultPermissions, isOwnerOnlyPermission, type StaffRole, ROLE_LEVEL, OWNER_ONLY_PERMISSIONS } from "./authz";

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  premium_until: string | null;
};

type StaffInfo = {
  role: StaffRole;
  permissions: string[];
  isActive: boolean;
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isPremium: boolean;
  loading: boolean;
  staff: StaffInfo | null;
  isOwner: boolean;
  isStaff: boolean;
  hasPermission: (perm: string) => boolean;
  roleLabel: string;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadExtras(uid: string) {
    // Always query staff_members since it's now properly seeded
    const [profileResult, rolesResult, staffResult] = await Promise.allSettled([
      supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_premium, premium_until")
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase
        .from("staff_members")
        .select("role, permissions, is_active")
        .eq("user_id", uid)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

    try {
      const p = profileResult.status === "fulfilled" ? (profileResult.value as any).data ?? null : null;
      const r = rolesResult.status === "fulfilled" ? (rolesResult.value as any).data ?? null : null;
      const s = staffResult.status === "fulfilled" ? (staffResult.value as any).data ?? null : null;

      if (profileResult.status === "rejected") {
        console.error("[auth] profile load failed", profileResult.reason);
      }
      if (rolesResult.status === "rejected") {
        console.error("[auth] user_roles load failed", rolesResult.reason);
      }
      if (staffResult.status === "rejected") {
        console.error("[auth] staff_members load failed", staffResult.reason);
      }

      setProfile(p as Profile | null);

      const hasLegacyAdmin = !!r?.some((x: { role: string }) => x.role === "admin");
      setIsAdmin(hasLegacyAdmin || s?.role === "owner" || s?.role === "admin" || s?.role === "moderator");

      if (s) {
        setStaff({
          role: s.role as StaffRole,
          permissions: s.permissions ?? [],
          isActive: s.is_active,
        });
      } else if (hasLegacyAdmin) {
        setStaff({
          role: "admin" as StaffRole,
          permissions: defaultPermissions("admin"),
          isActive: true,
        });
      } else {
        setStaff(null);
      }
    } catch (e) {
      console.error("[auth] loadExtras failed", e);
      setStaff(null);
      setIsAdmin(false);
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        setLoading(true);
        setTimeout(() => {
          loadExtras(s.user.id).finally(() => setLoading(false));
        }, 0);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setStaff(null);
        setLoading(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);

      if (s?.user) {
        loadExtras(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const isPremium =
    !!(
      profile?.is_premium &&
      (!profile.premium_until || new Date(profile.premium_until) > new Date())
    ) || isAdmin;

  const isOwner = staff?.role === "owner";
  const isStaff = isAdmin || !!staff;

  const hasPermission = (perm: string): boolean => {
    return canUsePermission({
      isOwner,
      staffRole: staff?.role ?? null,
      permissions: staff?.permissions ?? null,
      permission: perm,
    });
  };

  const roleLabel = isOwner
    ? "Owner"
    : staff?.role === "admin" || isAdmin
      ? "Admin"
      : staff?.role === "moderator"
        ? "Moderador"
        : staff?.role === "staff" || staff?.role === "support"
          ? "Staff"
          : staff?.role === "helper"
            ? "Helper"
            : staff?.role === "official_seller"
              ? "Vendedor Oficial"
              : staff?.role === "seller"
                ? "Vendedor"
                : (staff?.role ?? "Usuário");

  const value: AuthCtx = {
    user,
    session,
    profile,
    isAdmin,
    isPremium,
    loading,
    staff,
    isOwner,
    isStaff,
    hasPermission,
    roleLabel,
    refresh: async () => {
      if (user) await loadExtras(user.id);
    },
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}