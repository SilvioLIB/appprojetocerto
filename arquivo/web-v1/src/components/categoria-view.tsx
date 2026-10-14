"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { categoriaPorId, operacoesDaCategoria } from "@/lib/operacoes";
import FormularioCalculo from "@/components/formulario-calculo";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLaudo } from "@/lib/laudo-store";
import { useMounted } from "@/lib/use-mounted";

export function CategoriaView({ categoriaId }: { categoriaId: string }) {
  const categoria = categoriaPorId(categoriaId);
  const operacoes = operacoesDaCategoria(categoriaId);
  const [selecionadaId, setSelecionadaId] = useState(operacoes[0]?.id);
  const montado = useMounted();
  const qtdLaudo = useLaudo((s) => s.itens.length);

  if (!categoria) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <p className="text-muted-foreground">Categoria não encontrada.</p>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-4" })}><ArrowLeft className="size-4" /> Voltar</Link>
      </div>
    );
  }

  const selecionada = operacoes.find((o) => o.id === selecionadaId) ?? operacoes[0];
  const Icon = categoria.icon;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold">{categoria.titulo}</h1>
            <p className="text-sm text-muted-foreground">{categoria.descricao}</p>
          </div>
        </div>
        <Link href="/laudo" className={buttonVariants({ variant: "outline" })}>
          <FileText className="size-4" /> Laudo{montado && qtdLaudo > 0 ? ` (${qtdLaudo})` : ""}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="flex flex-col gap-1.5">
          {operacoes.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelecionadaId(op.id)}
              className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                op.id === selecionada?.id
                  ? "border-primary bg-primary/5 font-semibold text-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              {op.titulo}
            </button>
          ))}
        </aside>

        <div>
          {selecionada && (
            <Card>
              <CardHeader>
                <CardTitle>{selecionada.titulo}</CardTitle>
                <CardDescription>{selecionada.descricao}</CardDescription>
              </CardHeader>
              <CardContent>
                <FormularioCalculo key={selecionada.id} op={selecionada} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
