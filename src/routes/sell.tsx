import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { BadgeCheck, Clock, FileWarning, Package, Plus, ShieldAlert } from "lucide-react";
import { slugify, brl, calcOrderSplit } from "@/lib/marketplace";

export const Route = createFileRoute("/sell")({
  head: () => ({ meta: [{ title: "Vender no Marketplace — RBXScripts" }] }),
  component: SellPage,
});

function SellPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.navigate({ to: "/auth" }); }, [loading, user, router]);
  if (!user) return null;

  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Painel do Vendedor</h1>
        <Tabs defaultValue="profile">
          <TabsList className="mb-6 flex-wrap h-auto">
            <TabsTrigger value="profile">Perfil & KYC</TabsTrigger>
            <TabsTrigger value="listings">Meus Anúncios</TabsTrigger>
            <TabsTrigger value="new">Novo Anúncio</TabsTrigger>
            <TabsTrigger value="orders">Vendas</TabsTrigger>
          </TabsList>
          <TabsContent value="profile"><SellerProfileTab /></TabsContent>
          <TabsContent value="listings"><MyListingsTab /></TabsContent>
          <TabsContent value="new"><NewListingTab /></TabsContent>
          <TabsContent value="orders"><MySalesTab /></TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

function SellerProfileTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: sp } = useQuery({
    queryKey: ["my-seller", user!.id],
    queryFn: async () => (await supabase.from("seller_profiles").select("*").eq("user_id", user!.id).maybeSingle()).data,
  });
  const { data: kyc } = useQuery({
    queryKey: ["my-kyc", user!.id],
    queryFn: async () => (await supabase.from("kyc_verifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).maybeSingle()).data,
  });

  const [bio, setBio] = useState("");
  const [fullName, setFullName] = useState("");
  const [docType, setDocType] = useState("rg");
  const [docNumber, setDocNumber] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function saveProfile() {
    const { error } = await supabase.from("seller_profiles").upsert({ user_id: user!.id, bio });
    if (error) toast.error(error.message); else { toast.success("Perfil salvo"); qc.invalidateQueries({ queryKey: ["my-seller"] }); }
  }

  async function submitKyc() {
    if (!docFile || !selfieFile || !fullName || !docNumber) { toast.error("Preencha tudo"); return; }
    setSubmitting(true);
    const ts = Date.now();
    const [d, s] = await Promise.all([
      supabase.storage.from("kyc-docs").upload(`${user!.id}/${ts}-doc-${docFile.name}`, docFile),
      supabase.storage.from("kyc-docs").upload(`${user!.id}/${ts}-selfie-${selfieFile.name}`, selfieFile),
    ]);
    if (d.error || s.error) { setSubmitting(false); toast.error("Falha no upload"); return; }
    const { error } = await supabase.from("kyc_verifications").insert({
      user_id: user!.id, full_name: fullName, document_type: docType, document_number: docNumber,
      document_front_url: d.data.path, selfie_url: s.data.path, status: "pending",
    });
    await supabase.from("seller_profiles").upsert({ user_id: user!.id, kyc_status: "pending" });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Documentos enviados. Aguarde análise."); qc.invalidateQueries(); }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            {sp?.verified ? <BadgeCheck className="h-5 w-5 text-primary" /> : <Clock className="h-5 w-5 text-yellow-500" />}
            Status: <Badge variant="outline" className="capitalize">{sp?.kyc_status ?? "não iniciado"}</Badge>
          </h2>
          <div>
            <Label>Bio pública</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={sp?.bio ?? "Conte um pouco sobre você…"} rows={4} />
          </div>
          <Button onClick={saveProfile}>Salvar perfil</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> Verificação KYC</h2>
          {kyc?.status === "approved" ? (
            <div className="text-sm text-green-400">✓ Aprovado. Você pode anunciar.</div>
          ) : kyc?.status === "pending" ? (
            <div className="text-sm text-yellow-400">⏳ Em análise pelo time.</div>
          ) : (
            <>
              <div><Label>Nome completo</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo de doc</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rg">RG</SelectItem>
                      <SelectItem value="cnh">CNH</SelectItem>
                      <SelectItem value="passport">Passaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Número</Label><Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} /></div>
              </div>
              <div><Label>Foto do documento</Label><Input type="file" accept="image/*" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} /></div>
              <div><Label>Selfie segurando o documento</Label><Input type="file" accept="image/*" onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)} /></div>
              <Button onClick={submitKyc} disabled={submitting} className="w-full">{submitting ? "Enviando…" : "Enviar para análise"}</Button>
              {kyc?.status === "rejected" && <div className="text-sm text-red-400">Rejeitado: {kyc.rejection_reason}</div>}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MyListingsTab() {
  const { user } = useAuth();
  const { data, refetch } = useQuery({
    queryKey: ["my-listings", user!.id],
    queryFn: async () => (await supabase.from("listings").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  async function del(id: string) {
    if (!confirm("Excluir anúncio?")) return;
    await supabase.from("listings").delete().eq("id", id); refetch();
  }

  if (!data?.length) return <Card><CardContent className="p-8 text-center text-muted-foreground"><Package className="h-10 w-10 mx-auto mb-2" />Você ainda não tem anúncios.</CardContent></Card>;
  return (
    <div className="space-y-2">
      {data.map((l: any) => (
        <Card key={l.id}><CardContent className="p-4 flex items-center gap-3">
          <div className="h-16 w-16 rounded bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden">
            {l.cover_image_url && <img src={l.cover_image_url} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{l.title}</div>
            <div className="text-xs text-muted-foreground">{brl(l.price_cents)} · <Badge variant="outline" className="text-xs">{l.status}</Badge></div>
          </div>
          <Button variant="outline" size="sm" onClick={() => del(l.id)}>Excluir</Button>
        </CardContent></Card>
      ))}
    </div>
  );
}

function NewListingTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", short: "", description: "", price: "", game: "", category: "", delivery: "manual" as const });
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: cats } = useQuery({ queryKey: ["mp-cats"], queryFn: async () => (await supabase.from("marketplace_categories").select("*").order("sort_order")).data ?? [] });
  const { data: sp } = useQuery({ queryKey: ["my-seller", user!.id], queryFn: async () => (await supabase.from("seller_profiles").select("*").eq("user_id", user!.id).maybeSingle()).data });

  const priceCents = Math.round((parseFloat(form.price.replace(",", ".")) || 0) * 100);
  const split = priceCents > 0 ? calcOrderSplit(priceCents) : null;

  async function publish() {
    if (!sp?.verified) { toast.error("Você precisa ser verificado (KYC aprovado) para publicar."); return; }
    if (!form.title || !form.description || !form.category || priceCents <= 0) { toast.error("Preencha os obrigatórios"); return; }
    setSaving(true);
    let coverUrl: string | null = null;
    if (cover) {
      const { data, error } = await supabase.storage.from("listing-media").upload(`${user!.id}/${Date.now()}-${cover.name}`, cover);
      if (error) { setSaving(false); toast.error(error.message); return; }
      coverUrl = supabase.storage.from("listing-media").getPublicUrl(data.path).data.publicUrl;
    }
    const slug = slugify(form.title);
    const { error } = await supabase.from("listings").insert({
      seller_id: user!.id, category_id: form.category, slug,
      title: form.title, short_description: form.short, description: form.description,
      game_name: form.game || null, price_cents: priceCents, delivery_type: form.delivery,
      cover_image_url: coverUrl, status: "pending_review",
    });
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Anúncio criado! Aguarde aprovação do admin."); router.navigate({ to: "/sell" }); }
  }

  return (
    <Card><CardContent className="p-6 space-y-4">
      {!sp?.verified && (
        <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm">
          <FileWarning className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <span>Você precisa concluir a verificação KYC antes de publicar. Volte para a aba <strong>Perfil & KYC</strong>.</span>
        </div>
      )}
      <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Categoria *</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>{cats?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Jogo (ex: Blox Fruits)</Label><Input value={form.game} onChange={(e) => setForm({ ...form, game: e.target.value })} /></div>
      </div>
      <div><Label>Descrição curta</Label><Input value={form.short} onChange={(e) => setForm({ ...form, short: e.target.value })} /></div>
      <div><Label>Descrição completa *</Label><Textarea rows={6} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Preço (R$) *</Label><Input type="text" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="10,00" /></div>
        <div>
          <Label>Tipo de entrega</Label>
          <Select value={form.delivery} onValueChange={(v: any) => setForm({ ...form, delivery: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual (combinado no chat)</SelectItem>
              <SelectItem value="instant_code">Código instantâneo</SelectItem>
              <SelectItem value="service">Serviço (combinado)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Imagem de capa</Label><Input type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></div>

      {split && (
        <div className="text-xs bg-white/5 rounded p-3 space-y-1">
          <div className="flex justify-between"><span>Preço cobrado do cliente</span><span>{brl(split.total)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>− Gateway PIX (4%)</span><span>−{brl(split.gateway)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>− Comissão plataforma (10%)</span><span>−{brl(split.platform)}</span></div>
          <div className="flex justify-between font-semibold text-primary pt-1 border-t border-white/10"><span>Você recebe</span><span>{brl(split.seller)}</span></div>
        </div>
      )}

      <Button onClick={publish} disabled={saving || !sp?.verified} className="w-full bg-gradient-to-r from-primary to-accent text-white border-0"><Plus className="h-4 w-4" /> {saving ? "Publicando…" : "Publicar anúncio"}</Button>
    </CardContent></Card>
  );
}

function MySalesTab() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["my-sales", user!.id],
    queryFn: async () => (await supabase.from("marketplace_orders").select("*, listing:listings(title, slug)").eq("seller_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  if (!data?.length) return <Card><CardContent className="p-8 text-center text-muted-foreground">Sem vendas ainda.</CardContent></Card>;
  return (
    <div className="space-y-2">
      {data.map((o: any) => (
        <Link key={o.id} to="/market/orders/$id" params={{ id: o.id }}>
          <Card className="hover:border-primary/30"><CardContent className="p-4 flex items-center justify-between gap-3">
            <div><div className="font-semibold">{o.listing?.title}</div><div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("pt-BR")}</div></div>
            <div className="text-right"><div className="font-bold">{brl(o.amount_cents)}</div><Badge variant="outline" className="text-xs capitalize">{o.status}</Badge></div>
          </CardContent></Card>
        </Link>
      ))}
    </div>
  );
}
