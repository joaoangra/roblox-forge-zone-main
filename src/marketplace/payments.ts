import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBaseUrl, getStripe, json, readJson, requireUser } from "@/stripe/stripe";

type PaymentIntentBody = {
  listing_id?: string;
  option_id?: string;
  quantity?: number;
  order_id?: string;
};

export async function handleCreatePaymentIntent(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const { listing_id, option_id, quantity, order_id } = await readJson<PaymentIntentBody>(request);

  if (order_id) {
    const { data: existing } = await supabaseAdmin
      .from("marketplace_orders")
      .select("id, listing_id, amount_cents, seller_amount_cents, platform_fee_cents, seller_id, notes")
      .eq("id", order_id)
      .maybeSingle();
    if (!existing) return json({ error: "Order not found" }, { status: 404 });

    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: existing.amount_cents,
      currency: "brl",
      automatic_payment_methods: { enabled: true },
      metadata: {
        buyer_id: user.id,
        seller_id: existing.seller_id,
        listing_id: existing.listing_id,
        marketplace_order_id: existing.id,
      },
      transfer_group: `marketplace_order_${existing.id}`,
    });

    const { data: tx } = await supabaseAdmin
      .from("transactions")
      .insert({
        marketplace_order_id: existing.id,
        buyer_id: user.id,
        seller_id: existing.seller_id,
        listing_id: existing.listing_id,
        amount_cents: existing.amount_cents,
        seller_amount_cents: existing.seller_amount_cents,
        platform_fee_cents: existing.platform_fee_cents,
        currency: "brl",
        status: "pending",
        release_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        stripe_checkout_session_id: paymentIntent.id,
      })
      .select()
      .single();

    return json({
      clientSecret: paymentIntent.client_secret,
      transactionId: tx?.id ?? null,
      marketplaceOrderId: existing.id,
      amountCents: existing.amount_cents,
      sellerAmountCents: existing.seller_amount_cents,
      platformFeeCents: existing.platform_fee_cents,
    });
  }

  if (!listing_id) {
    return json({ error: "listing_id is required" }, { status: 400 });
  }

  const { createHeldTransaction } = await import("@/marketplace/transactions");
  const transaction = await createHeldTransaction({
    listingId: listing_id,
    buyerId: user.id,
    optionId: option_id,
    quantity: quantity ?? 1,
  });

  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: transaction.amount_cents,
    currency: transaction.currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      transaction_id: transaction.id,
      buyer_id: user.id,
      seller_id: transaction.seller_id,
      listing_id,
      marketplace_order_id: transaction.marketplace_order_id,
    },
    transfer_group: `marketplace_order_${transaction.marketplace_order_id}`,
  });

  await supabaseAdmin
    .from("transactions")
    .update({ stripe_checkout_session_id: paymentIntent.id })
    .eq("id", transaction.id);

  return json({
    clientSecret: paymentIntent.client_secret,
    transactionId: transaction.id,
    marketplaceOrderId: transaction.marketplace_order_id,
    amountCents: transaction.amount_cents,
    sellerAmountCents: transaction.seller_amount_cents,
    platformFeeCents: transaction.platform_fee_cents,
  });
}

export async function handleGetOrderPaymentStatus(request: Request) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);

  const url = new URL(request.url);
  const orderId = url.searchParams.get("order_id");
  if (!orderId) return json({ error: "order_id required" }, { status: 400 });

  const { data: order } = await supabaseAdmin
    .from("marketplace_orders")
    .select("id, buyer_id, status, amount_cents, payment_method, created_at")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.buyer_id !== user.id) {
    return json({ error: "You can only check your own orders" }, { status: 403 });
  }

  const { data: tx } = await supabaseAdmin
    .from("transactions")
    .select("id, stripe_checkout_session_id, stripe_payment_intent_id, status, release_at, created_at")
    .eq("marketplace_order_id", orderId)
    .maybeSingle();

  return json({ order, transaction: tx });
}
