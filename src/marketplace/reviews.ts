import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { json, readJson, requireUser } from "@/stripe/stripe";
import { awardSpCapped } from "./bux-points";

export async function handleSubmitReview(request: Request) {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const user = await requireUser(request);
  const body = await readJson<{ order_id: string; listing_id: string; seller_id: string; rating: number; comment?: string }>(request);

  const { order_id, listing_id, seller_id, rating, comment } = body;
  if (!order_id || !listing_id || !seller_id || !rating) {
    return json({ error: "order_id, listing_id, seller_id, and rating are required" }, { status: 400 });
  }

  if (rating < 1 || rating > 5) {
    return json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  if (seller_id === user.id) {
    return json({ error: "You cannot review yourself" }, { status: 403 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("marketplace_orders")
    .select("id, buyer_id, status")
    .eq("id", order_id)
    .maybeSingle();

  if (orderError) throw orderError;
  if (!order) return json({ error: "Order not found" }, { status: 404 });
  if (order.buyer_id !== user.id) return json({ error: "You are not the buyer of this order" }, { status: 403 });
  if (order.status !== "released") return json({ error: "Order must be completed before reviewing" }, { status: 409 });

  const { data: existing } = await supabaseAdmin
    .from("reviews")
    .select("id")
    .eq("order_id", order_id)
    .maybeSingle();

  if (existing) return json({ error: "You already reviewed this order" }, { status: 409 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { count: todayReviews } = await supabaseAdmin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", user.id)
    .gte("created_at", todayStart.toISOString());

  if ((todayReviews ?? 0) >= 5) {
    return json({ error: "Você já avaliou 5 pedidos hoje. Limite diário atingido." }, { status: 429 });
  }

  const cleanComment = comment?.trim() ?? "";
  const hasValidComment = cleanComment.length >= 20;

  const { data: review, error: insertError } = await supabaseAdmin
    .from("reviews")
    .insert({
      order_id,
      listing_id,
      buyer_id: user.id,
      seller_id,
      rating,
      comment: hasValidComment ? cleanComment : null,
    })
    .select("*")
    .single();

  if (insertError) {
    if (String(insertError.message).includes("duplicate key")) {
      return json({ error: "You already reviewed this order" }, { status: 409 });
    }
    throw insertError;
  }

  let totalSp = 0;
  totalSp += 2; // rating
  if (hasValidComment) totalSp += 1; // comment
  if (hasValidComment) totalSp += 2; // combo bonus

  if (totalSp > 0) {
    await awardSpCapped(user.id, totalSp, `Avaliação do pedido #${order_id.slice(0, 8)}`, "review", review.id);
  }

  return json({ review, sp_earned: totalSp });
}
