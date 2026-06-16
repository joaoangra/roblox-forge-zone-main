import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  assertNoFinanceForStaff,
  assertOwner,
  assertPermission,
  audit,
  getActor,
  json,
  readJson,
} from "./security";

type AdminBody = Record<string, unknown>;

export async function handleAdminApi(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const action = new URL(request.url).pathname.replace("/admin-api/", "");
    const actor = await getActor(request);
    const body = await readJson<AdminBody>(request).catch(() => ({}));

    switch (action) {
      case "log-login":
        await audit(actor.id, "auth.login", "user", actor.id);
        return json({ ok: true });
      case "create-announcement":
        assertPermission(actor, "announcements.create");
        return createAnnouncement(actor.id, body);
      case "toggle-announcement":
        assertPermission(actor, "announcements.edit");
        return toggleAnnouncement(actor.id, body);
      case "delete-announcement":
        assertPermission(actor, "announcements.delete");
        return deleteAnnouncement(actor.id, body);
      case "reply-ticket":
        assertPermission(actor, "tickets.respond");
        return replyTicket(actor.id, body);
      case "update-ticket-status":
        assertPermission(actor, "tickets.resolve");
        return updateTicketStatus(actor.id, body);
      case "add-staff":
        assertOwner(actor);
        return addStaff(actor.id, body);
      case "remove-staff":
        assertOwner(actor);
        return removeStaff(actor.id, body);
      case "toggle-premium":
        assertOwner(actor);
        return togglePremium(actor.id, body);
      case "seller-promote":
        assertOwner(actor);
        return promoteSeller(actor.id, body);
      case "owner-finance-summary":
        assertNoFinanceForStaff(actor);
        return ownerFinanceSummary();
      default:
        return json({ error: "Unknown admin action" }, { status: 404 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin API error";
    const status = message.includes("Unauthorized") ? 401 : message.includes("required") || message.includes("permission") || message.includes("owner") ? 403 : 400;
    return json({ error: message }, { status });
  }
}

async function createAnnouncement(actorId: string, body: AdminBody) {
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const priority = String(body.priority ?? "normal");
  const type = String(body.type ?? "permanent");
  const expiresAt = body.expires_at ? new Date(String(body.expires_at)).toISOString() : null;
  if (!title || !content) return json({ error: "title and content are required" }, { status: 400 });
  if (!["normal", "important", "critical"].includes(priority)) return json({ error: "invalid priority" }, { status: 400 });
  if (!["permanent", "temporary"].includes(type)) return json({ error: "invalid type" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("site_announcements")
    .insert({ title, content, priority, type, expires_at: type === "temporary" ? expiresAt : null, created_by: actorId })
    .select("*")
    .single();
  if (error) throw error;
  await audit(actorId, "announcement.created", "site_announcement", data.id, { priority, type });
  return json({ announcement: data });
}

async function toggleAnnouncement(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const active = Boolean(body.active);
  const { error } = await supabaseAdmin.from("site_announcements").update({ active }).eq("id", id);
  if (error) throw error;
  await audit(actorId, active ? "announcement.enabled" : "announcement.disabled", "site_announcement", id);
  return json({ ok: true });
}

async function deleteAnnouncement(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const { error } = await supabaseAdmin.from("site_announcements").delete().eq("id", id);
  if (error) throw error;
  await audit(actorId, "announcement.deleted", "site_announcement", id);
  return json({ ok: true });
}

async function replyTicket(actorId: string, body: AdminBody) {
  const ticketId = String(body.ticket_id ?? "");
  const message = String(body.body ?? "").trim();
  if (!ticketId || !message) return json({ error: "ticket_id and body are required" }, { status: 400 });

  const { error } = await supabaseAdmin.from("ticket_messages").insert({
    ticket_id: ticketId,
    sender_id: actorId,
    body: message,
  });
  if (error) throw error;
  await supabaseAdmin.from("tickets").update({ status: "waiting_user" }).eq("id", ticketId);
  await audit(actorId, "ticket.replied", "ticket", ticketId);
  return json({ ok: true });
}

async function updateTicketStatus(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!["open", "in_progress", "waiting_user", "resolved", "closed"].includes(status)) {
    return json({ error: "invalid status" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("tickets").update({ status }).eq("id", id);
  if (error) throw error;
  await audit(actorId, "ticket.status_changed", "ticket", id, { status });
  return json({ ok: true });
}

async function addStaff(actorId: string, body: AdminBody) {
  const userId = String(body.user_id ?? "");
  const role = String(body.role ?? "support");
  const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : defaultPermissions(role);
  if (!userId || !["owner", "moderator", "support", "seller"].includes(role)) {
    return json({ error: "invalid user_id or role" }, { status: 400 });
  }
  if (permissions.some((perm) => perm.startsWith("finance.")) && role !== "owner") {
    return json({ error: "Finance permissions are owner-only" }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("staff_members").upsert({
    user_id: userId,
    role,
    permissions,
    granted_by: actorId,
    revoked_at: null,
    is_active: true,
  });
  if (error) throw error;
  await audit(actorId, "staff.added", "staff_member", userId, { role, permissions });
  return json({ ok: true });
}

async function removeStaff(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const { error } = await supabaseAdmin
    .from("staff_members")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await audit(actorId, "staff.revoked", "staff_member", id);
  return json({ ok: true });
}

async function togglePremium(actorId: string, body: AdminBody) {
  const userId = String(body.user_id ?? "");
  const enabled = Boolean(body.enabled);
  const until = new Date();
  until.setFullYear(until.getFullYear() + 100);
  const premiumUntil = enabled ? until.toISOString() : null;
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_premium: enabled, premium_until: premiumUntil })
    .eq("id", userId);
  if (error) throw error;
  await audit(actorId, enabled ? "user.premium_granted" : "user.premium_revoked", "user", userId);
  return json({ ok: true });
}

async function promoteSeller(actorId: string, body: AdminBody) {
  const userId = String(body.user_id ?? "");
  const trusted = Boolean(body.trusted ?? true);
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ is_seller: trusted, seller_verified: trusted })
    .eq("id", userId);
  if (error) throw error;
  await audit(actorId, trusted ? "seller.promoted" : "seller.demoted", "user", userId);
  return json({ ok: true });
}

async function ownerFinanceSummary() {
  const [orders, premium] = await Promise.all([
    supabaseAdmin.from("marketplace_orders").select("amount_cents, platform_fee_cents").eq("status", "released"),
    supabaseAdmin.from("premium_orders").select("amount_brl").eq("status", "confirmed"),
  ]);
  const marketplaceGross = (orders.data ?? []).reduce((sum, row) => sum + (row.amount_cents ?? 0), 0) / 100;
  const marketplaceFees = (orders.data ?? []).reduce((sum, row) => sum + (row.platform_fee_cents ?? 0), 0) / 100;
  const premiumRevenue = (premium.data ?? []).reduce((sum, row) => sum + Number(row.amount_brl ?? 0), 0);
  return json({ marketplaceGross, marketplaceFees, premiumRevenue, totalRevenue: marketplaceFees + premiumRevenue });
}

function defaultPermissions(role: string): string[] {
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
