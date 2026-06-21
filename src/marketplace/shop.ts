import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json, readJson, requireUser } from "@/stripe/stripe";

export async function handlePurchaseItem(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const user = await requireUser(request);
  const body = await readJson<{ item_id: string }>(request);
  const { item_id } = body;
  if (!item_id) return json({ error: "item_id is required" }, { status: 400 });

  // Get item
  const { data: item, error: itemError } = await (supabaseAdmin as any)
    .from("shop_items")
    .select("*")
    .eq("id", item_id)
    .eq("active", true)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) return json({ error: "Item not found or unavailable" }, { status: 404 });

  if (item.stock != null && item.stock <= 0) {
    return json({ error: "Item out of stock" }, { status: 409 });
  }

  // Spend points
  const { data: spendResult, error: spendError } = await (supabaseAdmin as any)
    .rpc("spend_points", {
      p_user_id: user.id,
      p_amount: item.price_points,
      p_reason: `Compra na Bux Store: ${item.name}`,
      p_reference_type: "shop",
      p_reference_id: item_id,
    });

  if (spendError) throw spendError;
  if (spendResult?.error) {
    return json({ error: spendResult.error }, { status: 400 });
  }

  // Record purchase
  const { error: purchaseError } = await (supabaseAdmin as any)
    .from("shop_purchases")
    .insert({ user_id: user.id, item_id, points_spent: item.price_points });

  if (purchaseError) throw purchaseError;

  // Decrement stock if tracked
  if (item.stock != null) {
    await (supabaseAdmin as any)
      .from("shop_items")
      .update({ stock: item.stock - 1 })
      .eq("id", item_id);
  }

  return json({ ok: true, new_balance: spendResult.new_balance });
}
