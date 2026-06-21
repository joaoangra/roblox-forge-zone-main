import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/site/PageShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ShieldCheck,
  ShieldAlert,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowLeft,
  FileText,
  Camera,
  UserCheck,
  IdCard,
  Calendar,
  Hash,
  Eye,
  EyeOff,
} from "lucide-react";

export const Route = createFileRoute("/kyc")({
  head: () => ({ meta: [{ title: "Verificação KYC — BuxHub" }] }),
  component: KYCPage,
});

function KYCPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.navigate({ to: "/auth" });
  }, [loading, user, router]);
  if (!user) return null;

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/sell" className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-primary" />
              Verificação KYC
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Envie seus documentos para se tornar um vendedor verificado na BuxHub.
              Sua segurança é nossa prioridade.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <KYCSubmissionForm />
          </div>
          <div>
            <KYCInfoSidebar />
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function KYCInfoSidebar() {
  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Por que verificar?
          </h3>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
              <span>Anúncios ilimitados</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
              <span>Comissão reduzida de 6%</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
              <span>Liberação em 7 dias</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
              <span>Badge de vendedor verificado</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
              <span>Mais confiança dos compradores</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Requisitos
          </h3>
          <ul className="text-xs text-muted-foreground space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              <span>Documento nítido, sem blur ou cortes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              <span>Selfie segurando o documento ao lado do rosto</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              <span>Sem filtros ou edições nas fotos</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              <span>CPF válido e compatível com o documento</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              <span>Nome igual ao do documento oficial</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card className="border-white/10">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-semibold flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-green-500" />
            Segurança
          </h3>
          <p className="text-xs text-muted-foreground">
            Seus documentos são armazenados com segurança e criptografados.
            Apenas administradores autorizados podem visualizá-los.
            Nenhum documento é exposto publicamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KYCSubmissionForm() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: existingVerification, isLoading: checkLoading } = useQuery({
    queryKey: ["my-kyc-status", user!.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("seller_verification")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [documentType, setDocumentType] = useState("rg");
  const [docFrontFile, setDocFrontFile] = useState<File | null>(null);
  const [docFrontPreview, setDocFrontPreview] = useState<string | null>(null);
  const [docBackFile, setDocBackFile] = useState<File | null>(null);
  const [docBackPreview, setDocBackPreview] = useState<string | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (existingVerification && existingVerification.status !== "rejected") {
      const prev = existingVerification;
      setFullName(prev.full_name || "");
      setCpf(prev.cpf || "");
      setBirthDate(prev.birth_date ? prev.birth_date.slice(0, 10) : "");
      setDocumentType(prev.document_type || "rg");
    }
  }, [existingVerification]);

  const handleFileSelect = (
    file: File | null,
    setFile: (f: File | null) => void,
    setPreview: (url: string | null) => void,
  ) => {
    if (!file) { setFile(null); setPreview(null); return; }
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas (JPEG, PNG)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 10MB");
      return;
    }
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  async function submitKYC() {
    if (!fullName.trim() || !cpf.trim() || !birthDate || !docFrontFile || !selfieFile) {
      toast.error("Preencha todos os campos obrigatórios e anexe os documentos.");
      return;
    }
    if (!agreeTerms) {
      toast.error("Você precisa concordar com os termos.");
      return;
    }
    setSubmitting(true);
    const ts = Date.now();
    const folder = `${user!.id}/${ts}`;

    try {
      const uploads = await Promise.all([
        supabase.storage.from("kyc-docs").upload(`${folder}/front-${docFrontFile.name}`, docFrontFile),
        docBackFile
          ? supabase.storage.from("kyc-docs").upload(`${folder}/back-${docBackFile.name}`, docBackFile)
          : { data: null, error: null },
        supabase.storage.from("kyc-docs").upload(`${folder}/selfie-${selfieFile.name}`, selfieFile),
      ]);

      const frontUpload = uploads[0];
      const backUpload = uploads[1];
      const selfieUpload = uploads[2];

      if (frontUpload.error || selfieUpload.error) {
        toast.error("Falha no upload das imagens. Tente novamente.");
        setSubmitting(false);
        return;
      }

      const frontPath = frontUpload.data!.path;
      const backPath = backUpload.data?.path ?? "";
      const selfiePath = selfieUpload.data!.path;

      const { error } = await (supabase as any).from("seller_verification").insert({
        user_id: user!.id,
        full_name: fullName.trim(),
        cpf: cpf.replace(/\D/g, ""),
        birth_date: birthDate,
        document_type: documentType,
        document_front_url: frontPath,
        document_back_url: backPath || null,
        selfie_url: selfiePath,
        status: "pending",
      });

      if (error) {
        toast.error(error.message);
        setSubmitting(false);
        return;
      }

      toast.success("Documentos enviados com sucesso! Aguarde a análise da equipe.");
      qc.invalidateQueries({ queryKey: ["my-kyc-status"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar documentos");
    }
    setSubmitting(false);
  }

  if (checkLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">Carregando...</CardContent>
      </Card>
    );
  }

  if (existingVerification?.status === "approved") {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-8 text-center space-y-3">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-green-500">Verificação Aprovada!</h2>
          <p className="text-sm text-muted-foreground">
            Você é um vendedor verificado na BuxHub. Aproveite todos os benefícios.
          </p>
          <Button asChild>
            <Link to="/sell">Ir para o Painel</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (existingVerification?.status === "pending") {
    const riskScore = existingVerification.risk_score ?? 0;
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-8 text-center space-y-3">
          <Clock className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-bold">Análise em Andamento</h2>
          <p className="text-sm text-muted-foreground">
            Seus documentos foram enviados e estão sendo analisados pela equipe.
            Este processo pode levar até 48 horas úteis.
          </p>
          {riskScore > 0 && (
            <div className="inline-flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Score de risco: {riskScore}/100
              {riskScore <= 30 && <span className="text-green-500">— Baixo risco</span>}
              {riskScore > 30 && riskScore <= 70 && <span className="text-amber-500">— Médio risco</span>}
              {riskScore > 70 && <span className="text-red-500">— Alto risco</span>}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  if (existingVerification?.status === "banned") {
    return (
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="p-8 text-center space-y-3">
          <XCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold text-red-500">Conta Suspensa</h2>
          <p className="text-sm text-muted-foreground">
            Sua solicitação de verificação foi revisada e não pôde ser aprovada.
            Entre em contato com o suporte para mais informações.
          </p>
          <Button asChild variant="outline">
            <Link to="/support">Falar com Suporte</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isRejected = existingVerification?.status === "rejected";
  const rejectReason = existingVerification?.admin_notes;

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        {isRejected && (
          <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm text-red-500">Verificação Rejeitada</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {rejectReason || "Sua solicitação anterior foi rejeitada. Corrija os problemas e envie novamente."}
              </p>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setStep(s)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                step === s ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <span className={`h-6 w-6 rounded-full grid place-items-center text-xs font-bold ${
                step === s ? "bg-primary text-white" : "bg-white/10"
              }`}>{s}</span>
              <span className="hidden sm:inline">
                {s === 1 ? "Dados" : s === 2 ? "Documentos" : "Revisão"}
              </span>
            </button>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              Dados Pessoais
            </h3>
            <div>
              <Label>Nome completo *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Como consta no documento"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF *</Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                />
              </div>
              <div>
                <Label>Data de nascimento *</Label>
                <Input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Tipo de documento *</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
              >
                <option value="rg">RG (Carteira de Identidade)</option>
                <option value="cnh">CNH (Carteira de Motorista)</option>
                <option value="passport">Passaporte</option>
              </select>
            </div>
            <Button onClick={() => setStep(2)} className="w-full">
              Próximo: Documentos
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Upload de Documentos
            </h3>

            <div className="grid sm:grid-cols-2 gap-4">
              {/* Front */}
              <div>
                <Label>Frente do documento *</Label>
                <div
                  className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-primary/50 ${
                    docFrontPreview ? "border-green-500/50" : "border-white/20"
                  }`}
                  onClick={() => document.getElementById("doc-front-input")?.click()}
                >
                  {docFrontPreview ? (
                    <div className="relative group">
                      <img src={docFrontPreview} alt="Frente do documento" className="max-h-40 mx-auto rounded" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <span className="text-xs text-white">Clique para trocar</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Clique para selecionar</p>
                      <p className="text-[10px] text-muted-foreground mt-1">JPEG ou PNG, até 10MB</p>
                    </div>
                  )}
                  <input
                    id="doc-front-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null, setDocFrontFile, setDocFrontPreview)}
                  />
                </div>
              </div>

              {/* Back */}
              <div>
                <Label>Verso do documento</Label>
                <div
                  className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-primary/50 ${
                    docBackPreview ? "border-green-500/50" : "border-white/20"
                  }`}
                  onClick={() => document.getElementById("doc-back-input")?.click()}
                >
                  {docBackPreview ? (
                    <div className="relative group">
                      <img src={docBackPreview} alt="Verso do documento" className="max-h-40 mx-auto rounded" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                        <span className="text-xs text-white">Clique para trocar</span>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Opcional, mas recomendado</p>
                    </div>
                  )}
                  <input
                    id="doc-back-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null, setDocBackFile, setDocBackPreview)}
                  />
                </div>
              </div>
            </div>

            {/* Selfie */}
            <div>
              <Label>Selfie segurando o documento *</Label>
              <div
                className={`mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:border-primary/50 ${
                  selfiePreview ? "border-green-500/50" : "border-white/20"
                }`}
                onClick={() => document.getElementById("selfie-input")?.click()}
              >
                {selfiePreview ? (
                  <div className="relative group max-w-xs mx-auto">
                    <img src={selfiePreview} alt="Selfie com documento" className="max-h-48 mx-auto rounded" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex items-center justify-center">
                      <span className="text-xs text-white">Clique para trocar</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-8">
                    <Camera className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Tire uma selfie segurando o documento ao lado do rosto
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">JPEG ou PNG, até 10MB</p>
                  </div>
                )}
                <input
                  id="selfie-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null, setSelfieFile, setSelfiePreview)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={() => setStep(3)} className="flex-1" disabled={!docFrontFile || !selfieFile}>
                Revisar e Enviar
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Revisar Informações
            </h3>

            <Card className="border-white/10 bg-white/5">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPF</span>
                  <span className="font-medium">{cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nascimento</span>
                  <span className="font-medium">{birthDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documento</span>
                  <span className="font-medium capitalize">{documentType}</span>
                </div>
              </CardContent>
            </Card>

            {/* Preview toggler */}
            <div className="space-y-2">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="w-full">
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? "Ocultar imagens" : "Visualizar imagens enviadas"}
              </Button>
              {showPreview && (
                <div className="grid grid-cols-3 gap-2">
                  {docFrontPreview && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Frente</p>
                      <img src={docFrontPreview} alt="" className="rounded border border-white/10 max-h-32" />
                    </div>
                  )}
                  {docBackPreview && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Verso</p>
                      <img src={docBackPreview} alt="" className="rounded border border-white/10 max-h-32" />
                    </div>
                  )}
                  {selfiePreview && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Selfie</p>
                      <img src={selfiePreview} alt="" className="rounded border border-white/10 max-h-32" />
                    </div>
                  )}
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="h-4 w-4 mt-0.5"
              />
              <span className="text-muted-foreground">
                Declaro que as informações fornecidas são verdadeiras e que os documentos
                enviados são autênticos. Estou ciente que a falsificação de documentos
                resultará em banimento permanente da plataforma.
              </span>
            </label>

            <p className="text-xs text-muted-foreground">
              Ao enviar, você concorda com a verificação dos seus dados pela equipe BuxHub.
              Seus documentos ficarão armazenados de forma segura e apenas administradores
              terão acesso.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
              <Button
                onClick={submitKYC}
                disabled={submitting || !agreeTerms}
                className="flex-1 bg-gradient-to-r from-primary to-accent text-white border-0"
              >
                {submitting ? "Enviando..." : existingVerification?.status === "rejected" ? "Reenviar para Análise" : "Enviar para Análise"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
