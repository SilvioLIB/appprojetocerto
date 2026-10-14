"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";

export default function Erro({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start px-4 py-24">
      <p className="font-mono text-sm text-destructive">Erro</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">A página parou de responder</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        O projeto salvo neste navegador não foi apagado. Tente de novo; se o erro voltar, baixe uma cópia do projeto no
        painel antes de continuar.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">Código: {error.digest}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button onClick={() => retry()}>Tentar de novo</Button>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          Voltar ao painel
        </Link>
      </div>
    </div>
  );
}
