import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, json, readJson, requireUser } from "@/stripe/stripe";
import { releaseTransaction } from "@/marketplace/payouts";

type OpenDisputeBody = {
  transaction_id?: string;
  order_id?: string;
  reason?: string;
};

export async function handleOpenDispute(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const { transaction_id, order_id, reason } = await readJson<OpenDisputeBody>(request);
  if ((!transaction_id && !order_id) || !reason) {
    return json({ error: "transaction_id/order_id and reason are required" }, { status: 400 });
  }

  let query = supabaseAdmin.from("transactions").select("*");
  query = transaction_id ? query.eq("id", transaction_id) : query.eq("marketplace_order_id", order_id!);
  const { data: transaction } = await query.maybeSingle();
  if (!transaction) return json({ error: "Transaction not found" }, { status: 404 });
  if (![transaction.buyer_id, transaction.seller_id].includes(user.id)) {
    return json({ error: "User is not part of this transaction" }, { status: 403 });
  }
  if (!["held", "paid", "pending"].includes(transaction.status)) {
    return json({ error: "Transaction cannot be disputed" }, { status: 409 });
  }

  await supabaseAdmin
    .from("transactions")
    .update({ status: "disputed", disputed_at: new Date().toISOString() })
    .eq("id", transaction.id);

  if (transaction.marketplace_order_id) {
    await supabaseAdmin
      .from("marketplace_orders")
      .update({ status: "disputed" })
      .eq("id", transaction.marketplace_order_id);

    await supabaseAdmin.from("disputes").upsert({
      order_id: transaction.marketplace_order_id,
      opened_by: user.id,
      reason,
      status: "open",
    });
  }

  const { data: ticket, error } = await supabaseAdmin
    .from("tickets")
    .insert({
      user_id: user.id,
      related_order_id: transaction.marketplace_order_id,
      category: "dispute",
      subject: `Disputa da compra ${transaction.marketplace_order_id?.slice(0, 8) ?? transaction.id.slice(0, 8)}`,
      status: "open",
    })
    .select("*")
    .single();
  if (error) throw error;

  await supabaseAdmin.from("ticket_messages").insert({
    ticket_id: ticket.id,
    sender_id: user.id,
    body: reason,
  });

  if (transaction.marketplace_order_id) {
    const { data: room } = await supabaseAdmin
      .from("marketplace_chat_rooms")
      .select("id")
      .eq("order_id", transaction.marketplace_order_id)
      .maybeSingle();
    if (room) {
      await supabaseAdmin.from("marketplace_chat_messages").insert({
        room_id: room.id,
        sender_id: user.id,
        system_message: true,
        body: `Disputa aberta: ${reason}. O pagamento esta travado ate analise do admin.`,
      });
    }
  }

  return json({ ticket });
}

type ResolveDisputeBody = {
  transaction_id?: string;
  admin_id?: string;
  decision?: "refund_buyer" | "release_seller";
  resolution_note?: string;
};

export async function handleResolveDispute(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const admin = await requireUser(request);
  const { transaction_id, admin_id, decision, resolution_note } =
    await readJson<ResolveDisputeBody>(request);
  if (!transaction_id || !decision) {
    return json({ error: "transaction_id and decision are required" }, { status: 400 });
  }
  if (admin_id && admin_id !== admin.id) return json({ error: "Unauthorized" }, { status: 403 });
  if (!(await isAdmin(admin.id))) return json({ error: "Unauthorized" }, { status: 403 });

  if (decision === "refund_buyer") {
    const refunded = await refundTransaction(transaction_id, resolution_note);
    return json({ transaction: refunded });
  }

  await supabaseAdmin.from("transactions").update({ status: "held" }).eq("id", transaction_id);
  const released = await releaseTransaction(transaction_id);
  await punishFalseReporter(transaction_id);
  await closeDisputeTickets(transaction_id, admin.id, resolution_note ?? "Denuncia rejeitada. Valor liberado ao vendedor.");
  return json({ transaction: released });
}

async function refundTransaction(transactionId: string, note?: string) {
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();
  if (!transaction) throw new Error("Transaction not found");

  let refundId: string | null = null;
  if (transaction.stripe_payment_intent_id) {
    const refund = await getStripe().refunds.create({
      payment_intent: transaction.stripe_payment_intent_id,
      metadata: { transaction_id: transaction.id },
    });
    refundId = refund.id;
  }

  const { data: updated, error } = await supabaseAdmin
    .from("transactions")
    .update({ status: "refunded", stripe_refund_id: refundId, refunded_at: new Date().toISOString() })
    .eq("id", transaction.id)
    .select("*")
    .single();
  if (error) throw error;

  if (transaction.marketplace_order_id) {
    await supabaseAdmin
      .from("marketplace_orders")
      .update({ status: "refunded" })
      .eq("id", transaction.marketplace_order_id);
  }

  await closeDisputeTickets(transaction.id, null, note ?? "Golpe confirmado. Reembolso emitido.");
  return updated;
}

async function punishFalseReporter(transactionId: string) {
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("marketplace_order_id")
    .eq("id", transactionId)
    .maybeSingle();
  if (!transaction?.marketplace_order_id) return;

  const { data: ticket } = await supabaseAdmin
    .from("tickets")
    .select("user_id")
    .eq("related_order_id", transaction.marketplace_order_id)
    .eq("category", "dispute")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!ticket?.user_id) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("buyer_strikes")
    .eq("id", ticket.user_id)
    .maybeSingle();
  const strikes = (profile?.buyer_strikes ?? 0) + 1;
  const updates: Record<string, string | number | boolean | null> = { buyer_strikes: strikes };
  if (strikes >= 2) updates.suspended_until = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  if (strikes >= 3) updates.banned_at = new Date().toISOString();

  await supabaseAdmin.from("profiles").update(updates as any).eq("id", ticket.user_id);
}

async function closeDisputeTickets(transactionId: string, adminId: string | null, note: string) {
  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("marketplace_order_id")
    .eq("id", transactionId)
    .maybeSingle();
  if (!transaction?.marketplace_order_id) return;

  const { data: tickets } = await supabaseAdmin
    .from("tickets")
    .select("id, user_id")
    .eq("related_order_id", transaction.marketplace_order_id)
    .eq("category", "dispute")
    .neq("status", "resolved");

  for (const ticket of tickets ?? []) {
    await supabaseAdmin.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: adminId ?? ticket.user_id,
      body: note,
    });
    await supabaseAdmin.from("tickets").update({ status: "resolved" }).eq("id", ticket.id);
  }
}

async function isAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return data?.role === "admin";
}
