import { supabase } from "@/integrations/supabase/client";

export async function adminApi<T = unknown>(action: string, body: Record<string, unknown> = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  const res = await fetch(`/admin-api/${action}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(payload.error ?? "Erro no painel admin");
  return payload;
}
