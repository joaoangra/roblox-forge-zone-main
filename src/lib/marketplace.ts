export const PLATFORM_FEE_PCT = 0.06;
export const GATEWAY_FEE_PCT = 0;
export const ESCROW_DAYS = 7;

export function calcOrderSplit(priceCents: number) {
  const gateway = Math.round(priceCents * GATEWAY_FEE_PCT);
  const afterGateway = priceCents - gateway;
  const platform = Math.round(afterGateway * PLATFORM_FEE_PCT);
  const seller = afterGateway - platform;
  return { gateway, platform, seller, total: priceCents };
}

export function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

export function statusLabel(s: string): { label: string; tone: string } {
  const map: Record<string, { label: string; tone: string }> = {
    awaiting_payment: {
      label: "Aguardando pagamento",
      tone: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
    },
    paid: {
      label: "Pago - aguardando entrega",
      tone: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    },
    delivered: {
      label: "Entregue - protegido por 7 dias",
      tone: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
    },
    released: { label: "Liberado", tone: "bg-green-500/15 text-green-300 border-green-500/30" },
    disputed: {
      label: "Em disputa",
      tone: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    },
    refunded: { label: "Reembolsado", tone: "bg-red-500/15 text-red-300 border-red-500/30" },
    cancelled: { label: "Cancelado", tone: "bg-muted text-muted-foreground border-white/10" },
  };
  return map[s] ?? { label: s, tone: "bg-muted text-muted-foreground border-white/10" };
}
