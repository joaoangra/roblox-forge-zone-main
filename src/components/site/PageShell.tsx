import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {/* spacer removed: header is sticky and should not overlap */}
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
