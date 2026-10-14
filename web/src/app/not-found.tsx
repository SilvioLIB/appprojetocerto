import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NaoEncontrado() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start px-4 py-24">
      <p className="font-mono text-sm text-primary tabular-nums">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Esta página não existe</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O endereço pode estar errado ou ter saído do site. A calculadora por categorias e o laudo avulso foram
        substituídos pelo projeto guiado.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/projeto" className={buttonVariants()}>
          Abrir o projeto
        </Link>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
