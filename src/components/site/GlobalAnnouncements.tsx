import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Megaphone, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Announcement = {
  id: string;
  title: string;
  content: string;
  priority: "normal" | "important" | "critical";
};

const tone = {
  normal: "border-sky-500/20 bg-sky-500/8 text-sky-100",
  important: "border-amber-500/25 bg-amber-500/10 text-amber-100",
  critical: "border-red-500/30 bg-red-500/10 text-red-100",
};

const icons = {
  normal: Megaphone,
  important: AlertTriangle,
  critical: ShieldAlert,
};

export function GlobalAnnouncements() {
  const { data } = useQuery({
    queryKey: ["global-announcements"],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("site_announcements")
        .select("id, title, content, priority")
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      return (rows ?? []) as Announcement[];
    },
    refetchInterval: 60000,
  });

  if (!data?.length) return null;

  return (
    <div className="border-b border-white/10 bg-background/95">
      <div className="mx-auto max-w-7xl px-4 py-2 space-y-2">
        {data.map((item) => {
          const Icon = icons[item.priority] ?? Megaphone;
          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${tone[item.priority]}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold leading-tight">{item.title}</div>
                <div className="text-xs opacity-85">{item.content}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
