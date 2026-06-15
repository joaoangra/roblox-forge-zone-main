import { createFileRoute, useRouter, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { PageShell } from "@/components/site/PageShell";
import { toast } from "sonner";

const searchSchema = z.object({ mode: z.enum(["signin", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Entrar – BuxHub" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initial ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username, display_name: username },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já está logado.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
      }
      await refresh();
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-md px-4 py-16">
        <Card className="glass border-white/10">
          <CardContent className="p-8">
            <div className="flex flex-col items-center mb-6">
              <div className="grid h-16 w-16 place-items-center mb-3">
                <img
                  src="/BuxHub.png"
                  alt="BuxHub"
                  className="h-full w-full object-contain rounded-xl"
                />
              </div>

              <h1 className="text-2xl font-bold">{mode === "signin" ? "Entrar" : "Criar conta"}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "signin"
                  ? "Acesse sua conta para continuar"
                  : "Junte-se à plataforma em segundos"}
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div>
                  <Label htmlFor="username">Nome de usuário</Label>
                  <Input
                    id="username"
                    required
                    minLength={3}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="seunick"
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="password">Senha</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary to-accent text-white border-0"
              >
                {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground mt-6">
              {mode === "signin" ? (
                <>
                  Não tem conta?{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setMode("signup")}
                  >
                    Criar agora
                  </button>
                </>
              ) : (
                <>
                  Já tem conta?{" "}
                  <button
                    className="text-primary hover:underline"
                    onClick={() => setMode("signin")}
                  >
                    Entrar
                  </button>
                </>
              )}
            </div>
            <div className="text-center text-xs text-muted-foreground mt-4">
              <Link to="/" className="hover:text-foreground">
                ← Voltar ao início
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
