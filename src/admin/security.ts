import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  canUsePermission,
  defaultPermissions,
  isOwnerOnlyPermission,
  ROLE_LEVEL,
  type StaffRole,
} from "./permissions";

export type AdminActor = {
  id: string;
  isAdmin: boolean;
  staffRole: StaffRole | null;
  permissions: string[];
  isOwner: boolean;
  level: number;
};

type QueryResult<T> = Promise<{ data: T | null; error?: unknown }>;
type AdminQuery<T> = {
  select: (columns: string) => AdminQuery<T>;
  eq: (column: string, value: unknown) => AdminQuery<T>;
  maybeSingle: () => QueryResult<T>;
  insert: (value: Record<string, unknown>) => QueryResult<T>;
  then: Promise<{ data: T | null; error?: unknown }>["then"];
};
type AdminDb = {
  from: <T>(table: string) => AdminQuery<T>;
};

type RoleRow = { role: string };
type StaffRow = { role: StaffRole; permissions: string[] | null; is_active: boolean };
type ProfileRoleRow = { is_seller: boolean | null; seller_verified: boolean | null };

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export async function getActor(request: Request): Promise<AdminActor> {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) throw new Error("Unauthorized");

  const token = auth.slice("Bearer ".length);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase public server env");

  const authedClient = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error } = await authedClient.auth.getUser(token);
  if (error || !userData.user) throw new Error("Unauthorized");

  const userId = userData.user.id;
  const sba = supabaseAdmin as unknown as AdminDb;
  const [{ data: roles }, { data: staff }, { data: profileRole }] = await Promise.all([
    sba.from<RoleRow[]>("user_roles").select("role").eq("user_id", userId),
    sba
      .from<StaffRow>("staff_members")
      .select("role, permissions, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    sba
      .from<ProfileRoleRow>("profiles")
      .select("is_seller, seller_verified")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const legacyAdmin = !!roles?.some((role) => role.role === "admin");
  const envOwnerId = process.env.OWNER_USER_ID || process.env.ADMIN_OWNER_USER_ID;
  const isOwnerFromEnv = !!envOwnerId && envOwnerId === userId;
  const staffRole =
    (staff?.role as StaffRole | null) ??
    (legacyAdmin ? "admin" : profileRole?.is_seller ? "seller" : null);
  const isOwner = staffRole === "owner" || isOwnerFromEnv;

  const permissions = isOwner
    ? ["*"]
    : staff?.permissions?.length
      ? staff.permissions.filter((permission: string) => !isOwnerOnlyPermission(permission))
      : defaultPermissions(staffRole ?? "").filter(
          (permission) => !isOwnerOnlyPermission(permission),
        );
  const isAdmin = isOwner || staffRole === "admin" || staffRole === "moderator" || legacyAdmin;
  const level = isOwner ? ROLE_LEVEL.owner : staffRole ? (ROLE_LEVEL[staffRole] ?? 0) : 0;

  return { id: userId, isAdmin, staffRole, permissions, isOwner, level };
}

export function assertOwner(actor: AdminActor) {
  if (!actor.isOwner) throw new Error("Owner access required");
}

export function assertPermission(actor: AdminActor, permission: string) {
  if (
    canUsePermission({
      isOwner: actor.isOwner,
      staffRole: actor.staffRole,
      permissions: actor.permissions,
      permission,
    })
  ) {
    return;
  }
  if (isOwnerOnlyPermission(permission)) throw new Error("Owner access required");
  if (!actor.staffRole) throw new Error("Staff access required");
  throw new Error("Missing permission");
}

export function assertNoFinanceForStaff(actor: AdminActor) {
  assertOwner(actor);
}

export async function audit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId?: string,
  metadata?: unknown,
) {
  const sba = supabaseAdmin as unknown as AdminDb;
  await sba.from("audit_logs_new").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: metadata ?? {},
  });
}
