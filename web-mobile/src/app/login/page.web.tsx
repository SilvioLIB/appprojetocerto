import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { FaixaMarca, PainelMarca } from "@/components/auth/painel-marca";
import { ThemeToggle } from "@/components/theme-toggle";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { title: "Entrar" };

const ENTRADA = "animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both motion-reduce:animate-none";

// Tipo explícito em vez de PageProps<"/login">: o gerador de rotas tipadas do
// Next não registra páginas com extensão composta (page.web.tsx).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { proximo } = await searchParams;
  const destino = typeof proximo === "string" ? proximo : undefined;

  return (
    <div className="relative min-h-svh lg:grid lg:grid-cols-2">
      <PainelMarca />

      <div className="relative flex min-h-svh flex-col px-6 pt-16 pb-10 sm:px-8 lg:justify-center lg:py-16">
        <div className="absolute top-4 right-4 z-10">
          <ThemeToggle />
        </div>

        <FaixaMarca />

        <div className="mx-auto w-full max-w-sm space-y-8">

          <div className="space-y-2">
            <h1 className={`font-display text-4xl font-semibold tracking-tight [font-stretch:108%] ${ENTRADA}`} style={{ animationDelay: "60ms" }}>
              Entrar
            </h1>
            <p className={`text-sm text-muted-foreground ${ENTRADA}`} style={{ animationDelay: "120ms" }}>
              Acesse seus projetos de rede. O acesso é liberado pelo responsável do {SITE.nome}.
            </p>
          </div>

          <div className={ENTRADA} style={{ animationDelay: "180ms" }}>
            <LoginForm proximo={destino} />
          </div>

          <p className={`text-xs text-muted-foreground ${ENTRADA}`} style={{ animationDelay: "240ms" }}>
            Ferramenta de apoio ao projetista. Cálculos conforme a <span className="whitespace-nowrap">{SITE.normaReferencia}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
