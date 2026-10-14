import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { ESTRUTURAS } from "@/lib/dimensionamento";
import { CATEGORIAS_SIMBOLO, REFERENCIA_SIMBOLOGIA, SIMBOLOS_ATIVOS, SIMBOLOS_STANDBY } from "@/lib/simbologia";
import { buttonVariants } from "@/components/ui/button";
import { SimboloNDU } from "@/components/simbologia/simbolo-ndu";

export const metadata: Metadata = {
  title: "Como usar",
  description: "Guia do projeto guiado: etapas, tipos de estrutura, normas e serviços externos consultados.",
};

const SECOES = [
  { id: "etapas", rotulo: "Etapas do projeto" },
  { id: "estruturas", rotulo: "Tipos de estrutura" },
  { id: "simbologia", rotulo: "Simbologia" },
  { id: "normas", rotulo: "Normas de referência" },
  { id: "dados", rotulo: "Onde ficam os dados" },
  { id: "servicos", rotulo: "Serviços externos" },
  { id: "limites", rotulo: "Limites da ferramenta" },
];

function Secao({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-t pt-8">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export default function AjudaPage() {
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-8 md:py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Nesta página" className="hidden lg:block">
        <ul className="sticky top-24 flex flex-col gap-1 text-sm">
          {SECOES.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                {s.rotulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <article className="flex max-w-3xl flex-col gap-8">
        <header>
          <h1 className="font-display text-3xl font-semibold tracking-tight [font-stretch:108%]">Como usar</h1>
          <p className="mt-2 text-muted-foreground">
            O projeto guiado dimensiona os postes de uma obra em sequência. O que vale para a obra toda é definido uma
            vez, na abertura; cada poste herda essas escolhas.
          </p>
        </header>

        {/* Índice no celular/tablet (no desktop fica na coluna lateral). */}
        <nav aria-label="Nesta página" className="-mx-4 -mt-2 overflow-x-auto px-4 lg:hidden">
          <ul className="flex min-w-max gap-2">
            {SECOES.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="block rounded-full bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border hover:text-foreground"
                >
                  {s.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Secao id="etapas" titulo="Etapas do projeto">
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            <li>
              <strong>Abertura.</strong> Projetista, obra, coordenada do ponto (define o vento pela NBR 6123) e condutor.
              Opcionalmente, pontos de derivação e entrega para estimar a extensão da linha, a quantidade de postes e o
              clima da região. Ao clicar em <strong>Iniciar projeto</strong>, vento e condutor ficam travados.
            </li>
            <li>
              <strong>Postes.</strong> Para cada poste escolha o tipo de estrutura, o poste (tipo, altura, Rn) e o vão. O
              esforço é comparado com a resistência nominal; se passar do limiar, dá para recalcular com estai.
            </li>
            <li>
              <strong>Memorial.</strong> Em <strong>Concluir projeto</strong>, todos os postes são reunidos num memorial
              de cálculo. Use a impressão do navegador para gerar o PDF — sai sempre em tema claro.
            </li>
          </ol>
        </Secao>

        <Secao id="estruturas" titulo="Tipos de estrutura">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {ESTRUTURAS.map((e) => (
              <div key={e.id}>
                <dt className="font-medium text-foreground">{e.label}</dt>
                <dd>{e.descricao}</dd>
              </div>
            ))}
          </dl>
          <p>
            Nos postes calculados, o esforço soma o vento no poste e nos condutores com a{" "}
            <strong>tração de projeto</strong> dos cabos: nos ângulos entra a resultante T · 2·sen(α/2); na derivação
            e no fim de linha a tração fica sem contrapeso e se combina com o vento. Em alinhamento (α = 0) as trações
            se anulam. Postes com transformador e de amarração têm esforço <strong>especificado</strong> por tabela.
          </p>
        </Secao>

        <Secao id="simbologia" titulo="Simbologia">
          <p>
            Elementos de projeto identificados pela <strong>{REFERENCIA_SIMBOLOGIA}</strong>. Aparecem aqui só os que
            a ferramenta já trata; os outros {SIMBOLOS_STANDBY.length} símbolos da norma estão catalogados e entram
            conforme forem implementados.
          </p>
          <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {SIMBOLOS_ATIVOS.map((s) => (
              <li key={s.id} className="flex items-center gap-3">
                <span className="flex w-12 shrink-0 justify-center text-foreground">
                  <SimboloNDU id={s.id} />
                </span>
                <span className="min-w-0">
                  <span className="block text-foreground">{s.descricao}</span>
                  <span className="block text-xs">
                    {CATEGORIAS_SIMBOLO[s.categoria]} · {s.vinculo}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Secao>

        <Secao id="normas" titulo="Normas de referência">
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li><strong>CPFL GED-3648</strong> — Projeto de rede de distribuição: cálculo mecânico.</li>
            <li><strong>ABNT NBR 6123</strong> — Forças devidas ao vento (V0 pelas isopletas, por coordenada).</li>
            <li><strong>ABNT NBR 8451</strong> — Postes de concreto para redes de distribuição.</li>
            <li><strong>ABNT NBR 5419-2</strong> — Densidade de descargas atmosféricas (Ng), só informativo.</li>
          </ul>
        </Secao>

        <Secao id="dados" titulo="Onde ficam os dados">
          <p>
            O projeto é salvo <strong>apenas no navegador deste aparelho</strong>. Recarregar a página não perde nada,
            mas limpar os dados do site, usar aba anônima ou trocar de computador sim.
          </p>
          <p>
            No <Link href="/" className="text-primary underline-offset-4 hover:underline">Painel</Link>, use{" "}
            <strong>Baixar cópia</strong> para guardar o projeto num arquivo .json e <strong>Abrir cópia</strong> para
            retomá-lo em outro aparelho. Há um projeto ativo por vez.
          </p>
        </Secao>

        <Secao id="servicos" titulo="Serviços externos">
          <p>Os cálculos rodam no próprio navegador. Só estas consultas saem para a internet, e só quando você pede:</p>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            <li><strong>OSRM / OpenStreetMap</strong> — extensão da linha. Sem conexão, usa a reta × fator de sinuosidade.</li>
            <li><strong>Nominatim / OpenStreetMap</strong> — município da coordenada, para achar o Ng.</li>
            <li><strong>Open-Meteo (ERA5)</strong> — temperaturas típicas da região.</li>
          </ul>
          <p>
            <strong>Usar minha localização</strong> precisa de conexão segura (HTTPS). Acessando pelo IP da rede local
            em http://, o navegador bloqueia o GPS.
          </p>
        </Secao>

        <Secao id="limites" titulo="Limites da ferramenta">
          <p>
            É uma ferramenta de apoio. Confira os resultados com a norma vigente; a responsabilidade técnica é do
            projetista.
          </p>
        </Secao>

        <div className="border-t pt-8">
          <Link href="/projeto" className={buttonVariants({ size: "lg" })}>
            Ir para o projeto <ArrowRight className="size-4" />
          </Link>
        </div>
      </article>
    </div>
  );
}
