import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
export const STRIPE_API_VERSION = "2026-05-27.dahlia";
export const PREMIUM_LOOKUP_KEYS = new Set([
  "buxhub_premium_30d",
  "buxhub_premium_60d",
]);

export type PremiumPlan = "premium_30d" | "premium_60d";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");

  stripeClient ??= new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
}

export function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export async function requireUser(request: Request) {
  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
  if (!token) throw new Error("Missing authorization token");

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Error("Invalid authorization token");
  return data.user;
}

export function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function planFromLookupKey(lookupKey: string): PremiumPlan {
  if (!PREMIUM_LOOKUP_KEYS.has(lookupKey)) {
    throw new Error("Invalid premium lookup_key");
  }
  return lookupKey.replace("buxhub_", "") as PremiumPlan;
}

export function premiumDays(plan: string | null | undefined) {
  switch (plan) {
    case "premium_30d":
      return 30;
    case "premium_60d":
      return 60;
    default:
      return 30;
  }
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getBaseUrl(request: Request) {
  return (
    process.env.APP_URL ||
    process.env.PUBLIC_SITE_URL ||
    `${new URL(request.url).protocol}//${new URL(request.url).host}`
  );
}
