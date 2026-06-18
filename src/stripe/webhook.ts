import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { addDays, getRequiredEnv, getStripe, json, premiumDays } from "./stripe";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ============================================================
// IDEMPOTÊNCIA - Evita processar o mesmo evento duas vezes
// ============================================================
async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("webhook_events")
    .select("id")
    .eq("id", eventId)
    .maybeSingle();
  return !!data;
}

async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
  await supabaseAdmin.from("webhook_events").insert({
    id: eventId,
    type: eventType,
  });
}

// ============================================================
// HELPERS
// ============================================================
function extractCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function extractSubscriptionId(subscription: string | Stripe.Subscription | null): string | null {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  // Na API 2026-05-27.dahlia, current_period_end está no SubscriptionItem
  return subscription.items?.data?.[0]?.current_period_end ?? null;
}

function logWebhookEvent(eventType: string, eventId: string, extra?: Record<string, unknown>) {
  if (!IS_PRODUCTION) {
    console.log(`[WEBHOOK] ${eventType} | id=${eventId}`, extra ?? "");
  } else {
    console.log(
      JSON.stringify({
        level: "info",
        source: "stripe-webhook",
        eventType,
        eventId,
        ...extra,
      }),
    );
  }
}

function logWebhookError(
  eventType: string,
  eventId: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  console.error(
    JSON.stringify({
      level: "error",
      source: "stripe-webhook",
      eventType,
      eventId,
      error: error instanceof Error ? error.message : String(error),
      ...extra,
    }),
  );
}

const ACTIVE_STATUSES = new Set<Stripe.Subscription.Status>(["active", "trialing"]);

// ============================================================
// MAIN HANDLER
// ============================================================
export async function handleStripeWebhook(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const stripe = getStripe();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing stripe-signature" }, { status: 400 });

  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      getRequiredEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch (error) {
    logWebhookError("signature_verification", "unknown", error);

    return json(
      {
        error: error instanceof Error ? error.message : "Invalid webhook signature",
      },
      { status: 400 },
    );
  }

  // --- Idempotência ---
  if (await isEventProcessed(event.id)) {
    logWebhookEvent(event.type, event.id, { skipped: "already_processed" });
    return json({ received: true, skipped: true });
  }

  logWebhookEvent(event.type, event.id);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        await onCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await onSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.paid": {
        await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      }

      case "invoice.payment_failed": {
        await onInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      }

      default: {
        logWebhookEvent(event.type, event.id, { action: "unhandled" });
      }
    }

    await markEventProcessed(event.id, event.type);
  } catch (error) {
    logWebhookError(event.type, event.id, error);
    return json({ error: "Internal webhook handler error" }, { status: 500 });
  }

  return json({ received: true });
}

// ============================================================
// EVENT HANDLERS
// ============================================================

/**
 * checkout.session.completed
 * - Marketplace: libera transação se pago
 * - Premium: salva customer_id, NÃO ativa premium ainda (aguarda subscription)
 */
async function onCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  logWebhookEvent("checkout.session.completed", session.id, {
    payment_status: session.payment_status,
    mode: session.mode,
  });

  // --- Marketplace flow ---
  const transactionId = session.metadata?.transaction_id;
  if (transactionId && session.payment_status === "paid") {
    await supabaseAdmin
      .from("transactions")
      .update({
        status: "held",
        stripe_payment_intent_id:
          typeof session.payment_intent === "string" ? session.payment_intent : null,
      })
      .eq("id", transactionId);

    const { data: transaction } = await supabaseAdmin
      .from("transactions")
      .select("marketplace_order_id")
      .eq("id", transactionId)
      .maybeSingle();

    if (transaction?.marketplace_order_id) {
      await supabaseAdmin
        .from("marketplace_orders")
        .update({ status: "paid", payment_method: "stripe" })
        .eq("id", transaction.marketplace_order_id);

      const { data: room } = await supabaseAdmin
        .from("marketplace_chat_rooms")
        .select("id, buyer_id")
        .eq("order_id", transaction.marketplace_order_id)
        .maybeSingle();

      if (room) {
        await supabaseAdmin.from("marketplace_chat_messages").insert({
          room_id: room.id,
          sender_id: room.buyer_id,
          system_message: true,
          body: "Pagamento confirmado pelo Stripe. O vendedor ja pode entregar pelo chat. Nao negocie por fora da plataforma.",
        });
      }
    }
  }

  // --- Premium / Subscription flow ---
  const userId = session.metadata?.user_id ?? session.client_reference_id ?? undefined;
  if (!userId || !session.customer) {
    logWebhookEvent("checkout.session.completed", session.id, {
      warning: "missing user_id or customer",
      hasUserId: !!userId,
      hasCustomer: !!session.customer,
    });
    return;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    stripe_customer_id: extractCustomerId(session.customer),
  });

  logWebhookEvent("checkout.session.completed", session.id, {
    userId,
    customerId: extractCustomerId(session.customer),
    action: "customer_id_saved",
  });
}

/**
 * customer.subscription.created / customer.subscription.updated
 * SÓ libera premium se status === "active" ou "trialing"
 */
async function onSubscriptionChanged(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const customerId = extractCustomerId(subscription.customer);
  const subscriptionId = subscription.id;
  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const plan = subscription.metadata?.plan;
  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const status = subscription.status;

  logWebhookEvent(`customer.subscription.${status}`, subscriptionId, {
    userId,
    status,
    plan,
    priceId,
  });

  // Atualiza dados da subscription no banco (sempre, independente do status)
  const profileUpdate: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    subscription_status: status,
    subscription_current_period_end: currentPeriodEnd,
  };

  if (userId) {
    await supabaseAdmin.from("profiles").upsert({ id: userId, ...profileUpdate });
  } else {
    const foundUserId = await findUserIdByCustomer(customerId);
    if (foundUserId) {
      await supabaseAdmin.from("profiles").upsert({ id: foundUserId, ...profileUpdate });
    }
  }

  // SÓ libera premium se status for active ou trialing
  if (status === "active" || status === "trialing") {
    await grantPremium({
      userId: userId ?? undefined,
      customerId: customerId ?? undefined,
      plan: plan ?? undefined,
      subscription,
    });
  } else if (status === "past_due" || status === "incomplete") {
    await revokePremium({
      userId: userId ?? undefined,
      customerId: customerId ?? undefined,
    });
  }
}

/**
 * customer.subscription.deleted
 */
async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.user_id;
  const customerId = extractCustomerId(subscription.customer);

  logWebhookEvent("customer.subscription.deleted", subscription.id, { userId, customerId });

  const resolvedUserId = userId ?? (await findUserIdByCustomer(customerId));
  if (!resolvedUserId) {
    logWebhookEvent("customer.subscription.deleted", subscription.id, {
      warning: "user_not_found",
    });
    return;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: resolvedUserId,
    is_premium: false,
    premium_until: null,
    subscription_status: "canceled",
    stripe_subscription_id: null,
    stripe_price_id: null,
  });

  logWebhookEvent("customer.subscription.deleted", subscription.id, {
    userId: resolvedUserId,
    action: "premium_revoked",
  });
}

/**
 * invoice.paid - Renovação de assinatura bem-sucedida
 */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  const billingReason = invoice.billing_reason;
  if (
    billingReason !== "subscription_cycle" &&
    billingReason !== "subscription_create" &&
    billingReason !== "subscription_update"
  ) {
    return;
  }

  const customerId = extractCustomerId(invoice.customer);

  logWebhookEvent("invoice.paid", invoice.id, {
    billing_reason: billingReason,
    customerId,
  });

  // Busca subscription associada à fatura
  // O campo subscription está em invoice.parent ou podemos buscar diretamente
  const stripe = getStripe();
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId ?? undefined,
    limit: 1,
    status: "all",
  });

  const subscription = subscriptions.data[0];
  if (!subscription) {
    logWebhookEvent("invoice.paid", invoice.id, { warning: "no_subscription_found" });
    return;
  }

  const userId = subscription.metadata?.user_id ?? (await findUserIdByCustomer(customerId));
  if (!userId) {
    logWebhookEvent("invoice.paid", invoice.id, { warning: "user_not_found" });
    return;
  }

  const periodEnd = getSubscriptionPeriodEnd(subscription);
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
    subscription_status: subscription.status,
    subscription_current_period_end: currentPeriodEnd,
  });

  if (subscription.status === "active" || subscription.status === "trialing") {
    const plan = subscription.metadata?.plan;
    await grantPremium({
      userId,
      customerId: customerId ?? undefined,
      plan: plan ?? undefined,
      subscription,
    });
  }
}

/**
 * invoice.payment_failed
 */
async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = extractCustomerId(invoice.customer);

  logWebhookEvent("invoice.payment_failed", invoice.id, {
    customerId,
    attempt_count: invoice.attempt_count,
    next_payment_attempt: invoice.next_payment_attempt,
  });

  const userId = await findUserIdByCustomer(customerId);
  if (!userId) {
    logWebhookEvent("invoice.payment_failed", invoice.id, { warning: "user_not_found" });
    return;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    subscription_status: "past_due",
    is_premium: false,
  });

  logWebhookEvent("invoice.payment_failed", invoice.id, {
    userId,
    action: "marked_past_due",
  });
}

// ============================================================
// PREMIUM MANAGEMENT
// ============================================================

async function grantPremium(input: {
  userId?: string;
  customerId?: string;
  plan?: string;
  subscription?: Stripe.Subscription;
}) {
  const userId = input.userId || (await findUserIdByCustomer(input.customerId));
  if (!userId) {
    logWebhookEvent("grant_premium", "unknown", {
      warning: "user_not_found",
      customerId: input.customerId,
    });
    return;
  }

  const plan = input.plan;
  const subscription = input.subscription;
  const priceId = subscription?.items?.data?.[0]?.price?.id ?? null;
  const subscriptionId = subscription?.id ?? null;
  const periodEnd = subscription ? getSubscriptionPeriodEnd(subscription) : null;
  const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

  let premiumUntil: string;

  if (periodEnd) {
    premiumUntil = currentPeriodEnd!;
  } else {
    // Fallback: calcula baseado nos dias do plano
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("premium_until")
      .eq("id", userId)
      .maybeSingle();

    const currentUntil = existing?.premium_until ? new Date(existing.premium_until) : new Date();
    const startsAt = currentUntil > new Date() ? currentUntil : new Date();
    premiumUntil = addDays(startsAt, premiumDays(plan)).toISOString();
  }

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    stripe_customer_id: input.customerId ?? null,
    stripe_subscription_id: subscriptionId,
    stripe_price_id: priceId,
    subscription_status: "active",
    subscription_current_period_end: currentPeriodEnd,
    is_premium: true,
    premium_until: premiumUntil,
  });

  logWebhookEvent("grant_premium", "success", {
    userId,
    plan,
    premiumUntil,
    subscriptionId,
    priceId,
  });
}

async function revokePremium(input: { userId?: string; customerId?: string }) {
  const userId = input.userId || (await findUserIdByCustomer(input.customerId));
  if (!userId) return;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.subscription_status === "canceled" || profile?.subscription_status === "unpaid") {
    return;
  }

  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    is_premium: false,
    subscription_status: "past_due",
  });

  logWebhookEvent("revoke_premium", "success", { userId });
}

// ============================================================
// FALLBACK: VERIFY SUBSCRIPTION
// ============================================================

export async function handleVerifySubscription(request: Request) {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const userId = url.searchParams.get("user_id");

  if (!sessionId && !userId) {
    return json({ error: "Provide session_id or user_id" }, { status: 400 });
  }

  const stripe = getStripe();

  try {
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const subscriptionId = session.subscription
        ? extractSubscriptionId(session.subscription)
        : null;

      if (!subscriptionId) {
        return json({ error: "No subscription found for this session" }, { status: 404 });
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const resolvedUserId = session.metadata?.user_id ?? session.client_reference_id ?? null;

      if (!resolvedUserId) {
        return json({ error: "No user_id in session metadata" }, { status: 404 });
      }

      const customerId = extractCustomerId(session.customer);
      const periodEnd = getSubscriptionPeriodEnd(subscription);
      const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
      const isActive = subscription.status === "active" || subscription.status === "trialing";

      await supabaseAdmin.from("profiles").upsert({
        id: resolvedUserId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: subscription.items?.data?.[0]?.price?.id ?? null,
        subscription_status: subscription.status,
        subscription_current_period_end: currentPeriodEnd,
        is_premium: isActive,
        premium_until: currentPeriodEnd,
      });

      return json({
        verified: true,
        userId: resolvedUserId,
        subscriptionStatus: subscription.status,
        isPremium: isActive,
      });
    }

    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("stripe_customer_id")
        .eq("id", userId)
        .maybeSingle();

      if (!profile?.stripe_customer_id) {
        return json({ error: "User has no stripe_customer_id" }, { status: 404 });
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 10,
      });

      const activeSubscription = subscriptions.data.find(
        (sub) => sub.status === "active" || sub.status === "trialing",
      );

      if (activeSubscription) {
        const periodEnd = getSubscriptionPeriodEnd(activeSubscription);
        const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;

        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          stripe_subscription_id: activeSubscription.id,
          stripe_price_id: activeSubscription.items?.data?.[0]?.price?.id ?? null,
          subscription_status: activeSubscription.status,
          subscription_current_period_end: currentPeriodEnd,
          is_premium: true,
          premium_until: currentPeriodEnd,
        });

        return json({
          verified: true,
          userId,
          subscriptionStatus: activeSubscription.status,
          isPremium: true,
        });
      }

      // Sem subscription ativa
      await supabaseAdmin.from("profiles").upsert({
        id: userId,
        is_premium: false,
        premium_until: null,
        subscription_status: "canceled",
      });

      return json({
        verified: true,
        userId,
        subscriptionStatus: "none",
        isPremium: false,
      });
    }
  } catch (error) {
    logWebhookError("verify_subscription", sessionId ?? userId ?? "unknown", error);
    return json({ error: "Verification failed" }, { status: 500 });
  }

  return json({ error: "Invalid request" }, { status: 400 });
}

// ============================================================
// HELPERS
// ============================================================

async function findUserIdByCustomer(customerId?: string | null) {
  if (!customerId) return null;
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}
