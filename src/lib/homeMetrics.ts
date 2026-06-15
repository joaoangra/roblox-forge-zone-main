import type { ComponentType } from "react";

import { Code2, Cpu, ShoppingBag, Users } from "lucide-react";

export type HomeStats = {
  scripts: number;
  executors: number;
  users: number;
  listings: number;
};

export type HomeMetric = {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
};

export function getGlobalMetrics(stats?: Partial<HomeStats>): HomeMetric[] {
  return [
    { label: "Scripts", value: stats?.scripts ?? "—", icon: Code2 },
    { label: "Executores", value: stats?.executors ?? "—", icon: Cpu },
    { label: "Usuários", value: stats?.users ?? "—", icon: Users },
    { label: "Anúncios", value: stats?.listings ?? "—", icon: ShoppingBag },
  ];
}
