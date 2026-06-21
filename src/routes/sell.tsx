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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BadgeCheck, Clock, Crown, FileWarning, Image, Package, Plus, ShieldAlert, Infinity, Gamepad2, Share2, Star, Shield, AlertTriangle, XCircle, TrendingUp } from "lucide-react";
import { slugify, brl, calcOrderSplit } from "@/lib/marketplace";

export const Route = createFileRoute("/sell")({
  head: () => ({ meta: [{ title: "Vender no Marketplace — RBXScripts" }] }),
  component: SellPage,
});

function SellPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);
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
          <TabsContent value="profile">
            <SellerProfileTab />
          </TabsContent>
          <TabsContent value="listings">
            <MyListingsTab />
          </TabsContent>
          <TabsContent value="new">
            <NewListingTab />
          </TabsContent>
          <TabsContent value="orders">
            <MySalesTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
}

function SellerProfileTab() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState(false);
  const { data: sp } = useQuery({
    queryKey: ["my-seller", user!.id],
    queryFn: async () =>
      (await (supabase as any).from("seller_profiles").select("*").eq("user_id", user!.id).maybeSingle())
        .data as any,
  });
  const { data: kyc } = useQuery({
    queryKey: ["my-kyc", user!.id],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("seller_verification")
          .select("*")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data as any,
  });
  const { data: payProfile } = useQuery({
    queryKey: ["seller-payment-profile", user!.id],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("profiles")
          .select("stripe_account_id, seller_verified, is_trusted_seller")
          .eq("id", user!.id)
          .maybeSingle()
      ).data as any,
  });

  const [bio, setBio] = useState("");
  const [fullName, setFullName] = useState("");
  const [docType, setDocType] = useState("rg");
  const [docNumber, setDocNumber] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sProfile = sp as any;

  async function saveProfile() {
    const { error } = await supabase.from("seller_profiles").upsert({ user_id: user!.id, bio });
    if (error) toast.error(error.message);
    else {
      toast.success("Perfil salvo");
      qc.invalidateQueries({ queryKey: ["my-seller"] });
    }
  }

  async function submitKyc() {
    if (!docFile || !selfieFile || !fullName || !docNumber) {
      toast.error("Preencha tudo");
      return;
    }
    setSubmitting(true);
    const ts = Date.now();
    const [d, s] = await Promise.all([
      supabase.storage.from("kyc-docs").upload(`${user!.id}/${ts}-doc-${docFile.name}`, docFile),
      supabase.storage
        .from("kyc-docs")
        .upload(`${user!.id}/${ts}-selfie-${selfieFile.name}`, selfieFile),
    ]);
    if (d.error || s.error) {
      setSubmitting(false);
      toast.error("Falha no upload");
      return;
    }
    const { error } = await (supabase as any).from("seller_verification").insert({
      user_id: user!.id,
      full_name: fullName,
      document_type: docType,
      cpf: docNumber,
      document_front_url: d.data.path,
      selfie_url: s.data.path,
      status: "pending",
    });
    await supabase.from("seller_profiles").upsert({ user_id: user!.id, kyc_status: "pending" });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Documentos enviados. Aguarde análise.");
      qc.invalidateQueries();
    }
  }

  async function startStripeConnect() {
    setConnecting(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const response = await fetch("/marketplace/create-seller-account", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: user!.id, email: user!.email }),
    });
    const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    setConnecting(false);
    if (!response.ok || !data.url) {
      toast.error(data.error ?? "Nao foi possivel abrir o Stripe Connect");
      return;
    }
    window.location.href = data.url;
  }

  async function syncStripeConnect() {
    setConnecting(true);
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const response = await fetch("/marketplace/sync-seller-account", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ user_id: user!.id }),
    });
    const data = (await response.json().catch(() => ({}))) as {
      seller_verified?: boolean;
      error?: string;
    };
    setConnecting(false);
    if (!response.ok) {
      toast.error(data.error ?? "Nao foi possivel sincronizar o Stripe");
      return;
    }
    toast.success(data.seller_verified ? "Stripe Connect verificado" : "Stripe ainda pendente");
    qc.invalidateQueries();
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-primary" /> Stripe Connect
          </h2>
          <p className="text-sm text-muted-foreground">
            Necessario para receber vendas do marketplace. A plataforma cobra 6% e libera o saldo
            apos 7 dias, salvo disputa.
          </p>
          <Badge variant="outline">
            {payProfile?.seller_verified ? "Pronto para receber" : "Configuracao pendente"}
          </Badge>
          <div className="flex flex-wrap gap-2">
            <Button onClick={startStripeConnect} disabled={connecting}>
              {payProfile?.stripe_account_id ? "Reabrir onboarding" : "Conectar Stripe"}
            </Button>
            <Button onClick={syncStripeConnect} disabled={connecting} variant="outline">
              Sincronizar status
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {sProfile?.verified || sProfile?.verification_status === "verified" ? (
                <BadgeCheck className="h-6 w-6 text-primary" />
              ) : sProfile?.verification_status === "rejected" ? (
                <XCircle className="h-6 w-6 text-red-500" />
              ) : sProfile?.verification_status === "pending" ? (
                <Clock className="h-6 w-6 text-yellow-500" />
              ) : (
                <Shield className="h-6 w-6 text-muted-foreground" />
              )}
              <div>
                <div className="font-semibold flex items-center gap-2">
                  Verificação
                  {(payProfile as any)?.is_trusted_seller && (
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 border-0 text-[10px] flex items-center gap-1">
                      <Star className="h-3 w-3" /> Trusted
                    </Badge>
                  )}
                </div>
                <Badge variant="outline" className="capitalize mt-1">
                  {sProfile?.verification_status === "verified"
                    ? "Vendedor Verificado"
                    : sProfile?.verification_status === "rejected"
                      ? "Rejeitado"
                      : sProfile?.verification_status === "pending"
                        ? "Pendente"
                        : sProfile?.kyc_status ?? "Não verificado"}
                </Badge>
              </div>
            </div>
            {(!sProfile?.verified && sProfile?.verification_status !== "pending" && sProfile?.verification_status !== "rejected") && (
              <Button size="sm" asChild>
                <Link to="/kyc">
                  <Shield className="h-3 w-3" /> Verificar Agora
                </Link>
              </Button>
            )}
            {sProfile?.verification_status === "rejected" && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/kyc">Reenviar Documentos</Link>
              </Button>
            )}
          </div>

          {/* Limits + Premium + Trust info */}
          <div className="text-xs bg-white/5 rounded-lg p-3 space-y-1">
            <p className="font-medium text-muted-foreground mb-1">Limites da conta:</p>
            {sProfile?.verified ? (
              <>
                <div className="flex justify-between"><span>Anúncios</span><span className="text-green-500">Ilimitados</span></div>
                <div className="flex justify-between"><span>Comissão</span><span className="text-green-500">6%</span></div>
                <div className="flex justify-between"><span>Hold de liberação</span><span className="text-green-500">7 dias</span></div>
                {(payProfile as any)?.is_trusted_seller && (
                  <div className="flex justify-between"><span>Status</span><span className="text-amber-500">Vendedor Trusted</span></div>
                )}
              </>
            ) : sProfile?.verification_status === "pending" ? (
              <>
                <div className="flex justify-between"><span>Anúncios</span><span className="text-yellow-500">Máx. 3</span></div>
                <div className="flex justify-between"><span>Vendas</span><span className="text-yellow-500">Máx. R$ 500</span></div>
                <div className="flex justify-between"><span>Hold de liberação</span><span className="text-yellow-500">14 dias</span></div>
                <p className="text-muted-foreground mt-1">Aguardando análise da equipe.</p>
              </>
            ) : (
              <>
                <div className="flex justify-between"><span>Anúncios</span><span className="text-muted-foreground">Máx. 3</span></div>
                <div className="flex justify-between"><span>Vendas</span><span className="text-muted-foreground">Máx. R$ 500</span></div>
                <div className="flex justify-between"><span>Comissão</span><span className="text-muted-foreground">10%</span></div>
                <div className="flex justify-between"><span>Hold de liberação</span><span className="text-muted-foreground">14 dias</span></div>
                <p className="text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Verifique-se para aumentar os limites!
                </p>
              </>
            )}
          </div>

          {/* Premium & Pontos info */}
          <div className="text-xs bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20 rounded-lg p-3 space-y-2">
            <p className="font-medium text-amber-400 flex items-center gap-1">
              <Crown className="h-3.5 w-3.5" /> Benefícios Premium
            </p>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Comissão normal</span>
                <span>10%</span>
              </div>
              <div className="flex justify-between">
                <span>Comissão Premium</span>
                <span className="text-amber-400 font-medium">6%</span>
              </div>
              <div className="flex justify-between">
                <span>Economia por venda de R$ 100</span>
                <span className="text-green-500">R$ 4,00</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Vendedores Premium pagam apenas <strong className="text-amber-400">6%</strong> de comissão
              contra <strong>10%</strong> dos vendedores comuns. Quanto mais você vende, mais compensa.
              <Link to="/premium" className="text-amber-400 hover:underline ml-1">Saiba mais</Link>
            </p>
          </div>

          <div className="text-xs bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20 rounded-lg p-3 space-y-2">
            <p className="font-medium text-sky-400 flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" /> Sistema de Confiança (Pontos)
            </p>
            <div className="space-y-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Ganha por compra</span>
                <span className="text-green-500">+50 pts</span>
              </div>
              <div className="flex justify-between">
                <span>Ganha por avaliação</span>
                <span className="text-green-500">+50 pts</span>
              </div>
              <div className="flex justify-between">
                <span>Ganha por comentário</span>
                <span className="text-green-500">+10 pts</span>
              </div>
              <div className="flex justify-between">
                <span>Ganha por venda</span>
                <span className="text-green-500">+100 pts</span>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Quanto mais você participa, mais pontos acumula. Pontos altos aumentam sua
              reputação e confiança na plataforma, destravando o selo <strong className="text-amber-500">Trusted Seller</strong>
              e benefícios exclusivos.
              <Link to="/points" className="text-sky-400 hover:underline ml-1">Ver ranking</Link>
            </p>
          </div>

          <div>
            <Label>Bio pública</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={sp?.bio ?? "Conte um pouco sobre você…"}
              rows={4}
            />
          </div>
          <Button onClick={saveProfile}>Salvar perfil</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" /> Verificação KYC
          </h2>
          {(kyc as any)?.status === "approved" ? (
            <div className="text-sm text-green-400">✓ Aprovado. Você pode anunciar.</div>
          ) : (kyc as any)?.status === "pending" ? (
            <div className="text-sm text-yellow-400">⏳ Em análise pelo time.</div>
          ) : (
            <>
              <div>
                <Label>Nome completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo de doc</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rg">RG</SelectItem>
                      <SelectItem value="cnh">CNH</SelectItem>
                      <SelectItem value="passport">Passaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Foto do documento</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <Label>Selfie segurando o documento</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <Button onClick={submitKyc} disabled={submitting} className="w-full">
                {submitting ? "Enviando…" : "Enviar para análise"}
              </Button>
              {(kyc as any)?.status === "rejected" && (
                <div className="text-sm text-red-400">Rejeitado: {(kyc as any).rejection_reason}</div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Premium status */}
      <Card className="bg-gradient-to-br from-yellow-500/5 to-orange-500/5 border-yellow-500/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <Crown className={`h-8 w-8 ${profile?.is_premium ? "text-yellow-500" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <h3 className="font-semibold">{profile?.is_premium ? "Plano Premium ativo" : "Plano Premium"}</h3>
              <p className="text-xs text-muted-foreground">
                {profile?.is_premium
                  ? profile.premium_until
                    ? `Válido até ${new Date(profile.premium_until).toLocaleDateString("pt-BR")}`
                    : "Acesso vitalício!"
                  : "Taxa zero de comissão, anúncios em destaque e suporte prioritário."}
              </p>
            </div>
            {!profile?.is_premium && (
              <Button size="sm" asChild>
                <Link to="/premium">
                  <Crown className="h-3 w-3" /> Assinar
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MyListingsTab() {
  const { user } = useAuth();
  const { data, refetch } = useQuery({
    queryKey: ["my-listings", user!.id],
    queryFn: async () =>
      (
        await supabase
          .from("listings")
          .select("*")
          .eq("seller_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  async function del(id: string) {
    if (!confirm("Excluir anúncio?")) return;
    await supabase.from("listings").delete().eq("id", id);
    refetch();
  }

  if (!data?.length)
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-2" />
          Você ainda não tem anúncios.
        </CardContent>
      </Card>
    );
  return (
    <div className="space-y-2">
      {data.map((l: any) => (
        <ListingItem key={l.id} listing={l} onDelete={del} onUpdate={refetch} />
      ))}
    </div>
  );
}

function ListingItem({ listing, onDelete, onUpdate }: { listing: any; onDelete: (id: string) => void; onUpdate: () => void }) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-16 w-16 rounded bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden shrink-0">
          {listing.cover_image_url && (
            <img src={listing.cover_image_url} alt="" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{listing.title}</div>
          <div className="text-xs text-muted-foreground">
            {brl(listing.price_cents)} ·{" "}
            <Badge variant="outline" className="text-xs">
              {listing.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowOptions(!showOptions)}>
            Opções
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDelete(listing.id)}>
            Excluir
          </Button>
        </div>
      </CardContent>
      {showOptions && <OptionsManager listingId={listing.id} onClose={() => setShowOptions(false)} />}
    </Card>
  );
}

function OptionsManager({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const { data: options, refetch } = useQuery({
    queryKey: ["listing-options-mgr", listingId],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch("/admin-api/list-options", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const json = await res.json();
      return json.options ?? [];
    },
  });

  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [adjustment, setAdjustment] = useState("0");

  async function addOption() {
    if (!label.trim()) return;
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const res = await fetch("/admin-api/create-option", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        listing_id: listingId,
        label,
        description: desc,
        price_adjustment_cents: Math.round((parseFloat(adjustment.replace(",", ".")) || 0) * 100),
      }),
    });
    if (res.ok) {
      toast.success("Opção adicionada!");
      setLabel("");
      setDesc("");
      setAdjustment("0");
      refetch();
    } else {
      const d = await res.json();
      toast.error(d.error ?? "Erro");
    }
  }

  async function removeOption(id: string) {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    await fetch("/admin-api/delete-option", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    refetch();
  }

  return (
    <div className="border-t border-white/10 p-4 space-y-3">
      <div className="text-sm font-semibold flex items-center justify-between">
        <span>Variações / Opções</span>
        <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
      </div>
      {options && options.length > 0 && (
        <div className="space-y-1">
          {options.map((o: any) => (
            <div key={o.id} className="flex items-center justify-between text-sm bg-white/5 rounded px-3 py-2">
              <div>
                <span className="font-medium">{o.label}</span>
                {o.description && <span className="text-muted-foreground ml-2">— {o.description}</span>}
                {o.price_adjustment_cents !== 0 && (
                  <span className={o.price_adjustment_cents > 0 ? "text-green-400 ml-2" : "text-red-400 ml-2"}>
                    {o.price_adjustment_cents > 0 ? "+" : ""}{brl(o.price_adjustment_cents)}
                  </span>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeOption(o.id)}>×</Button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
          placeholder="Nome da opção"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <input
          className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm"
          placeholder="Descrição (opcional)"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="bg-white/5 border border-white/10 rounded px-2 py-1 text-sm flex-1"
            placeholder="Ajuste R$"
            value={adjustment}
            onChange={(e) => setAdjustment(e.target.value)}
          />
          <Button size="sm" onClick={addOption}>+</Button>
        </div>
      </div>
    </div>
  );
}

function NewListingTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    short: "",
    description: "",
    price: "",
    gameId: "",
    category: "",
    delivery: "manual" as const,
    stock: "",
    unlimitedStock: false,
  });
  const [cover, setCover] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [newGameName, setNewGameName] = useState("");
  const [addingGame, setAddingGame] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: cats } = useQuery({
    queryKey: ["mp-cats"],
    queryFn: async () =>
      ((await (supabase as any).from("marketplace_categories").select("*").order("sort_order")).data ?? []) as any[],
  });
  const { data: games, refetch: refetchGames } = useQuery({
    queryKey: ["roblox-games"],
    queryFn: async () =>
      ((await (supabase as any).from("roblox_games").select("id, name, slug").order("name")).data ?? []) as any[],
  });
  const { data: sp } = useQuery({
    queryKey: ["my-seller", user!.id],
    queryFn: async () =>
      (await supabase.from("seller_profiles").select("*").eq("user_id", user!.id).maybeSingle())
        .data,
  });
  const { data: sellerProfile } = useQuery({
    queryKey: ["seller-premium-status", user!.id],
    queryFn: async () =>
      (await supabase.from("profiles").select("is_premium").eq("id", user!.id).maybeSingle()).data,
  });

  const priceCents = Math.round((parseFloat(form.price.replace(",", ".")) || 0) * 100);
  const isPremiumSeller = sellerProfile?.is_premium ?? false;
  const split = priceCents > 0 ? calcOrderSplit(priceCents, isPremiumSeller) : null;

  async function addNewGame() {
    const name = newGameName.trim();
    if (!name) return;
    setAddingGame(true);
    const { error } = await (supabase as any).from("roblox_games").insert({
      name,
      slug: slugify(name),
      created_by: user!.id,
    });
    setAddingGame(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Jogo adicionado!");
    setNewGameName("");
    refetchGames();
  }

  async function publish() {
    if (!(sp as any)?.verified) {
      toast.error("Você precisa ser verificado (KYC aprovado) para publicar.");
      return;
    }
    if (!form.title || !form.description || !form.category || priceCents <= 0) {
      toast.error("Preencha os obrigatórios");
      return;
    }
    setSaving(true);
    let coverUrl: string | null = null;
    if (cover) {
      const { data, error } = await supabase.storage
        .from("listing-media")
        .upload(`${user!.id}/${Date.now()}-${cover.name}`, cover);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
      coverUrl = supabase.storage.from("listing-media").getPublicUrl(data.path).data.publicUrl;
    }
    const slug = slugify(form.title);
    const { data: listing, error } = await (supabase as any).from("listings").insert({
      seller_id: user!.id,
      category_id: form.category,
      slug,
      title: form.title,
      short_description: form.short,
      description: form.description,
      roblox_game_id: form.gameId || null,
      price_cents: priceCents,
      delivery_type: form.delivery,
      cover_image_url: coverUrl,
      stock: form.unlimitedStock ? null : (parseInt(form.stock) || 1),
      unlimited_stock: form.unlimitedStock,
      status: "pending_review",
    }).select("id").single();
    if (error || !listing) {
      setSaving(false);
      toast.error(error?.message ?? "Erro ao criar");
      return;
    }
    // Upload gallery images
    for (const file of galleryFiles) {
      const path = `${user!.id}/${Date.now()}-${file.name}`;
      const { data: up } = await supabase.storage.from("listing-media").upload(path, file);
      if (up) {
        const url = supabase.storage.from("listing-media").getPublicUrl(up.path).data.publicUrl;
        await supabase.from("listing_images").insert({ listing_id: listing.id, url });
      }
    }
    setSaving(false);
    toast.success("Anúncio criado! Aguarde aprovação do admin.");
    router.navigate({ to: "/sell" });
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {!(sp as any)?.verified && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded p-3 text-sm">
            <FileWarning className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <span>
              Você precisa concluir a verificação KYC antes de publicar. Volte para a aba{" "}
              <strong>Perfil & KYC</strong>.
            </span>
          </div>
        )}
        <div>
          <Label>Título *</Label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Categoria *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {cats?.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Jogo</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={form.gameId} onValueChange={(v) => setForm({ ...form, gameId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um jogo" />
                  </SelectTrigger>
                  <SelectContent>
                    {games?.map((g: any) => (
                      <SelectItem key={g.id} value={g.id}>
                        <Gamepad2 className="h-3 w-3 inline mr-1" />{g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Adicionar novo jogo..."
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                className="text-xs"
              />
              <Button variant="outline" size="sm" onClick={addNewGame} disabled={addingGame || !newGameName.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        <div>
          <Label>Descrição curta</Label>
          <Input value={form.short} onChange={(e) => setForm({ ...form, short: e.target.value })} />
        </div>
        <div>
          <Label>Descrição completa *</Label>
          <Textarea
            rows={6}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Preço (R$) *</Label>
                <Input
                  type="text"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="10,00"
                />
              </div>
              <div>
                <Label>Tipo de entrega</Label>
                <Select
                  value={form.delivery}
                  onValueChange={(v) => setForm({ ...form, delivery: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual (combinado no chat)</SelectItem>
                    <SelectItem value="instant_code">Código instantâneo</SelectItem>
                    <SelectItem value="service">Serviço (combinado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Estoque</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  disabled={form.unlimitedStock}
                  placeholder="1"
                />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.unlimitedStock}
                onChange={(e) => setForm({ ...form, unlimitedStock: e.target.checked })}
                className="h-4 w-4"
              />
              <Infinity className="h-4 w-4 text-muted-foreground" /> Estoque ilimitado
            </label>
          </div>
        </div>
        <div>
          <Label>Imagem de capa</Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setCover(e.target.files?.[0] ?? null)}
          />
        </div>
        <div>
          <Label>Galeria de imagens (adicione várias fotos do produto)</Label>
          <Input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setGalleryFiles(Array.from(e.target.files ?? []))}
          />
          {galleryFiles.length > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              {galleryFiles.length} arquivo(s) selecionado(s)
            </div>
          )}
        </div>

        {split && (
          <>
          <div className="text-xs bg-white/5 rounded p-3 space-y-1">
            <div className="flex justify-between">
              <span>Preço cobrado do cliente</span>
              <span>{brl(split.total)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>− Taxa Stripe (~3-4%)</span>
              <span>−{brl(split.gateway)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>− Comissão plataforma ({Math.round(split.feePct * 100)}%)</span>
              <span>−{brl(split.platform)}</span>
            </div>
            <div className="flex justify-between font-semibold text-primary pt-1 border-t border-white/10">
              <span>Você recebe</span>
              <span>{brl(split.seller)}</span>
            </div>
          </div>
          {!isPremiumSeller && (
          <Link to="/premium" className="block">
            <div className="flex items-center gap-2 text-xs bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 rounded p-2 hover:border-yellow-500/40 transition-colors">
              <Crown className="h-4 w-4 text-yellow-500 shrink-0" />
              <span className="text-muted-foreground">Vire Premium e pague apenas <strong className="text-yellow-500">6% de comissão</strong> (em vez de 10%) + anúncios em destaque.</span>
            </div>
          </Link>
          )}
          </>
        )}

        <Button
          onClick={publish}
          disabled={saving || !(sp as any)?.verified}
          className="w-full bg-gradient-to-r from-primary to-accent text-white border-0"
        >
          <Plus className="h-4 w-4" /> {saving ? "Publicando…" : "Publicar anúncio"}
        </Button>
      </CardContent>
    </Card>
  );
}

function MySalesTab() {
  const { user } = useAuth();
  const { data: orders } = useQuery({
    queryKey: ["my-sales", user!.id],
    queryFn: async () =>
      (
        await supabase
          .from("marketplace_orders")
          .select("*, listing:listings(title, slug)")
          .eq("seller_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: listings } = useQuery({
    queryKey: ["my-listings-stats", user!.id],
    queryFn: async () =>
      (
        await supabase
          .from("listings")
          .select("id, title, slug, views, sales_count, rating")
          .eq("seller_id", user!.id)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const totalRevenue = orders?.reduce((s: number, o: any) => s + (o.amount_cents || 0), 0) ?? 0;
  const completedOrders = orders?.filter((o: any) => o.status === "released") ?? [];
  const totalFees = orders?.reduce((s: number, o: any) => s + (o.platform_fee_cents || 0) + (o.gateway_fee_cents || 0), 0) ?? 0;

  async function copyListingLink(slug: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/market/${slug}`);
    toast.success("Link copiado!");
  }

  return (
    <div className="space-y-4">
      {/* Metrics cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gradient-brand">{brl(totalRevenue)}</div>
            <div className="text-xs text-muted-foreground">Receita total (bruta)</div>
          </CardContent>
        </Card>
        <Card className="border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{orders?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">Pedidos</div>
          </CardContent>
        </Card>
        <Card className="border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{listings?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground">Anúncios ativos</div>
          </CardContent>
        </Card>
        <Card className="border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{brl(totalRevenue - totalFees)}</div>
            <div className="text-xs text-muted-foreground">Líquido estimado</div>
          </CardContent>
        </Card>
      </div>

      {/* Listing performance */}
      {listings && listings.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
              <Package className="h-4 w-4" /> Desempenho dos anúncios
            </h3>
            <div className="space-y-2">
              {listings.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0">
                  <div className="flex-1 min-w-0">
                    <Link to="/market/$slug" params={{ slug: l.slug }} className="font-medium truncate block hover:text-primary">
                      {l.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {l.views ?? 0} visualizações · {l.sales_count ?? 0} vendas · {Number(l.rating ?? 0).toFixed(1)}★
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {l.sales_count ? <span className="font-semibold text-xs">{l.sales_count} vendas</span> : null}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyListingLink(l.slug)} title="Copiar link">
                      <Share2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orders */}
      {orders && orders.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Histórico de pedidos</h3>
          <div className="space-y-2">
            {orders.map((o: any) => (
              <Link key={o.id} to="/market/orders/$id" params={{ id: o.id }}>
                <Card className="hover:border-primary/30">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">{o.listing?.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{brl(o.amount_cents)}</div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {o.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(!orders || orders.length === 0) && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2" />
            Sem vendas ainda. Compartilhe seus anúncios para aumentar o alcance!
          </CardContent>
        </Card>
      )}
    </div>
  );
}


