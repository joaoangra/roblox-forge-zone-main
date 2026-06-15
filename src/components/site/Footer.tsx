import { Link } from "@tanstack/react-router";
import { Code2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-4 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="grid h-12 w-12 place-items-center">
              <img
                src="/BuxHub.png"
                alt="BuxHub"
                className="h-12 w-12 object-contain"
              />
            </div>
            <span className="text-gradient-brand">BuxHub</span>
          </div>
          <p className="text-sm text-muted-foreground">A maior biblioteca premium de scripts e executores para Roblox.</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Plataforma</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/scripts" className="hover:text-foreground">Scripts</Link></li>
            <li><Link to="/executors" className="hover:text-foreground">Executores</Link></li>
            <li><Link to="/premium" className="hover:text-foreground">Premium</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Conta</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/auth" className="hover:text-foreground">Entrar</Link></li>
            <li><Link to="/dashboard" className="hover:text-foreground">Meu painel</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3 text-sm">Aviso</h4>
          <p className="text-xs text-muted-foreground">Não somos afiliados à Roblox Corporation. Use os scripts por sua conta e risco.</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BuxHub. Todos os direitos reservados.
      </div>
    </footer>
  );
}
