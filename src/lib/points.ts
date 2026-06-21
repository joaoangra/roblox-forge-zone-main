import { supabase } from "@/integrations/supabase/client";

export const POINTS = {
  PURCHASE: 50,
  REVIEW: 50,
  COMMENT: 10,
  SELL: 100,
  LOGIN: 5,
  SCRIPT_UPLOAD_BASIC: 2,
  SCRIPT_UPLOAD_GOOD: 5,
  SCRIPT_UPLOAD_ELITE: 10,
  SCRIPT_FEATURED: 25,
  LIKES_10: 2,
  LIKES_50: 5,
  LIKES_100: 15,
} as const;

export async function awardPoints(
  userId: string,
  amount: number,
  reason: string,
  referenceType?: string,
  referenceId?: string,
) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) return;

  const response = await fetch("/admin-api/award-points", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, amount, reason, reference_type: referenceType, reference_id: referenceId }),
  });
  return response.ok;
}

export async function getPoints(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("bux_points")
    .eq("id", userId)
    .maybeSingle();
  return { balance: (data as any)?.bux_points ?? 0, lifetime_earned: 0 };
}

export async function getPointTransactions(userId: string) {
  const { data } = await supabase
    .from("points_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export function calculateScriptTier(qualityScore: number, hasKey: boolean, isObfuscated: boolean, descriptionLength: number, hasImage: boolean, hasExecutors: boolean) {
  if (qualityScore >= 80 && !hasKey && !isObfuscated && descriptionLength > 200 && hasImage && hasExecutors)
    return "elite";
  if (qualityScore >= 50 && hasImage && hasExecutors && descriptionLength > 100)
    return "good";
  return "basic";
}

export function calculateUploadPoints(tier: string, isPremium: boolean, dailyCount: number) {
  const base = tier === "elite" ? 10 : tier === "good" ? 5 : tier === "basic" ? 2 : 0;
  const multiplier = isPremium ? 1.5 : 1.0;
  const diminishing = dailyCount === 0 ? 1.0 : dailyCount === 1 ? 0.8 : dailyCount === 2 ? 0.6 : 0.0;
  return Math.max(0, Math.round(base * multiplier * diminishing));
}

export function calculateLoginReward(streak: number) {
  if (streak >= 7) return 10;
  return streak;
}

export function getTierIcon(tier: string) {
  switch (tier) {
    case "elite": return "💎";
    case "good": return "⭐";
    default: return "📦";
  }
}

export function getTierColor(tier: string) {
  switch (tier) {
    case "elite": return "from-purple-500/20 to-pink-500/20";
    case "good": return "from-yellow-500/20 to-amber-500/20";
    default: return "from-slate-400/20 to-slate-300/20";
  }
}
