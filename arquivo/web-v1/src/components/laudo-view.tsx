"use client";

import { type ChangeEvent, useRef } from "react";
import Link from "next/link";
import { Download, Upload, Printer, Trash2, X, FileText, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useLaudo, type ProjetoExportado } from "@/lib/laudo-store";
import { categoriaPorId } from "@/lib/operacoes";
import { useMounted } from "@/lib/use-mounted";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

export function LaudoView() {
  const montado = useMounted();
  const { projeto, itens, setProjeto, removerItem, limpar, carregarProjeto, exportar } = useLaudo();
  const inputArquivo = useRef<HTMLInputElement>(null);

  const salvar = () => {
    const dados = exportar();
    const nome = (projeto.obra || "laudo").replace(/[^\w\-]+/g, "_").toLowerCase();
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}-ged3648.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Projeto salvo", { description: a.download });
  };

  const abrir = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      const dados = JSON.parse(await arquivo.text()) as ProjetoExportado;
      if (!dados || !Array.isArray(dados.itens)) throw new Error("formato inválido");
      carregarProjeto(dados);
      toast.success("Projeto carregado", { description: `${dados.itens.length} item(ns)` });
    } catch {
      toast.error("Arquivo inválido", { description: "Selecione um projeto exportado por esta ferramenta." });
    } finally {
      e.target.value = "";
    }
  };

  const limparTudo = () => {
    if (confirm("Limpar todos os dados do projeto e do laudo?")) {
      limpar();
      toast.success("Laudo limpo");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Barra de ações (não aparece na impressão) */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="size-6 text-primary" />
          <h1 className="text-2xl font-bold">Laudo de cálculo mecânico</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => inputArquivo.current?.click()}>
            <Upload className="size-4" /> Abrir
          </Button>
          <Button variant="outline" size="sm" onClick={salvar}><Download className="size-4" /> Salvar</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Exportar PDF</Button>
          <Button variant="outline" size="sm" onClick={limparTudo}><Trash2 className="size-4" /> Limpar</Button>
          <input ref={inputArquivo} type="file" accept="application/json,.json" className="hidden" onChange={abrir} />
        </div>
      </div>

      {/* Cabeçalho do laudo (impresso) */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-2xl font-bold">Laudo de Cálculo Mecânico — GED-3648</h1>
        <p className="text-sm text-muted-foreground">Norma CPFL de Projeto de Rede de Distribuição</p>
      </div>

      {/* Dados do projeto */}
      <section className="mb-8 rounded-xl border p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Dados do projeto</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="obra">Obra / projeto</Label>
            <Input id="obra" value={projeto.obra} onChange={(e) => setProjeto({ obra: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="responsavel">Responsável técnico</Label>
            <Input id="responsavel" value={projeto.responsavel} onChange={(e) => setProjeto({ responsavel: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="local">Local</Label>
            <Input id="local" value={projeto.local} onChange={(e) => setProjeto({ local: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="data">Data</Label>
            <Input id="data" type="date" value={projeto.data} onChange={(e) => setProjeto({ data: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" rows={2} value={projeto.observacoes} onChange={(e) => setProjeto({ observacoes: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Itens calculados */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Cálculos {montado && `(${itens.length})`}
          </h2>
        </div>

        {!montado ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : itens.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-muted-foreground">Nenhum cálculo adicionado ainda.</p>
            <Link href="/" className={buttonVariants({ variant: "outline", className: "mt-4 print:hidden" })}>
              <ArrowLeft className="size-4" /> Ir para os cálculos
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {itens.map((item, idx) => (
              <article key={item.id} className="break-inside-avoid rounded-xl border p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {idx + 1}. {categoriaPorId(item.categoria)?.titulo ?? item.categoria}
                    </span>
                    <h3 className="font-semibold">{item.titulo}</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="print:hidden" aria-label="Remover"
                    onClick={() => removerItem(item.id)}>
                    <X className="size-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Entradas</p>
                    <ul className="text-sm">
                      {item.entradas.map((e, i) => (
                        <li key={i} className="flex justify-between gap-3 py-0.5">
                          <span className="text-muted-foreground">{e.label}</span>
                          <span className="text-right font-medium">{e.valor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Resultados</p>
                    <ul className="text-sm">
                      {item.resultados.map((r, i) => (
                        <li key={i} className="flex justify-between gap-3 py-0.5">
                          <span className="text-muted-foreground">{r.rotulo}</span>
                          <span className={`text-right tabular-nums font-semibold ${r.destaque ? "text-green-600 dark:text-green-400" : ""}`}>
                            {r.valor}{r.unidade ? ` ${r.unidade}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {montado && itens.length > 0 && (
        <>
          <Separator className="my-8" />
          <p className="text-center text-xs text-muted-foreground">
            Documento gerado como apoio ao projeto. Os valores devem ser conferidos com a norma
            GED-3648 vigente e sob responsabilidade técnica do projetista.
          </p>
        </>
      )}
    </div>
  );
}
