import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getStripe, json, readJson } from "@/stripe/stripe";

export async function releaseEligibleTransactions(limit = 50) {
  const { data: transactions, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("status", "held")
    .lte("release_at", new Date().toISOString())
    .limit(limit);
  if (error) throw error;

  const results = [];
  for (const transaction of transactions ?? []) {
    results.push(await releaseTransaction(transaction.id));
  }
  return results;
}

export async function releaseTransaction(transactionId: string) {
  const { data: transaction, error } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("id", transactionId)
    .maybeSingle();
  if (error) throw error;
  if (!transaction) throw new Error("Transaction not found");
  if (transaction.status === "disputed") throw new Error("Transaction is disputed");
  if (transaction.status === "released") return transaction;
  if (transaction.status !== "held") throw new Error("Transaction is not held");

  const { data: seller } = await supabaseAdmin
    .from("profiles")
    .select("stripe_account_id, seller_verified")
    .eq("id", transaction.seller_id)
    .maybeSingle();
  if (!seller?.stripe_account_id || !seller.seller_verified) {
    throw new Error("Seller is not ready for Stripe Connect payouts");
  }

  const transfer = await getStripe().transfers.create({
    amount: transaction.seller_amount_cents,
    currency: transaction.currency,
    destination: seller.stripe_account_id,
    transfer_group: transaction.marketplace_order_id
      ? `marketplace_order_${transaction.marketplace_order_id}`
      : undefined,
    metadata: {
      transaction_id: transaction.id,
      seller_id: transaction.seller_id,
      platform_fee_cents: String(transaction.platform_fee_cents),
    },
  });

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("transactions")
    .update({
      status: "released",
      stripe_transfer_id: transfer.id,
      released_at: new Date().toISOString(),
    })
    .eq("id", transaction.id)
    .select("*")
    .single();
  if (updateError) throw updateError;

  if (transaction.marketplace_order_id) {
    await supabaseAdmin
      .from("marketplace_orders")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", transaction.marketplace_order_id);
  }

  return updated;
}

export async function handleReleaseDuePayouts(request: Request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const expected = process.env.CRON_SECRET;
  if (expected && request.headers.get("authorization") !== `Bearer ${expected}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJson<{ limit?: number }>(request).catch(() => ({ limit: 50 }));
  const released = await releaseEligibleTransactions(body.limit ?? 50);
  return json({ released });
}
