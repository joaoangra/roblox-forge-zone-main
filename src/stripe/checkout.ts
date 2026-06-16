import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getBaseUrl, getStripe, json, planFromLookupKey, readJson, requireUser } from "./stripe";

type CheckoutBody = {
  lookup_key?: string;
  user_id?: string;
};

export async function handleCreateCheckoutSession(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const { lookup_key, user_id } = await readJson<CheckoutBody>(request);
  if (!lookup_key) {
    return json({ error: "lookup_key and user_id are required" }, { status: 400 });
  }
  if (user_id && user_id !== user.id) return json({ error: "Unauthorized" }, { status: 403 });

  const plan = planFromLookupKey(lookup_key);
  const stripe = getStripe();
  const prices = await stripe.prices.list({
    lookup_keys: [lookup_key],
    expand: ["data.product"],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) return json({ error: "Stripe price not found" }, { status: 404 });

  const { data: appUser } = await supabaseAdmin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const baseUrl = getBaseUrl(request);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",

    payment_method_types: ["card"],

    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],

    customer: appUser?.stripe_customer_id ?? undefined,

    success_url: `${baseUrl}/premium?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,

    client_reference_id: user.id,

    metadata: {
      user_id: user.id,
      plan,
    },

    subscription_data: {
      metadata: {
        user_id: user.id,
        plan,
      },
    },
  });




  return json({ url: session.url });
}

type MarketplaceCheckoutBody = {
  listing_id?: string;
  buyer_id?: string;
};

export async function handleCreateMarketplaceCheckoutSession(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const user = await requireUser(request);
  const { listing_id, buyer_id } = await readJson<MarketplaceCheckoutBody>(request);
  if (!listing_id) {
    return json({ error: "listing_id is required" }, { status: 400 });
  }
  if (buyer_id && buyer_id !== user.id) return json({ error: "Unauthorized" }, { status: 403 });

  const { createHeldTransaction } = await import("@/marketplace/transactions");
  const transaction = await createHeldTransaction({ listingId: listing_id, buyerId: user.id });
  const stripe = getStripe();
  const baseUrl = getBaseUrl(request);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: transaction.currency,
          unit_amount: transaction.amount_cents,
          product_data: { name: transaction.title },
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      transfer_group: `marketplace_order_${transaction.marketplace_order_id}`,
      metadata: {
        transaction_id: transaction.id,
        buyer_id: user.id,
        seller_id: transaction.seller_id,
      },
    },
    success_url: `${baseUrl}/market/orders/${transaction.marketplace_order_id}?checkout=success`,
    cancel_url: `${baseUrl}/market?checkout=cancelled`,
    metadata: {
      transaction_id: transaction.id,
      buyer_id: user.id,
      seller_id: transaction.seller_id,
      listing_id,
    },
  });

  await supabaseAdmin
    .from("transactions")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", transaction.id);

  return json({ url: session.url });
}
