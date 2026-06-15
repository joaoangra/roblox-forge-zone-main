import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Shield, Plus, Trash2, Check, X, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin – RBXScripts" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) {
      if (!user) router.navigate({ to: "/auth" });
      else if (!isAdmin) router.navigate({ to: "/" });
    }
  }, [loading, user, isAdmin, router]);

  if (!user || !isAdmin) return null;

  return (
    <PageShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">Painel Admin</h1>
        </div>

        <Tabs defaultValue="scripts">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="scripts">Scripts</TabsTrigger>
            <TabsTrigger value="executors">Executores</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="orders">Pedidos</TabsTrigger>
            <TabsTrigger value="pix">PIX</TabsTrigger>
            <TabsTrigger value="users">Usuários</TabsTrigger>
          </TabsList>

          <TabsContent value="scripts">
            <AdminScripts />
          </TabsContent>
          <TabsContent value="executors">
            <AdminExecutors />
          </TabsContent>
          <TabsContent value="categories">
            <AdminCategories />
          </TabsContent>
          <TabsContent value="plans">
            <AdminPlans />
          </TabsContent>
          <TabsContent value="orders">
            <AdminOrders />
          </TabsContent>
          <TabsContent value="pix">
            <AdminPix />
          </TabsContent>
          <TabsContent value="users">
            <AdminUsers />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ============ SCRIPTS ============
function AdminScripts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    code: "",
    game_name: "",
    thumbnail_url: "",
    category_id: "",
    is_premium: false,
    is_verified: false,
  });
  const { data: scripts } = useQuery({
    queryKey: ["admin-scripts"],
    queryFn: async () =>
      (
        await supabase
          .from("scripts")
          .select("*, categories(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("name")).data ?? [],
  });

  async function save() {
    if (!form.title || !form.code) {
      toast.error("Título e código obrigatórios");
      return;
    }
    const slug = slugify(form.title) + "-" + Date.now().toString(36);
    const { error } = await supabase
      .from("scripts")
      .insert({ ...form, slug, category_id: form.category_id || null });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Script criado!");
    setForm({
      title: "",
      description: "",
      code: "",
      game_name: "",
      thumbnail_url: "",
      category_id: "",
      is_premium: false,
      is_verified: false,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-scripts"] });
  }
  async function del(id: string) {
    if (!confirm("Excluir script?")) return;
    const { error } = await supabase.from("scripts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey: ["admin-scripts"] });
    }
  }

  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6">
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold">Scripts ({scripts?.length ?? 0})</h2>
          <Button onClick={() => setOpen(!open)} size="sm">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
        {open && (
          <div className="grid md:grid-cols-2 gap-3 mb-6 p-4 rounded-lg border border-white/10 bg-black/20">
            <div>
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Jogo</Label>
              <Input
                value={form.game_name}
                onChange={(e) => setForm({ ...form, game_name: e.target.value })}
                placeholder="Blox Fruits"
              />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Código Lua</Label>
              <Textarea
                rows={8}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="loadstring(game:HttpGet('...'))()"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>URL da thumbnail</Label>
              <Input
                value={form.thumbnail_url}
                onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.category_id}
                onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              >
                <option value="">— sem categoria —</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-6 items-center md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.is_premium}
                  onCheckedChange={(v) => setForm({ ...form, is_premium: v })}
                />{" "}
                Premium
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={form.is_verified}
                  onCheckedChange={(v) => setForm({ ...form, is_verified: v })}
                />{" "}
                Verificado
              </label>
            </div>
            <div className="md:col-span-2">
              <Button
                onClick={save}
                className="bg-gradient-to-r from-primary to-accent text-white border-0"
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {(scripts ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 rounded-lg border border-white/10"
            >
              <div>
                <div className="font-medium flex items-center gap-2">
                  {s.title}{" "}
                  {s.is_premium && (
                    <Badge className="bg-gradient-to-r from-primary to-accent border-0 text-[10px]">
                      Premium
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {s.game_name} · {(s.categories as { name?: string } | null)?.name ?? "—"} ·{" "}
                  {s.views} views
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ EXECUTORS ============
function AdminExecutors() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    download_url: "",
    image_url: "",
    price_brl: 0,
    is_free: true,
  });
  const { data } = useQuery({
    queryKey: ["admin-executors"],
    queryFn: async () =>
      (await supabase.from("executors").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });

  async function save() {
    if (!form.name || !form.download_url) {
      toast.error("Nome e download obrigatórios");
      return;
    }
    const slug = slugify(form.name) + "-" + Date.now().toString(36);
    const { error } = await supabase.from("executors").insert({ ...form, slug });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Executor criado!");
    setForm({
      name: "",
      description: "",
      download_url: "",
      image_url: "",
      price_brl: 0,
      is_free: true,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["admin-executors"] });
  }
  async function del(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("executors").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-executors"] });
  }

  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6">
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold">Executores ({data?.length ?? 0})</h2>
          <Button onClick={() => setOpen(!open)} size="sm">
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
        {open && (
          <div className="grid md:grid-cols-2 gap-3 mb-6 p-4 rounded-lg border border-white/10 bg-black/20">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Preço (BRL)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price_brl}
                onChange={(e) => setForm({ ...form, price_brl: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>URL download</Label>
              <Input
                value={form.download_url}
                onChange={(e) => setForm({ ...form, download_url: e.target.value })}
              />
            </div>
            <div>
              <Label>URL imagem</Label>
              <Input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <Switch
                checked={form.is_free}
                onCheckedChange={(v) => setForm({ ...form, is_free: v })}
              />{" "}
              Gratuito
            </label>
            <div className="md:col-span-2">
              <Button
                onClick={save}
                className="bg-gradient-to-r from-primary to-accent text-white border-0"
              >
                Salvar
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {(data ?? []).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between p-3 rounded-lg border border-white/10"
            >
              <div>
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-muted-foreground">
                  {e.is_free ? "Grátis" : `R$ ${Number(e.price_brl).toFixed(2)}`}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(e.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ CATEGORIES ============
function AdminCategories() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const { data } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("*").order("sort_order")).data ?? [],
  });
  async function add() {
    if (!name) return;
    const { error } = await supabase.from("categories").insert({ name, slug: slugify(name) });
    if (error) toast.error(error.message);
    else {
      setName("");
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    }
  }
  async function del(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("categories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-categories"] });
  }
  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6">
        <div className="flex gap-2 mb-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da categoria"
          />
          <Button onClick={add}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2">
          {(data ?? []).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between p-3 rounded-lg border border-white/10"
            >
              <div>
                {c.name} <span className="text-xs text-muted-foreground">/{c.slug}</span>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ PLANS ============
function AdminPlans() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration_days: 30,
    price_brl: 19.9,
    features: "",
  });
  const { data } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () =>
      (await supabase.from("premium_plans").select("*").order("sort_order")).data ?? [],
  });
  async function add() {
    if (!form.name) return;
    const { error } = await supabase
      .from("premium_plans")
      .insert({ ...form, features: form.features.split("\n").filter(Boolean) });
    if (error) toast.error(error.message);
    else {
      setForm({ name: "", description: "", duration_days: 30, price_brl: 19.9, features: "" });
      qc.invalidateQueries({ queryKey: ["admin-plans"] });
    }
  }
  async function toggle(id: string, current: boolean) {
    await supabase.from("premium_plans").update({ is_active: !current }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-plans"] });
  }
  async function del(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("premium_plans").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-plans"] });
  }
  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6">
        <div className="grid md:grid-cols-2 gap-3 mb-4 p-4 rounded-lg border border-white/10 bg-black/20">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div>
            <Label>Duração (dias)</Label>
            <Input
              type="number"
              value={form.duration_days}
              onChange={(e) => setForm({ ...form, duration_days: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Preço (BRL)</Label>
            <Input
              type="number"
              step="0.01"
              value={form.price_brl}
              onChange={(e) => setForm({ ...form, price_brl: Number(e.target.value) })}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Recursos (um por linha)</Label>
            <Textarea
              rows={4}
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={add}>
              <Plus className="h-4 w-4" /> Criar plano
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between p-3 rounded-lg border border-white/10"
            >
              <div>
                <div className="font-medium">
                  {p.name} · R$ {Number(p.price_brl).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {p.duration_days} dias · {p.is_active ? "ativo" : "inativo"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle(p.id, p.is_active)}>
                  {p.is_active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => del(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ ORDERS ============
function AdminOrders() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin-orders"],
    refetchInterval: 10000,
    queryFn: async () => {
      const orders =
        (
          await supabase
            .from("premium_orders")
            .select("*, premium_plans(name, duration_days)")
            .order("created_at", { ascending: false })
        ).data ?? [];

      const userIds = [...new Set(orders.map((order) => order.user_id))];
      const profiles = userIds.length
        ? ((await supabase.from("profiles").select("id, username, display_name").in("id", userIds))
            .data ?? [])
        : [];

      const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
      return orders.map((order) => ({
        ...order,
        profiles: profilesById.get(order.user_id) ?? null,
      }));
    },
  });

  const orders = useMemo(() => data ?? [], [data]);

  async function confirmOrder(o: {
    id: string;
    user_id: string;
    premium_plans: { duration_days?: number } | null;
  }) {
    const days = o.premium_plans?.duration_days ?? 30;
    const until = new Date();
    until.setDate(until.getDate() + days);
    const { error: e1 } = await supabase
      .from("premium_orders")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", o.id);
    const { error: e2 } = await supabase
      .from("profiles")
      .update({ is_premium: true, premium_until: until.toISOString() })
      .eq("id", o.user_id);
    if (e1 || e2) toast.error((e1 || e2)?.message ?? "Erro");
    else {
      toast.success("Premium liberado!");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  }
  async function reject(id: string) {
    if (!confirm("Rejeitar pedido?")) return;
    await supabase.from("premium_orders").update({ status: "rejected" }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6">
        <div className="space-y-2">
          {orders.map((o) => {
            const prof = o.profiles as { username?: string; display_name?: string } | null;
            return (
              <div key={o.id} className="p-4 rounded-lg border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {(o.premium_plans as { name?: string } | null)?.name ?? "Plano"} · R${" "}
                      {Number(o.amount_brl).toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{prof?.username ?? "—"} · {new Date(o.created_at).toLocaleString("pt-BR")} ·
                      status: {o.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a href={`/orders/${o.id}`}>
                      <Button size="sm" variant="outline">
                        <MessageSquare className="h-4 w-4" /> Chat
                      </Button>
                    </a>
                    {o.status !== "confirmed" && (
                      <Button
                        size="sm"
                        className="bg-success text-success-foreground"
                        onClick={() => confirmOrder(o)}
                      >
                        <Check className="h-4 w-4" /> Liberar
                      </Button>
                    )}
                    {o.status !== "rejected" && o.status !== "confirmed" && (
                      <Button size="sm" variant="destructive" onClick={() => reject(o.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {orders.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido ainda.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ PIX SETTINGS ============
function AdminPix() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["pix-settings"],
    queryFn: async () =>
      (await supabase.from("pix_settings").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [form, setForm] = useState({
    pix_key: "",
    pix_key_type: "email",
    recipient_name: "",
    instructions: "",
  });
  useEffect(() => {
    if (data)
      setForm({
        pix_key: data.pix_key,
        pix_key_type: data.pix_key_type,
        recipient_name: data.recipient_name,
        instructions: data.instructions,
      });
  }, [data]);
  async function save() {
    const { error } = await supabase
      .from("pix_settings")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (error) toast.error(error.message);
    else {
      toast.success("Salvo");
      qc.invalidateQueries({ queryKey: ["pix-settings"] });
    }
  }
  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6 grid md:grid-cols-2 gap-3">
        <div>
          <Label>Chave PIX</Label>
          <Input
            value={form.pix_key}
            onChange={(e) => setForm({ ...form, pix_key: e.target.value })}
            placeholder="seu@email.com / CPF / aleatória"
          />
        </div>
        <div>
          <Label>Tipo</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={form.pix_key_type}
            onChange={(e) => setForm({ ...form, pix_key_type: e.target.value })}
          >
            <option value="email">Email</option>
            <option value="cpf">CPF</option>
            <option value="phone">Telefone</option>
            <option value="random">Aleatória</option>
          </select>
        </div>
        <div>
          <Label>Nome do recebedor</Label>
          <Input
            value={form.recipient_name}
            onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Label>Instruções</Label>
          <Textarea
            rows={3}
            value={form.instructions}
            onChange={(e) => setForm({ ...form, instructions: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <Button
            onClick={save}
            className="bg-gradient-to-r from-primary to-accent text-white border-0"
          >
            Salvar PIX
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ USERS ============
function AdminUsers() {
  const qc = useQueryClient();
  const { data: profiles } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, username, display_name, is_premium, premium_until, created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });
  const { data: roles } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  async function toggleAdmin(uid: string, isCurrentlyAdmin: boolean) {
    if (isCurrentlyAdmin) {
      await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", "admin");
    } else {
      await supabase.from("user_roles").insert({ user_id: uid, role: "admin" });
    }
    qc.invalidateQueries({ queryKey: ["admin-user-roles"] });
    toast.success("Atualizado");
  }
  async function togglePremium(uid: string, current: boolean) {
    const until = new Date();
    until.setFullYear(until.getFullYear() + 100);
    await supabase
      .from("profiles")
      .update({ is_premium: !current, premium_until: !current ? until.toISOString() : null })
      .eq("id", uid);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  const adminIds = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

  return (
    <Card className="border-white/10 bg-card/50">
      <CardContent className="p-6">
        <div className="space-y-2">
          {(profiles ?? []).map((p) => {
            const isAdmin = adminIds.has(p.id);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg border border-white/10"
              >
                <div>
                  <div className="font-medium">
                    {p.display_name ?? p.username ?? "—"}{" "}
                    {isAdmin && (
                      <Badge className="ml-1 bg-primary text-primary-foreground text-[10px]">
                        ADMIN
                      </Badge>
                    )}{" "}
                    {p.is_premium && (
                      <Badge className="ml-1 bg-gradient-to-r from-primary to-accent border-0 text-[10px]">
                        PREMIUM
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    @{p.username} · cadastrado {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => togglePremium(p.id, p.is_premium)}
                  >
                    {p.is_premium ? "Remover Premium" : "Dar Premium"}
                  </Button>
                  <Button
                    size="sm"
                    variant={isAdmin ? "destructive" : "outline"}
                    onClick={() => toggleAdmin(p.id, isAdmin)}
                  >
                    {isAdmin ? "Remover admin" : "Tornar admin"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
