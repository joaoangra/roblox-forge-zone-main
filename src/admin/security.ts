import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export type AdminActor = {
  id: string;
  isAdmin: boolean;
  staffRole: string | null;
  permissions: string[];
  isOwner: boolean;
};

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
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase public server env");

  const authedClient = createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error } = await authedClient.auth.getUser(token);
  if (error || !userData.user) throw new Error("Unauthorized");

  const userId = userData.user.id;
  const [{ data: roles }, { data: staff }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin
      .from("staff_members")
      .select("role, permissions, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const isAdmin = !!roles?.some((role) => role.role === "admin");
  const staffRole = staff?.role ?? null;
  const permissions = staff?.permissions ?? [];
  const isOwner = isAdmin || staffRole === "owner";

  return { id: userId, isAdmin, staffRole, permissions, isOwner };
}

export function assertOwner(actor: AdminActor) {
  if (!actor.isOwner) throw new Error("Owner access required");
}

export function assertPermission(actor: AdminActor, permission: string) {
  if (actor.isOwner) return;
  if (!actor.permissions.includes(permission)) throw new Error("Missing permission");
}

export function assertNoFinanceForStaff(actor: AdminActor) {
  if (actor.isOwner) return;
  throw new Error("Financial access is owner-only");
}

export async function audit(actorId: string | null, action: string, entityType: string, entityId?: string, metadata?: unknown) {
  await supabaseAdmin.from("audit_logs_new").insert({
    actor_id: actorId,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    metadata: (metadata ?? {}) as never,
  });
}
