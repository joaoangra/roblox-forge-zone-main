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
import {
  defaultPermissions,
  isKnownStaffRole,
  isOwnerOnlyPermission,
  PERMISSIONS,
  ROLE_LEVEL,
} from "./permissions";
import { slugify } from "@/lib/marketplace";

// Use this to bypass strict Supabase types in admin operations
// Admin API uses service_role key and doesn't need strict row types
const sba = supabaseAdmin as any;

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
      case "me":
        return json({ actor });
      case "dashboard-summary":
        assertPermission(actor, "dashboard.read");
        return dashboardSummary(actor);
      case "list-tickets":
        assertPermission(actor, "tickets.read");
        return listTickets();
      case "ticket-messages":
        assertPermission(actor, "tickets.read");
        return ticketMessages(body);
      case "list-announcements":
        assertPermission(actor, "announcements.edit");
        return listAnnouncements();
      case "list-users":
        assertPermission(actor, "users.read");
        return listUsers(body);
      case "update-user-status":
        assertPermission(actor, "users.suspend");
        return updateUserStatus(actor.id, body);
      case "delete-user":
        assertPermission(actor, "users.delete");
        return deleteUser(actor.id, body);
      case "reset-user-password":
        assertPermission(actor, "users.reset_password");
        return resetUserPassword(actor.id, body);
      case "set-user-role":
        assertPermission(actor, "users.roles");
        return setUserRole(actor.id, body);
      case "list-logs":
        assertPermission(actor, "logs.read");
        return listLogs(body);
      case "list-staff":
        assertOwner(actor);
        return listStaff();
      case "list-pending-listings":
        assertPermission(actor, "listings.approve");
        return listPendingListings();
      case "approve-listing":
        assertPermission(actor, "listings.approve");
        return approveListing(actor.id, body);
      case "reject-listing":
        assertPermission(actor, "listings.reject");
        return rejectListing(actor.id, body);
      case "shop-summary":
        assertPermission(actor, "shop.smiley.manage");
        return shopSummary();
      case "settings-summary":
        assertOwner(actor);
        return settingsSummary();
      case "technical-health":
        assertPermission(actor, "technical.read");
        return technicalHealth();
      case "finance-summary":
        assertNoFinanceForStaff(actor);
        return financeSummary();
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
      case "mark-notifications-read":
        assertPermission(actor, "tickets.read");
        return markNotificationsRead();
      case "owner-finance-summary":
        assertNoFinanceForStaff(actor);
        return financeSummary();
      case "smiley-settings-get":
        assertPermission(actor, "shop.smiley.manage");
        return smileySettingsGet();
      case "smiley-settings-update":
        assertPermission(actor, "shop.smiley.manage");
        return smileySettingsUpdate(actor.id, body);
      case "smiley-listings":
        assertPermission(actor, "shop.smiley.manage");
        return smileyListings();
      case "smiley-listing-create":
        assertPermission(actor, "shop.smiley.manage");
        return smileyListingCreate(actor.id, body);
      case "smiley-listing-update":
        assertPermission(actor, "shop.smiley.manage");
        return smileyListingUpdate(actor.id, body);
      case "smiley-listing-delete":
        assertPermission(actor, "shop.smiley.manage");
        return smileyListingDelete(actor.id, body);
      default:
        return json({ error: "Unknown admin action" }, { status: 404 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Admin API error";
    const status = message.includes("Unauthorized")
      ? 401
      : message.includes("required") || message.includes("permission") || message.includes("owner")
        ? 403
        : 400;
    return json({ error: message }, { status });
  }
}

async function dashboardSummary(actor: { isOwner: boolean }) {
  const [users, tickets, listings, notifications, finance] = await Promise.all([
    sba.from("profiles").select("*", { count: "exact", head: true }),
    sba.from("tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    sba.from("listings").select("*", { count: "exact", head: true }),
    sba.from("admin_notifications").select("*", { count: "exact", head: true }).eq("read", false),
    actor.isOwner ? financeSummaryData() : Promise.resolve(null),
  ]);

  return json({
    users: users.count ?? 0,
    openTickets: tickets.count ?? 0,
    listings: listings.count ?? 0,
    unreadNotifications: notifications.count ?? 0,
    finance,
  });
}

async function attachProfiles<T extends Record<string, any>>(
  rows: T[],
  userIdField: string,
  targetField = "profiles",
): Promise<T[]> {
  const userIds = [...new Set(rows.map((r) => r[userIdField]).filter(Boolean))];
  if (userIds.length === 0) return rows;
  const { data: profiles } = await sba
    .from("profiles")
    .select("id, username, display_name")
    .in("id", userIds);
  const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({ ...r, [targetField]: map.get(r[userIdField]) ?? null }));
}

async function listTickets() {
  const { data, error } = await sba.from("tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const tickets = await attachProfiles(data ?? [], "user_id");
  return json({ tickets });
}

async function ticketMessages(body: AdminBody) {
  const ticketId = requiredString(body.ticket_id, "ticket_id");
  const { data, error } = await sba.from("ticket_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at");
  if (error) throw error;
  const messages = await attachProfiles(data ?? [], "sender_id");
  return json({ messages });
}

async function listAnnouncements() {
  const { data, error } = await sba.from("site_announcements")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return json({ announcements: data ?? [] });
}

async function listUsers(body: AdminBody) {
  const search = String(body.search ?? "").trim();
  let query = sba.from("profiles")
    .select("id, username, display_name, is_premium, premium_until, is_seller, seller_verified, suspended_until, banned_at, created_at, avatar_url")
    .order("created_at", { ascending: false })
    .limit(100);

  if (search) {
    const sanitized = search.replace(/[%_,]/g, "");
    query = query.or(`username.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`);
  }

  const [{ data: profiles, error }, { data: userRoles }, { data: staff }] = await Promise.all([
    query,
    sba.from("user_roles").select("user_id, role"),
    sba.from("staff_members").select("user_id, role, permissions, is_active"),
  ]);
  if (error) throw error;

  return json({ users: profiles ?? [], roles: userRoles ?? [], staff: staff ?? [] });
}

async function updateUserStatus(actorId: string, body: AdminBody) {
  const userId = requiredString(body.user_id, "user_id");
  const status = String(body.status ?? "");
  const updates: Record<string, string | null> = {};

  if (status === "active") {
    updates.suspended_until = null;
    updates.banned_at = null;
  } else if (status === "suspended") {
    const until = body.suspended_until
      ? new Date(String(body.suspended_until))
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    updates.suspended_until = until.toISOString();
    updates.banned_at = null;
  } else if (status === "banned") {
    updates.banned_at = new Date().toISOString();
  } else {
    return json({ error: "invalid status" }, { status: 400 });
  }

  const { error } = await sba.from("profiles").update(updates).eq("id", userId);
  if (error) throw error;
  await audit(actorId, `user.${status}`, "user", userId, updates);
  return json({ ok: true });
}

async function deleteUser(actorId: string, body: AdminBody) {
  const userId = requiredString(body.user_id, "user_id");
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) throw error;
  await audit(actorId, "user.deleted", "user", userId);
  return json({ ok: true });
}

async function resetUserPassword(actorId: string, body: AdminBody) {
  const userId = requiredString(body.user_id, "user_id");
  const { data: userData, error: getError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (getError) throw getError;
  const email = userData.user?.email;
  if (!email) return json({ error: "User has no email" }, { status: 400 });

  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) throw error;
  await audit(actorId, "user.password_reset_link_generated", "user", userId);
  return json({ email, actionLink: data.properties?.action_link ?? null });
}

async function setUserRole(actorId: string, body: AdminBody) {
  const userId = requiredString(body.user_id, "user_id");
  const role = String(body.role ?? "");
  const enabled = Boolean(body.enabled ?? true);
  if (!["admin", "user", "seller"].includes(role))
    return json({ error: "invalid role" }, { status: 400 });

  if (enabled) {
    const { error } = await sba.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    if (error) throw error;
  } else {
    const { error } = await sba.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) throw error;
  }
  await audit(actorId, enabled ? "user.role_added" : "user.role_removed", "user", userId, { role });
  return json({ ok: true });
}

async function listLogs(body: AdminBody) {
  const page = Math.max(Number(body.page ?? 0), 0);
  const filter = String(body.filter ?? "").trim();
  let query = sba.from("audit_logs_new")
    .select("*")
    .order("created_at", { ascending: false })
    .range(page * 50, (page + 1) * 50 - 1);
  if (filter) query = query.ilike("action", `%${filter.replace(/[%_]/g, "")}%`);
  const { data, error } = await query;
  if (error) throw error;
  const logs = await attachProfiles(data ?? [], "actor_id");
  return json({ logs });
}

async function listStaff() {
  const { data, error } = await sba.from("staff_members")
    .select("*")
    .order("granted_at", { ascending: false });
  if (error) throw error;
  const staff = await attachProfiles(data ?? [], "user_id");
  return json({ staff, permissions: PERMISSIONS, roleLevel: ROLE_LEVEL });
}

async function listPendingListings() {
  const { data, error } = await sba
    .from("listings")
    .select(
      "id, seller_id, title, slug, price_cents, stock, status, rejection_reason, created_at",
    )
    .in("status", ["pending_review", "rejected"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return json({ listings: data ?? [] });
}

async function approveListing(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const { error } = await sba
    .from("listings")
    .update({
      status: "active",
      rejection_reason: null,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await sba.from("listing_review_history").insert({
    listing_id: id,
    actor_id: actorId,
    status: "active",
    reason: null,
  });
  await audit(actorId, "listing.approved", "listing", id);
  return json({ ok: true });
}

async function rejectListing(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const reason = requiredString(body.reason, "reason");
  const { error } = await sba
    .from("listings")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_by: actorId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
  await sba.from("listing_review_history").insert({
    listing_id: id,
    actor_id: actorId,
    status: "rejected",
    reason,
  });
  await audit(actorId, "listing.rejected", "listing", id, { reason });
  return json({ ok: true });
}

async function createAnnouncement(actorId: string, body: AdminBody) {
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const priority = String(body.priority ?? "normal");
  const type = String(body.type ?? "permanent");
  const expiresAt = body.expires_at ? new Date(String(body.expires_at)).toISOString() : null;
  if (!title || !content) return json({ error: "title and content are required" }, { status: 400 });
  if (!["normal", "important", "critical"].includes(priority))
    return json({ error: "invalid priority" }, { status: 400 });
  if (!["permanent", "temporary"].includes(type))
    return json({ error: "invalid type" }, { status: 400 });

  const { data, error } = await sba.from("site_announcements").insert({
    title, content, priority, type,
    expires_at: type === "temporary" ? expiresAt : null,
    created_by: actorId,
  }).select("*").single();
  if (error) throw error;
  await audit(actorId, "announcement.created", "site_announcement", data.id, { priority, type });
  return json({ announcement: data });
}

async function toggleAnnouncement(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const active = Boolean(body.active);
  const { error } = await sba.from("site_announcements").update({ active }).eq("id", id);
  if (error) throw error;
  await audit(actorId, active ? "announcement.enabled" : "announcement.disabled", "site_announcement", id);
  return json({ ok: true });
}

async function deleteAnnouncement(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const { error } = await sba.from("site_announcements").delete().eq("id", id);
  if (error) throw error;
  await audit(actorId, "announcement.deleted", "site_announcement", id);
  return json({ ok: true });
}

async function replyTicket(actorId: string, body: AdminBody) {
  const ticketId = String(body.ticket_id ?? "");
  const message = String(body.body ?? "").trim();
  if (!ticketId || !message)
    return json({ error: "ticket_id and body are required" }, { status: 400 });

  const { error } = await sba.from("ticket_messages").insert({
    ticket_id: ticketId, sender_id: actorId, body: message,
  });
  if (error) throw error;
  await sba.from("tickets").update({ status: "in_progress" }).eq("id", ticketId);
  await audit(actorId, "ticket.replied", "ticket", ticketId);
  return json({ ok: true });
}

async function updateTicketStatus(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!["open", "in_progress", "resolved", "closed"].includes(status)) {
    return json({ error: "invalid status" }, { status: 400 });
  }
  const { error } = await sba.from("tickets").update({ status }).eq("id", id);
  if (error) throw error;
  await audit(actorId, "ticket.status_changed", "ticket", id, { status });
  return json({ ok: true });
}

async function addStaff(actorId: string, body: AdminBody) {
  const userId = String(body.user_id ?? "");
  const role = String(body.role ?? "helper");
  const permissions = Array.isArray(body.permissions)
    ? body.permissions.map(String)
    : defaultPermissions(role);
  if (!userId || !isKnownStaffRole(role)) {
    return json({ error: "invalid user_id or role" }, { status: 400 });
  }
  if (role === "owner") {
    const { data: owner } = await sba.from("staff_members")
      .select("id, user_id").eq("role", "owner").eq("is_active", true).maybeSingle();
    if (owner && owner.user_id !== userId) {
      return json({ error: "There can only be one active owner" }, { status: 409 });
    }
  }
  if (permissions.some(isOwnerOnlyPermission) && role !== "owner") {
    return json({ error: "Owner-only permissions cannot be granted to this role" }, { status: 403 });
  }

  const { data: existing } = await sba.from("staff_members")
    .select("id").eq("user_id", userId).maybeSingle();
  if (existing) {
    const { error } = await sba.from("staff_members").update({
      role, permissions, granted_by: actorId, revoked_at: null, is_active: true,
    }).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await sba.from("staff_members").insert({
      user_id: userId, role, permissions, granted_by: actorId,
    });
    if (error) throw error;
  }
  await audit(actorId, "staff.added", "staff_member", userId, { role, permissions });
  return json({ ok: true });
}

async function removeStaff(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const { data: staff } = await sba.from("staff_members").select("role").eq("id", id).maybeSingle();
  if (staff?.role === "owner") {
    return json({ error: "Owner cannot be revoked from this action" }, { status: 403 });
  }
  const { error } = await sba.from("staff_members")
    .update({ is_active: false, revoked_at: new Date().toISOString() }).eq("id", id);
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
  const { error } = await sba.from("profiles")
    .update({ is_premium: enabled, premium_until: premiumUntil }).eq("id", userId);
  if (error) throw error;
  await audit(actorId, enabled ? "user.premium_granted" : "user.premium_revoked", "user", userId);
  return json({ ok: true });
}

async function promoteSeller(actorId: string, body: AdminBody) {
  const userId = String(body.user_id ?? "");
  const trusted = Boolean(body.trusted ?? true);
  const { error } = await sba.from("profiles")
    .update({ is_seller: trusted, seller_verified: trusted }).eq("id", userId);
  if (error) throw error;
  await audit(actorId, trusted ? "seller.promoted" : "seller.demoted", "user", userId);
  return json({ ok: true });
}

async function financeSummaryData() {
  const [orders, premium] = await Promise.all([
    sba.from("marketplace_orders").select("amount_cents, platform_fee_cents").eq("status", "released"),
    sba.from("premium_orders").select("amount_brl").eq("status", "confirmed"),
  ]);
  const marketplaceGross = (orders.data ?? []).reduce((sum: number, row: any) => sum + (row.amount_cents ?? 0), 0) / 100;
  const marketplaceFees = (orders.data ?? []).reduce((sum: number, row: any) => sum + (row.platform_fee_cents ?? 0), 0) / 100;
  const premiumRevenue = (premium.data ?? []).reduce((sum: number, row: any) => sum + Number(row.amount_brl ?? 0), 0);
  return { marketplaceGross, marketplaceFees, premiumRevenue, totalRevenue: marketplaceFees + premiumRevenue };
}

async function financeSummary() {
  const [summary, marketplaceOrders, premiumOrders, withdrawals] = await Promise.all([
    financeSummaryData(),
    sba.from("marketplace_orders").select("id, amount_cents, platform_fee_cents, status, payment_method, created_at")
      .order("created_at", { ascending: false }).limit(25),
    sba.from("premium_orders").select("id, user_id, amount_brl, status, created_at, confirmed_at")
      .order("created_at", { ascending: false }).limit(25),
    sba.from("withdrawals").select("id, user_id, amount_cents, status, created_at, processed_at")
      .order("created_at", { ascending: false }).limit(25),
  ]);
  return json({
    ...summary,
    marketplaceOrders: marketplaceOrders.data ?? [],
    premiumOrders: premiumOrders.data ?? [],
    withdrawals: withdrawals.data ?? [],
  });
}

async function shopSummary() {
  const [listings, pending, sellers] = await Promise.all([
    sba.from("listings").select("*", { count: "exact", head: true }),
    sba.from("listings").select("id, title, status, price_cents, created_at")
      .in("status", ["pending_review", "draft"]).order("created_at", { ascending: false }).limit(25),
    sba.from("profiles").select("id, username, display_name, seller_verified, is_seller")
      .eq("is_seller", true).limit(25),
  ]);
  return json({
    totalListings: listings.count ?? 0,
    pendingListings: pending.data ?? [],
    sellers: sellers.data ?? [],
  });
}

async function settingsSummary() {
  const [plans, pix] = await Promise.all([
    sba.from("premium_plans").select("id, name, price_brl, duration_days, is_active, is_featured").order("sort_order"),
    sba.from("pix_settings").select("id, pix_key_type, recipient_name, updated_at").limit(1),
  ]);
  return json({ premiumPlans: plans.data ?? [], pixSettings: pix.data?.[0] ?? null });
}

async function technicalHealth() {
  const checks = await Promise.allSettled([
    sba.from("profiles").select("*", { count: "exact", head: true }),
    sba.from("tickets").select("*", { count: "exact", head: true }),
    sba.from("webhook_events").select("*", { count: "exact", head: true }),
  ]);

  const env = {
    supabaseUrl: Boolean(process.env.SUPABASE_URL),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    stripeSecret: Boolean(process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    appUrl: Boolean(process.env.APP_URL || process.env.PUBLIC_SITE_URL),
    ownerUserId: Boolean(process.env.OWNER_USER_ID || process.env.ADMIN_OWNER_USER_ID),
  };

  return json({
    status: checks.every((check) => check.status === "fulfilled") ? "ok" : "degraded",
    checks: checks.map((check, index) => ({
      name: ["profiles", "tickets", "webhook_events"][index],
      ok: check.status === "fulfilled",
      error: check.status === "rejected" ? String(check.reason) : null,
    })),
    env,
  });
}

async function markNotificationsRead() {
  const { error } = await sba.from("admin_notifications").update({ read: true }).eq("read", false);
  if (error) throw error;
  return json({ ok: true });
}

async function smileySettingsGet() {
  const { data, error } = await sba.from("smiley_store_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return json({ settings: data ?? null });
}

async function smileySettingsUpdate(actorId: string, body: AdminBody) {
  const updates: Record<string, unknown> = {};
  if (body.banner_url !== undefined) updates.banner_url = String(body.banner_url);
  if (body.logo_url !== undefined) updates.logo_url = String(body.logo_url);
  if (body.promo_title !== undefined) updates.promo_title = String(body.promo_title);
  if (body.promo_description !== undefined) updates.promo_description = String(body.promo_description);
  if (body.promo_active !== undefined) updates.promo_active = Boolean(body.promo_active);
  updates.updated_by = actorId;
  updates.updated_at = new Date().toISOString();

  const { error } = await sba.from("smiley_store_settings").update(updates).eq("id", 1);
  if (error) throw error;
  await audit(actorId, "smiley_settings.updated", "smiley_store_settings", "1", updates);
  return json({ ok: true });
}

async function smileyListings() {
  const { data, error } = await sba
    .from("listings")
    .select("*")
    .eq("is_smiley_store", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const listings = await attachProfiles(data ?? [], "seller_id");
  return json({ listings });
}

async function smileyListingCreate(actorId: string, body: AdminBody) {
  const title = requiredString(body.title, "title");
  const description = requiredString(body.description, "description");
  const priceCents = Math.round(Number(body.price_cents ?? 0));
  if (priceCents <= 0) return json({ error: "invalid price" }, { status: 400 });

  const slug = slugify(title);
  const { data, error } = await sba.from("listings").insert({
    seller_id: actorId,
    title,
    slug,
    description,
    price_cents: priceCents,
    stock: Number(body.stock ?? 999),
    unlimited_stock: true,
    status: "active",
    is_smiley_store: true,
    cover_image_url: body.cover_image_url ? String(body.cover_image_url) : null,
    delivery_type: "manual",
  }).select("*").single();
  if (error) throw error;
  await audit(actorId, "smiley_listing.created", "listing", data.id);
  return json({ listing: data });
}

async function smileyListingUpdate(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title);
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.price_cents !== undefined) updates.price_cents = Math.round(Number(body.price_cents));
  if (body.stock !== undefined) updates.stock = Number(body.stock);
  if (body.cover_image_url !== undefined) updates.cover_image_url = String(body.cover_image_url);
  if (body.status !== undefined) updates.status = String(body.status);
  if (body.promo_active !== undefined) updates.promo_active = Boolean(body.promo_active);

  const { error } = await sba.from("listings").update(updates).eq("id", id).eq("is_smiley_store", true);
  if (error) throw error;
  await audit(actorId, "smiley_listing.updated", "listing", id, updates);
  return json({ ok: true });
}

async function smileyListingDelete(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const { error } = await sba.from("listings").delete().eq("id", id).eq("is_smiley_store", true);
  if (error) throw error;
  await audit(actorId, "smiley_listing.deleted", "listing", id);
  return json({ ok: true });
}

function requiredString(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}
