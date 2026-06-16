import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ESCROW_DAYS, PLATFORM_FEE_PCT } from "@/lib/marketplace";
import { addDays, getBaseUrl, getStripe, json, readJson, requireUser } from "@/stripe/stripe";
import { releaseTransaction } from "./payouts";

type CreateHeldInput = {
  listingId: string;
  buyerId: string;
};

function releaseWarning(releaseAt: string) {
  const releaseDate = new Date(releaseAt).toLocaleDateString("pt-BR");
  return [
    `Pagamento protegido: o saldo do vendedor fica retido por ${ESCROW_DAYS} dias.`,
    `Se hoje a compra foi confirmada, a liberacao automatica prevista e ${releaseDate}.`,
    "Nunca envie dinheiro, Robux, contas, senhas, cookies ou codigos fora da plataforma.",
    "Mantenha combinados, comprovantes e entrega neste chat. Em qualquer duvida, abra ticket ou denuncie.",
    "O comprador pode liberar antes se receber tudo corretamente. Se abrir disputa, o pagamento trava ate analise do admin.",
  ].join("\n");
}

async function insertSystemMessage(orderId: string, body: string, senderId?: string) {
  const { data: room } = await supabaseAdmin
    .from("marketplace_chat_rooms")
    .select("id, buyer_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!room) return;

  await supabaseAdmin.from("marketplace_chat_messages").insert({
    room_id: room.id,
    sender_id: senderId ?? room.buyer_id,
    body,
    system_message: true,
  });
}

export async function createHeldTransaction({ listingId, buyerId }: CreateHeldInput) {
  const { data: listing, error: listingError } = await supabaseAdmin
    .from("listings")
    .select("id, seller_id, title, price_cents")
    .eq("id", listingId)
    .eq("status", "active")
    .maybeSingle();
  if (listingError) throw listingError;
  if (!listing) throw new Error("Listing not found");
  if (listing.seller_id === buyerId) throw new Error("Buyer cannot buy their own listing");

  const { data: seller } = await supabaseAdmin
    .from("profiles")
    .select("stripe_account_id, seller_verified")
    .eq("id", listing.seller_id)
    .maybeSingle();
  if (!seller?.stripe_account_id || !seller.seller_verified) {
    throw new Error("Seller is not ready to receive Stripe marketplace payments");
  }

  const platformFee = Math.round(listing.price_cents * PLATFORM_FEE_PCT);
  const sellerAmount = listing.price_cents - platformFee;
  const releaseAt = addDays(new Date(), ESCROW_DAYS).toISOString();

  const { data: order, error: orderError } = await supabaseAdmin
    .from("marketplace_orders")
    .insert({
      listing_id: listing.id,
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      amount_cents: listing.price_cents,
      gateway_fee_cents: 0,
      platform_fee_cents: platformFee,
      seller_amount_cents: sellerAmount,
      status: "awaiting_payment",
      payment_method: "stripe",
      auto_release_at: releaseAt,
    })
    .select("id")
    .single();
  if (orderError) throw orderError;

  await supabaseAdmin.from("marketplace_chat_rooms").insert({
    order_id: order.id,
    buyer_id: buyerId,
    seller_id: listing.seller_id,
  });

  await insertSystemMessage(order.id, releaseWarning(releaseAt), buyerId);

  const { data: transaction, error } = await supabaseAdmin
    .from("transactions")
    .insert({
      buyer_id: buyerId,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      marketplace_order_id: order.id,
      amount_cents: listing.price_cents,
      platform_fee_cents: platformFee,
      seller_amount_cents: sellerAmount,
      currency: "brl",
      status: "pending",
      release_at: releaseAt,
    })
    .select("*")
    .single();
  if (error) throw error;

  return {
    ...transaction,
    title: listing.title,
  };
}

type ConnectBody = {
  user_id?: string;
  email?: string;
};

export async function handleCreateSellerAccount(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const { user_id, email } = await readJson<ConnectBody>(request);
  if (user_id && user_id !== user.id) return json({ error: "Unauthorized" }, { status: 403 });

  const stripe = getStripe();
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  const accountId =
    existing?.stripe_account_id ??
    (
      await stripe.accounts.create({
        type: "express",
        email: email ?? user.email ?? undefined,
        metadata: { user_id: user.id },
      })
    ).id;

  await supabaseAdmin
    .from("profiles")
    .update({ stripe_account_id: accountId, is_seller: true, seller_verified: false })
    .eq("id", user.id);

  const baseUrl = getBaseUrl(request);
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${baseUrl}/sell?connect=refresh`,
    return_url: `${baseUrl}/sell?connect=return`,
  });

  return json({ url: link.url, stripe_account_id: accountId });
}

export async function handleSyncSellerAccount(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const { user_id } = await readJson<{ user_id?: string }>(request);
  if (user_id && user_id !== user.id) return json({ error: "Unauthorized" }, { status: 403 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.stripe_account_id) return json({ error: "Seller account not found" }, { status: 404 });

  const account = await getStripe().accounts.retrieve(profile.stripe_account_id);
  const verified = Boolean(account.charges_enabled && account.payouts_enabled);

  await supabaseAdmin
    .from("profiles")
    .update({ seller_verified: verified, is_seller: true })
    .eq("id", user.id);
  await supabaseAdmin
    .from("seller_profiles")
    .upsert({ user_id: user.id, verified, kyc_status: verified ? "approved" : "pending" });

  return json({ seller_verified: verified });
}

export async function handleMarkDelivered(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const user = await requireUser(request);
  const { order_id } = await readJson<{ order_id?: string }>(request);
  if (!order_id) return json({ error: "order_id is required" }, { status: 400 });

  const { data: order } = await supabaseAdmin
    .from("marketplace_orders")
    .select("id, seller_id, status, auto_release_at")
    .eq("id", order_id)
    .maybeSingle();
  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.seller_id !== user.id) return json({ error: "Unauthorized" }, { status: 403 });
  if (order.status !== "paid") return json({ error: "Order must be paid before delivery" }, { status: 409 });

  await supabaseAdmin
    .from("marketplace_orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", order_id);

  await insertSystemMessage(
    order_id,
    `Vendedor marcou como entregue. O saldo continua protegido ate ${
      order.auto_release_at ? new Date(order.auto_release_at).toLocaleDateString("pt-BR") : "a data de liberacao"
    }, salvo liberacao antecipada do comprador ou disputa.`,
    user.id,
  );

  return json({ ok: true });
}

export async function handleReleaseOrder(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const user = await requireUser(request);
  const { order_id } = await readJson<{ order_id?: string }>(request);
  if (!order_id) return json({ error: "order_id is required" }, { status: 400 });

  const { data: transaction } = await supabaseAdmin
    .from("transactions")
    .select("id, buyer_id, status")
    .eq("marketplace_order_id", order_id)
    .maybeSingle();
  if (!transaction) return json({ error: "Transaction not found" }, { status: 404 });
  if (transaction.buyer_id !== user.id) return json({ error: "Unauthorized" }, { status: 403 });
  if (!["held", "delivered"].includes(transaction.status)) {
    return json({ error: "Payment is not releasable" }, { status: 409 });
  }

  const released = await releaseTransaction(transaction.id);
  await insertSystemMessage(order_id, "Comprador confirmou recebimento. Valor liberado para o vendedor.", user.id);
  return json({ transaction: released });
}
