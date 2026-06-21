import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function awardSpCapped(
  userId: string,
  amount: number,
  reason: string,
  referenceType: string | null,
  referenceId: string | null,
) {
  if (amount <= 0) return 0;
  const { data } = await (supabaseAdmin as any).rpc("award_points_capped", {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_type: referenceType,
    p_reference_id: referenceId,
  });
  return (data as number) ?? 0;
}
