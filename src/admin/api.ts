import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTicketNotification } from "@/lib/email.server";
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
        return listTickets(body);
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
        assertPermission(actor, "shop.bux.manage");
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
      case "submit-rating":
        return submitRating(actor.id, body);
      case "staff-stats":
        assertOwner(actor);
        return staffStats();
      case "lookup-ticket":
        assertPermission(actor, "tickets.read");
        return lookupTicket(body);
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
      case "bux-settings-get":
        assertPermission(actor, "shop.bux.manage");
        return buxSettingsGet();
      case "bux-settings-update":
        assertPermission(actor, "shop.bux.manage");
        return buxSettingsUpdate(actor.id, body);
      case "bux-listings":
        assertPermission(actor, "shop.bux.manage");
        return buxListings();
      case "bux-listing-create":
        assertPermission(actor, "shop.bux.manage");
        return buxListingCreate(actor.id, body);
      case "bux-listing-update":
        assertPermission(actor, "shop.bux.manage");
        return buxListingUpdate(actor.id, body);
      case "bux-listing-delete":
        assertPermission(actor, "shop.bux.manage");
        return buxListingDelete(actor.id, body);
      case "award-points":
        assertPermission(actor, "users.roles");
        return awardPointsAdmin(actor.id, body);
      case "list-options":
        return listOptions(body);
      case "create-option":
        return createOption(actor.id, body);
      case "delete-option":
        return deleteOption(actor.id, body);
      case "update-seller-verification":
        assertPermission(actor, "users.roles");
        return updateSellerVerification(actor.id, body);
      case "list-kyc":
        assertPermission(actor, "users.read");
        return listKYC(body);
      case "kyc-review":
        assertPermission(actor, "users.roles");
        return kycReview(actor.id, body);
      case "kyc-doc-url":
        assertPermission(actor, "users.read");
        return kycDocUrl(body);
      case "list-withdrawals":
        assertNoFinanceForStaff(actor);
        return listWithdrawals(body);
      case "process-withdrawal":
        assertNoFinanceForStaff(actor);
        return processWithdrawal(actor.id, body);
      case "list-disputes":
        assertPermission(actor, "disputes.resolve");
        return listDisputes(body);
      case "resolve-dispute":
        assertPermission(actor, "disputes.resolve");
        return resolveDispute(actor.id, body);
      // ---- Bux Points ----
      case "list-scripts-pending":
        assertPermission(actor, "shop.bux.manage");
        return listScriptsPending();
      case "review-script":
        assertPermission(actor, "shop.bux.manage");
        return reviewScript(actor.id, body);
      case "toggle-featured":
        assertPermission(actor, "shop.bux.manage");
        return toggleFeatured(actor.id, body);
      case "award-points-admin":
        assertPermission(actor, "users.roles");
        return awardPointsAdmin(actor.id, body);
      case "daily-login":
        return dailyLogin(actor.id);
      case "update-script":
        assertPermission(actor, "shop.bux.manage");
        return updateScript(actor.id, body);
      case "delete-script":
        assertPermission(actor, "shop.bux.manage");
        return deleteScript(actor.id, body);
      case "record-view":
        return recordView(body);
      case "like-script":
        return likeScript(actor.id, body);
      case "submit-script":
        return submitScript(actor.id, body);
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

async function listTickets(body: AdminBody) {
  const archived = body.archived === true;
  let query = sba.from("tickets").select("*").order("created_at", { ascending: false }).limit(100);
  if (archived) {
    query = query.not("archived_at", "is", null);
  } else {
    query = query.is("archived_at", null);
  }
  const { data, error } = await query;
  if (error) throw error;
  const tickets = await attachProfiles(data ?? [], "user_id");
  return json({ tickets });
}

async function lookupTicket(body: AdminBody) {
  const query = String(body.query ?? "").trim();
  if (!query) {
    return json({ error: "Provide a user ID or ticket ID" }, { status: 400 });
  }
  // Validate UUID format before querying
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
  if (!isUUID) {
    return json({ tickets: [] });
  }
  const { data, error } = await sba.from("tickets")
    .select("*")
    .or(`id.eq.${query},user_id.eq.${query}`)
    .order("created_at", { ascending: false })
    .limit(50);
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
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (search) {
    const sanitized = search.replace(/[%_,]/g, "");
    query = query.or(`username.ilike.%${sanitized}%,display_name.ilike.%${sanitized}%`);
  }

  const [profilesRes, userRolesRes, staffRes] = await Promise.all([
    query,
    sba.from("user_roles").select("user_id, role"),
    sba.from("staff_members").select("user_id, role, permissions, is_active"),
  ]);
  if (profilesRes.error) throw profilesRes.error;

  let users = profilesRes.data ?? [];

  // Fallback: if profiles table is empty (users registered before trigger),
  // fetch from auth.users directly
  if (users.length === 0 && !search) {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (!authError && authData?.users) {
      users = authData.users.map((u: any) => ({
        id: u.id,
        username: u.raw_user_meta_data?.username ?? u.email?.split("@")[0] ?? "unknown",
        display_name: u.raw_user_meta_data?.display_name ?? u.raw_user_meta_data?.username ?? u.email?.split("@")[0] ?? "Unknown",
        avatar_url: u.raw_user_meta_data?.avatar_url ?? null,
        is_premium: false,
        premium_until: null,
        is_seller: false,
        seller_verified: false,
        suspended_until: null,
        banned_at: null,
        created_at: u.created_at,
      }));
    }
  }

  return json({
    users,
    roles: userRolesRes.data ?? [],
    staff: staffRes.data ?? [],
  });
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

  const attachmentUrl = body.attachment_url ? String(body.attachment_url) : null;
  const { error } = await sba.from("ticket_messages").insert({
    ticket_id: ticketId, sender_id: actorId, body: message,
    attachment_url: attachmentUrl,
  });
  if (error) throw error;
  await sba.from("tickets").update({ status: "in_progress" }).eq("id", ticketId);
  // Auto-assign if not yet assigned
  await sba.from("tickets").update({ assigned_to: actorId }).eq("id", ticketId).is("assigned_to", null);
  await audit(actorId, "ticket.replied", "ticket", ticketId);

  // Send email notification to ticket owner
  const { data: ticket } = await sba.from("tickets").select("user_id, subject").eq("id", ticketId).maybeSingle();
  if (ticket) {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(ticket.user_id);
    const email = userData?.user?.email;
    if (email) {
      const { data: profile } = await sba.from("profiles").select("display_name, username").eq("id", actorId).maybeSingle();
      const actorName = profile?.display_name || profile?.username || "Equipe BuxHub";
      sendTicketNotification({
        toEmail: email,
        ticketId,
        ticketSubject: ticket.subject,
        messageSnippet: message.slice(0, 200),
        actorName,
      }).catch((e) => console.error("[email] send error:", e));
    }
  }

  return json({ ok: true });
}

async function updateTicketStatus(actorId: string, body: AdminBody) {
  const id = String(body.id ?? "");
  const status = String(body.status ?? "");
  if (!["open", "in_progress", "waiting_user", "resolved", "closed"].includes(status)) {
    return json({ error: "invalid status" }, { status: 400 });
  }
  const updates: Record<string, unknown> = { status };
  if (status === "resolved" || status === "closed") {
    updates.archived_at = new Date().toISOString();
  }
  const { error } = await sba.from("tickets").update(updates).eq("id", id);
  if (error) throw error;
  // Auto-assign if not yet assigned
  await sba.from("tickets").update({ assigned_to: actorId }).eq("id", id).is("assigned_to", null);
  await audit(actorId, "ticket.status_changed", "ticket", id, { status });
  return json({ ok: true });
}

async function submitRating(actorId: string, body: AdminBody) {
  const ticketId = String(body.ticket_id ?? "");
  const staffId = String(body.staff_id ?? "");
  const rating = Number(body.rating ?? 0);
  const comment = String(body.comment ?? "").trim();
  if (!ticketId || !staffId || rating < 1 || rating > 5) {
    return json({ error: "ticket_id, staff_id and rating (1-5) required" }, { status: 400 });
  }
  const { error } = await sba.from("ticket_ratings").insert({
    ticket_id: ticketId, staff_id: staffId, user_id: actorId,
    rating, comment: comment || null,
  });
  if (error) throw error;
  await audit(actorId, "ticket.rated", "ticket", ticketId, { staffId, rating });
  return json({ ok: true });
}

async function staffStats() {
  const [ratings, tickets] = await Promise.all([
    sba.from("ticket_ratings").select("staff_id, rating, created_at"),
    sba.from("tickets").select("id, user_id, assigned_to, status, created_at"),
  ]);
  if (ratings.error) throw ratings.error;
  if (tickets.error) throw tickets.error;

  const r = ratings.data ?? [];
  const t = tickets.data ?? [];

  // Per-staff aggregation
  const staffMap: Record<string, { handled: number; ratingSum: number; ratingCount: number; resolved: number }> = {};
  const userTicketCount: Record<string, number> = {};

  for (const ticket of t) {
    if (ticket.assigned_to) {
      if (!staffMap[ticket.assigned_to]) staffMap[ticket.assigned_to] = { handled: 0, ratingSum: 0, ratingCount: 0, resolved: 0 };
      staffMap[ticket.assigned_to].handled++;
      if (ticket.status === "resolved" || ticket.status === "closed") {
        staffMap[ticket.assigned_to].resolved++;
      }
    }
    if (ticket.user_id) {
      userTicketCount[ticket.user_id] = (userTicketCount[ticket.user_id] ?? 0) + 1;
    }
  }
  for (const rate of r) {
    if (!staffMap[rate.staff_id]) staffMap[rate.staff_id] = { handled: 0, ratingSum: 0, ratingCount: 0, resolved: 0 };
    staffMap[rate.staff_id].ratingSum += rate.rating;
    staffMap[rate.staff_id].ratingCount++;
  }

  const staffEntries = Object.entries(staffMap).map(([staff_id, s]) => ({
    staff_id,
    ticketsHandled: s.handled,
    ticketsResolved: s.resolved,
    avgRating: s.ratingCount > 0 ? Number((s.ratingSum / s.ratingCount).toFixed(2)) : null,
    totalRatings: s.ratingCount,
  }));
  staffEntries.sort((a, b) => b.ticketsHandled - a.ticketsHandled);

  const topUsers = Object.entries(userTicketCount)
    .map(([user_id, count]) => ({ user_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const stats = {
    staff: staffEntries,
    topUsers,
    totalTickets: t.length,
    totalRatings: r.length,
    avgRatingOverall: r.length > 0 ? Number((r.reduce((a: number, b: { rating: number }) => a + b.rating, 0) / r.length).toFixed(2)) : null,
  };

  return json({ stats });
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

async function buxSettingsGet() {
  const { data, error } = await sba.from("bux_store_settings").select("*").limit(1).maybeSingle();
  if (error) throw error;
  return json({ settings: data ?? null });
}

async function buxSettingsUpdate(actorId: string, body: AdminBody) {
  const updates: Record<string, unknown> = {};
  if (body.banner_url !== undefined) updates.banner_url = String(body.banner_url);
  if (body.logo_url !== undefined) updates.logo_url = String(body.logo_url);
  if (body.promo_title !== undefined) updates.promo_title = String(body.promo_title);
  if (body.promo_description !== undefined) updates.promo_description = String(body.promo_description);
  if (body.promo_active !== undefined) updates.promo_active = Boolean(body.promo_active);
  updates.updated_by = actorId;
  updates.updated_at = new Date().toISOString();

  const { error } = await sba.from("bux_store_settings").update(updates).eq("id", 1);
  if (error) throw error;
  await audit(actorId, "bux_settings.updated", "bux_store_settings", "1", updates);
  return json({ ok: true });
}

async function buxListings() {
  const { data, error } = await sba
    .from("listings")
    .select("*")
    .eq("is_bux_store", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const listings = await attachProfiles(data ?? [], "seller_id");
  return json({ listings });
}

async function buxListingCreate(actorId: string, body: AdminBody) {
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
    is_bux_store: true,
    cover_image_url: body.cover_image_url ? String(body.cover_image_url) : null,
    delivery_type: "manual",
  }).select("*").single();
  if (error) throw error;
  await audit(actorId, "bux_listing.created", "listing", data.id);
  return json({ listing: data });
}

async function buxListingUpdate(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title);
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.price_cents !== undefined) updates.price_cents = Math.round(Number(body.price_cents));
  if (body.stock !== undefined) updates.stock = Number(body.stock);
  if (body.cover_image_url !== undefined) updates.cover_image_url = String(body.cover_image_url);
  if (body.status !== undefined) updates.status = String(body.status);
  if (body.promo_active !== undefined) updates.promo_active = Boolean(body.promo_active);

  const { error } = await sba.from("listings").update(updates).eq("id", id).eq("is_bux_store", true);
  if (error) throw error;
  await audit(actorId, "bux_listing.updated", "listing", id, updates);
  return json({ ok: true });
}

async function buxListingDelete(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const { error } = await sba.from("listings").delete().eq("id", id).eq("is_bux_store", true);
  if (error) throw error;
  await audit(actorId, "bux_listing.deleted", "listing", id);
  return json({ ok: true });
}

async function awardPoints(actorId: string, body: AdminBody) {
  const userId = requiredString(body.user_id, "user_id");
  const amount = Math.round(Number(body.amount ?? 0));
  const reason = String(body.reason ?? "points");
  const referenceType = body.reference_type ? String(body.reference_type) : null;
  const referenceId = body.reference_id ? String(body.reference_id) : null;
  if (amount === 0) return json({ error: "amount must be non-zero" }, { status: 400 });

  await (supabaseAdmin as any).rpc("award_points", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
  });
  return json({ ok: true });
}

async function listOptions(body: AdminBody) {
  const listingId = requiredString(body.listing_id, "listing_id");
  const { data, error } = await sba
    .from("listing_options")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order");
  if (error) throw error;
  return json({ options: data ?? [] });
}

async function createOption(actorId: string, body: AdminBody) {
  const listingId = requiredString(body.listing_id, "listing_id");
  const label = requiredString(body.label, "label");
  const description = String(body.description ?? "");
  const priceAdjustment = Math.round(Number(body.price_adjustment_cents ?? 0));
  const isDefault = Boolean(body.is_default);
  const sortOrder = Math.round(Number(body.sort_order ?? 0));

  const { data, error } = await sba
    .from("listing_options")
    .insert({
      listing_id: listingId,
      label,
      description: description || null,
      price_adjustment_cents: priceAdjustment,
      is_default: isDefault,
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  if (error) throw error;
  await audit(actorId, "listing_option.created", "listing_option", data.id, { listingId });
  return json({ option: data });
}

async function deleteOption(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const { error } = await sba.from("listing_options").delete().eq("id", id);
  if (error) throw error;
  await audit(actorId, "listing_option.deleted", "listing_option", id);
  return json({ ok: true });
}

async function updateSellerVerification(actorId: string, body: AdminBody) {
  const userId = requiredString(body.user_id, "user_id");
  const status = String(body.status ?? "none");
  if (!["none", "pending", "verified", "rejected"].includes(status)) {
    return json({ error: "invalid status" }, { status: 400 });
  }
  const rejectionReason = body.rejection_reason ? String(body.rejection_reason) : null;
  const updates: Record<string, unknown> = { verification_status: status };
  if (status === "verified") {
    updates.verified = true;
    updates.kyc_status = "approved";
  } else if (status === "rejected") {
    updates.verified = false;
    updates.kyc_status = "rejected";
  } else {
    updates.verified = false;
    updates.kyc_status = status === "none" ? "none" : "pending";
  }
  const { error } = await sba.from("seller_profiles").update(updates).eq("user_id", userId);
  if (error) throw error;
  await audit(actorId, "seller.verification_changed", "seller_profile", userId, { status, rejectionReason });
  return json({ ok: true });
}

async function listKYC(body: AdminBody) {
  const filter = String(body.filter ?? "pending");
  const validFilters = ["none", "pending", "approved", "rejected", "banned", "all"];
  if (!validFilters.includes(filter)) {
    return json({ error: "invalid filter" }, { status: 400 });
  }
  let query = sba.from("seller_verification").select("*").order("created_at", { ascending: false }).limit(100);
  if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query;
  if (error) throw error;
  const verifications = await attachProfiles(data ?? [], "user_id");
  return json({ verifications });
}

async function kycReview(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const status = String(body.status ?? "approved");
  if (!["approved", "rejected", "banned", "pending"].includes(status)) {
    return json({ error: "invalid status" }, { status: 400 });
  }
  const adminNotes = String(body.admin_notes ?? "").trim();
  const updates: Record<string, unknown> = {
    status,
    admin_id: actorId,
    reviewed_at: new Date().toISOString(),
    admin_notes: adminNotes || null,
  };
  if (body.risk_score !== undefined) {
    updates.risk_score = Math.min(Math.max(Math.round(Number(body.risk_score)), 0), 100);
  }
  const { error } = await sba.from("seller_verification").update(updates).eq("id", id);
  if (error) throw error;

  // Also update profiles with trusted status if approving
  if (status === "approved") {
    const { data: sv } = await sba.from("seller_verification").select("user_id").eq("id", id).single();
    if (sv) {
      await sba.from("profiles").update({ is_seller: true, seller_verified: true }).eq("id", sv.user_id);
    }
  }

  await audit(actorId, `kyc.${status}`, "seller_verification", id, { adminNotes });
  return json({ ok: true });
}

async function kycDocUrl(body: AdminBody) {
  const path = requiredString(body.path, "path");
  // Generate a signed URL that expires in 1 hour for secure document viewing
  const { data, error } = await sba.storage
    .from("kyc-docs")
    .createSignedUrl(path, 3600);
  if (error || !data) {
    // Fallback to public URL if signed URL fails
    const publicUrl = sba.storage.from("kyc-docs").getPublicUrl(path).data.publicUrl;
    return json({ url: publicUrl });
  }
  return json({ url: data.signedUrl });
}

async function listWithdrawals(body: AdminBody) {
  const filter = String(body.filter ?? "pending");
  const validFilters = ["pending", "processing", "completed", "failed", "cancelled", "all"];
  if (!validFilters.includes(filter)) {
    return json({ error: "invalid filter" }, { status: 400 });
  }
  let query = sba.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(100);
  if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query;
  if (error) throw error;
  const withdrawals = await attachProfiles(data ?? [], "user_id");
  return json({ withdrawals });
}

async function processWithdrawal(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const action = String(body.action ?? "approve");
  if (!["approve", "reject"].includes(action)) {
    return json({ error: "invalid action, use 'approve' or 'reject'" }, { status: 400 });
  }
  const { data: wd } = await sba.from("withdrawals").select("*").eq("id", id).single();
  if (!wd) return json({ error: "withdrawal not found" }, { status: 404 });
  if (wd.status !== "pending") return json({ error: "withdrawal already processed" }, { status: 400 });
  if (action === "approve") {
    const { error: upErr } = await sba
      .from("withdrawals")
      .update({ status: "completed", processed_at: new Date().toISOString(), processed_by: actorId })
      .eq("id", id);
    if (upErr) throw upErr;
    await audit(actorId, "withdrawal.approved", "withdrawal", id, { amount_cents: wd.amount_cents });
  } else {
    const { error: upErr } = await sba
      .from("withdrawals")
      .update({ status: "failed", processed_at: new Date().toISOString(), processed_by: actorId })
      .eq("id", id);
    if (upErr) throw upErr;
    // Return money to available balance
    await sba.rpc("credit_wallet", { p_user_id: wd.user_id, p_cents: wd.amount_cents });
    await audit(actorId, "withdrawal.rejected", "withdrawal", id, { amount_cents: wd.amount_cents });
  }
  return json({ ok: true });
}

async function listDisputes(body: AdminBody) {
  const filter = String(body.filter ?? "open");
  const validFilters = ["open", "under_review", "resolved", "all"];
  if (!validFilters.includes(filter)) {
    return json({ error: "invalid filter" }, { status: 400 });
  }
  let query = sba.from("disputes").select("*").order("created_at", { ascending: false }).limit(100);
  if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query;
  if (error) throw error;
  const disputes = await attachProfiles(data ?? [], "opened_by");
  return json({ disputes });
}

async function resolveDispute(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const resolution = String(body.resolution ?? "release");
  if (!["release", "refund"].includes(resolution)) {
    return json({ error: "invalid resolution, use 'release' or 'refund'" }, { status: 400 });
  }
  const adminNotes = String(body.admin_notes ?? "").trim();
  const { data: dispute } = await sba.from("disputes").select("*, marketplace_orders!inner(id, status, amount_cents, seller_id, buyer_id)").eq("id", id).single();
  if (!dispute) return json({ error: "dispute not found" }, { status: 404 });
  if (dispute.status === "resolved") return json({ error: "dispute already resolved" }, { status: 400 });
  await sba.from("disputes").update({ status: "resolved", resolution, resolved_by: actorId, resolved_at: new Date().toISOString(), admin_notes: adminNotes || null }).eq("id", id);
  const order = (dispute as any).marketplace_orders;
  if (resolution === "refund") {
    await sba.from("marketplace_orders").update({ status: "refunded" }).eq("id", order.id);
    // Credit buyer back via wallet
    await sba.rpc("credit_wallet", { p_user_id: order.buyer_id, p_cents: order.amount_cents });
  } else {
    await sba.from("marketplace_orders").update({ status: "released" }).eq("id", order.id);
    const { data: tx } = await sba.from("transactions").select("id").eq("marketplace_order_id", order.id).maybeSingle();
    if (tx) {
      const { releaseTransaction } = await import("@/marketplace/payouts");
      await releaseTransaction(tx.id);
    }
  }
  await audit(actorId, `dispute.${resolution}`, "dispute", id, { adminNotes, orderId: order.id });
  return json({ ok: true });
}

// ---- Bux Points Handlers ----

async function listScriptsPending() {
  const { data, error } = await (sba as any)
    .from("scripts")
    .select("*")
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  const scripts = await attachProfiles(data ?? [], "user_id");
  return json({ scripts });
}

async function reviewScript(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const status = String(body.status ?? "approved");
  if (!["approved", "rejected"].includes(status))
    return json({ error: "invalid status" }, { status: 400 });

  const updates: Record<string, unknown> = { status };
  if (body.rejection_reason !== undefined) updates.rejection_reason = String(body.rejection_reason);
  if (body.quality_score !== undefined) updates.quality_score = Math.round(Number(body.quality_score));
  if (body.game_name !== undefined) updates.game_name = String(body.game_name);
  if (body.game_link !== undefined) updates.game_link = String(body.game_link);
  if (body.thumbnail_url !== undefined) updates.thumbnail_url = String(body.thumbnail_url);

  const { error } = await (sba as any).from("scripts").update(updates).eq("id", id);
  if (error) throw error;
  await audit(actorId, `script.${status}`, "script", id, updates);
  return json({ ok: true });
}

async function toggleFeatured(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const featured = Boolean(body.featured);

  const { error } = await (sba as any).from("scripts").update({ is_featured: featured }).eq("id", id);
  if (error) throw error;
  await audit(actorId, featured ? "script.featured" : "script.unfeatured", "script", id);
  return json({ ok: true });
}

async function awardPointsAdmin(actorId: string, body: AdminBody) {
  const userId = requiredString(body.user_id, "user_id");
  const amount = Math.round(Number(body.amount ?? 0));
  const reason = String(body.reason ?? "").trim() || "Ajuste manual";
  if (amount === 0) return json({ error: "amount must be non-zero" }, { status: 400 });

  await sba.rpc("award_points", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: String(body.reference_type ?? "admin"),
    p_reference_id: String(body.reference_id ?? actorId),
  });
  await audit(actorId, "points.awarded", "user", userId, { amount, reason });
  return json({ ok: true });
}

async function dailyLogin(actorId: string) {
  const { data: profile, error: pfErr } = await sba
    .from("profiles")
    .select("daily_login_streak, last_login_reward, is_premium")
    .eq("id", actorId)
    .maybeSingle();
  if (pfErr) throw pfErr;
  if (!profile) return json({ error: "Profile not found" }, { status: 404 });

  // Use Brasília time (UTC-3) for daily reset
  const fmtBrasil = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const now = new Date();
  const lastReward = profile.last_login_reward ? new Date(profile.last_login_reward) : null;
  const lastDate = lastReward ? fmtBrasil(lastReward) : null;
  const todayStr = fmtBrasil(now);

  if (lastDate === todayStr) {
    return json({ error: "Daily login already claimed today" }, { status: 409 });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = fmtBrasil(yesterday);
  let newStreak = lastDate === yesterdayStr ? (profile.daily_login_streak ?? 0) + 1 : 1;
  if (newStreak > 30) newStreak = 30;

  const base = 2;
  const bonus = newStreak >= 30 ? 30 : newStreak >= 7 ? 10 : 0;
  const total = base + bonus;

  await sba.rpc("award_points_capped", {
    p_user_id: actorId,
    p_amount: total,
    p_reason: `Login diário (streak: ${newStreak} dia${newStreak > 1 ? "s" : ""})`,
    p_reference_type: "daily_login",
    p_reference_id: null,
  });

  await sba.from("profiles").update({
    daily_login_streak: newStreak,
    last_login_reward: now.toISOString(),
  }).eq("id", actorId);

  return json({ ok: true, streak: newStreak, reward: total, base, bonus });
}

async function likeScript(actorId: string, body: AdminBody) {
  const scriptId = requiredString(body.script_id, "script_id");

  const { data: script } = await (sba as any).from("scripts").select("likes_count, liked_by, user_id").eq("id", scriptId).maybeSingle();
  if (!script) return json({ error: "Script not found" }, { status: 404 });

  const likedBy: string[] = script.liked_by ?? [];
  const alreadyLiked = likedBy.includes(actorId);

  let newCount = script.likes_count ?? 0;
  let updatedLikedBy: string[];

  if (alreadyLiked) {
    // Unlike - remove user from array
    updatedLikedBy = likedBy.filter((id: string) => id !== actorId);
    newCount = Math.max(0, newCount - 1);
  } else {
    // Like - add user to array
    updatedLikedBy = [...likedBy, actorId];
    newCount = newCount + 1;

    // Check milestones for the script author (cap 5 SP/day total from likes)
    if (script.user_id) {
      const { count: todayLikeSp } = await sba.from("point_transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", script.user_id)
        .eq("reference_type", "like")
        .gte("created_at", new Date().toISOString().split("T")[0]);

      if ((todayLikeSp ?? 0) < 5) {
        for (const milestone of [10, 50, 100]) {
          if (newCount >= milestone) {
            const { data: ms } = await sba.from("point_transactions")
              .select("id")
              .eq("user_id", script.user_id)
              .eq("reason", `${milestone} curtidas!`)
              .maybeSingle();
            if (!ms) {
              const reward = milestone === 10 ? 1 : milestone === 50 ? 3 : 5;
              const capRemaining = 5 - (todayLikeSp ?? 0);
              const award = Math.min(reward, capRemaining);
              if (award > 0) {
                await sba.rpc("award_points_capped", {
                  p_user_id: script.user_id,
                  p_amount: award,
                  p_reason: `${milestone} curtidas!`,
                  p_reference_type: "like",
                  p_reference_id: scriptId,
                });
              }
            }
          }
        }
      }
    }
  }

  await (sba as any).from("scripts").update({ likes_count: newCount, liked_by: updatedLikedBy }).eq("id", scriptId);

  return json({ ok: true, likes_count: newCount, liked: !alreadyLiked });
}

async function updateScript(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = String(body.title);
  if (body.description !== undefined) updates.description = String(body.description);
  if (body.code !== undefined) updates.code = String(body.code);
  if (body.game_name !== undefined) updates.game_name = String(body.game_name);
  if (body.game_link !== undefined) updates.game_link = String(body.game_link);
  if (body.thumbnail_url !== undefined) updates.thumbnail_url = String(body.thumbnail_url);
  if (body.quality_score !== undefined) updates.quality_score = Math.round(Number(body.quality_score));
  if (body.status !== undefined) updates.status = String(body.status);
  if (body.is_premium !== undefined) updates.is_premium = Boolean(body.is_premium);
  if (body.is_featured !== undefined) updates.is_featured = Boolean(body.is_featured);
  if (body.is_verified !== undefined) updates.is_verified = Boolean(body.is_verified);
  if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

  const { error } = await (sba as any).from("scripts").update(updates).eq("id", id);
  if (error) throw error;
  await audit(actorId, "script.updated", "script", id, updates);
  return json({ ok: true });
}

async function deleteScript(actorId: string, body: AdminBody) {
  const id = requiredString(body.id, "id");
  const { error } = await (sba as any).from("scripts").delete().eq("id", id);
  if (error) throw error;
  await audit(actorId, "script.deleted", "script", id);
  return json({ ok: true });
}

async function recordView(body: AdminBody) {
  const scriptId = requiredString(body.script_id, "script_id");
  const { data: s } = await (sba as any).from("scripts").select("views").eq("id", scriptId).maybeSingle();
  if (!s) return json({ error: "Script not found" }, { status: 404 });
  const { error } = await (sba as any).from("scripts").update({ views: (s.views ?? 0) + 1 }).eq("id", scriptId);
  if (error) throw error;
  return json({ ok: true });
}

async function submitScript(actorId: string, body: AdminBody) {
  const title = requiredString(body.title, "title");
  const code = requiredString(body.code, "code");
  const description = String(body.description ?? "").trim();
  const gameName = String(body.game_name ?? "");
  const gameLink = String(body.game_link ?? "");
  const supportedExecutors = Array.isArray(body.supported_executors) ? body.supported_executors.map(String) : [];
  const hasKey = Boolean(body.has_key);
  const isObfuscated = Boolean(body.is_obfuscated);
  const categoryId = body.category_id ? String(body.category_id) : null;
  const thumbnailUrl = body.thumbnail_url ? String(body.thumbnail_url) : null;
  const tags = Array.isArray(body.tags) ? body.tags.map(String) : [];

  const scriptsTable = () => (sba as any).from("scripts");

  // Check daily upload limit (max 3 per day for unverified)
  const today = new Date().toISOString().split("T")[0];
  const { count } = await scriptsTable()
    .select("id", { count: "exact", head: true })
    .eq("user_id", actorId)
    .gte("created_at", today);

  const { data: profile } = await sba.from("profiles").select("is_premium").eq("id", actorId).maybeSingle();
  const maxDaily = profile?.is_premium ? 5 : 3;
  if ((count ?? 0) >= maxDaily) {
    return json({ error: `Limite diário de uploads atingido (${maxDaily}/dia)` }, { status: 429 });
  }

  // Check for existing similar scripts (anti-abuse)
  const { data: similar } = await scriptsTable()
    .select("id")
    .eq("user_id", actorId)
    .or(`title.ilike.%${title.replace(/%/g, "")}%`)
    .limit(1);
  if (similar && similar.length > 0) {
    return json({ error: "Você já possui um script com nome similar." }, { status: 409 });
  }

  // Check for duplicate code
  const { data: dupCode } = await scriptsTable()
    .select("id")
    .eq("code", code)
    .eq("user_id", actorId)
    .limit(1);
  if (dupCode && dupCode.length > 0) {
    return json({ error: "Você já enviou este código anteriormente." }, { status: 409 });
  }

  let qualityScore = 0;
  if (description.length > 100) qualityScore += 20;
  if (description.length > 300) qualityScore += 10;
  if (description.length > 500) qualityScore += 10;
  if (gameName) qualityScore += 10;
  if (gameLink) qualityScore += 10;
  if (thumbnailUrl) qualityScore += 15;
  if (supportedExecutors.length > 0) qualityScore += 10;
  if (supportedExecutors.length > 3) qualityScore += 5;
  if (!hasKey) qualityScore += 5;
  if (!isObfuscated) qualityScore += 5;
  if (code.length > 500) qualityScore += 5;
  if (code.length > 2000) qualityScore += 5;
  qualityScore = Math.min(qualityScore, 100);

  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "script";
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const { data: existing } = await scriptsTable().select("id").eq("slug", slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  const imageUrl = thumbnailUrl || `https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=800`;

  const { data, error } = await scriptsTable().insert({
    title, slug, code, description,
    game_name: gameName || null,
    game_link: gameLink || null,
    category_id: categoryId,
    user_id: actorId,
    status: "pending",
    quality_score: qualityScore,
    supported_executors: supportedExecutors.length > 0 ? supportedExecutors : null,
    has_key: hasKey,
    is_obfuscated: isObfuscated,
    thumbnail_url: imageUrl,
    tags: tags.length > 0 ? tags : null,
    views: 0,
    is_premium: false,
    is_verified: false,
  }).select("*").single();

  if (error) throw error;

  await audit(actorId, "script.submitted", "script", data.id, { qualityScore });
  return json({ script: data, estimated_points: qualityScore >= 80 ? 6 : qualityScore >= 50 ? 3 : 1 });
}

function requiredString(value: unknown, field: string) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${field} is required`);
  return text;
}
