import Link from "next/link";
import { FileText } from "lucide-react";

import FeaturesCards from "@/components/ui/feature-shader-cards";
import { AnimatedDrawer } from "@/components/ui/animated-drawer";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <div>
      <section className="border-b bg-gradient-to-br from-primary/10 via-background to-background px-4 py-16 text-center">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Cálculo mecânico de redes de distribuição
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Fluxo completo baseado na norma CPFL GED-3648: calcule cada item separadamente e,
            ao final, gere um laudo consolidado — pronto para exportar em PDF.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="#categorias" className={buttonVariants({ size: "lg" })}>
              Começar pelos cálculos
            </Link>
            <Link href="/laudo" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <FileText className="size-4" /> Ver laudo
            </Link>
          </div>
          <div className="flex justify-center">
            <AnimatedDrawer />
          </div>
        </div>
      </section>

      <div id="categorias">
        <FeaturesCards />
      </div>
    </div>
  );
}
