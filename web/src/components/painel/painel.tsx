"use client";

import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  Cable,
  Check,
  ClipboardList,
  Download,
  FileText,
  FolderOpen,
  Gauge,
  HardDrive,
  Plus,
  Route,
  Waypoints,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { useMounted } from "@/lib/use-mounted";
import { useProjetoV2, type FaseProjeto, type PosteProjeto } from "@/lib/projeto-v2-store";
import { abrirProjeto, baixarProjeto } from "@/lib/projeto-arquivo";
import { fmt } from "@/lib/dimensionamento";
import { Button, buttonVariants } from "@/components/ui/button";
import { MedidorUtilizacao, tomUtilizacao } from "@/components/v2/medidor-utilizacao";
import { LinhaResumo } from "./linha-resumo";

/* -------------------------------------------------------------------------
   Peças de layout (bento adaptado do "Stats Bento" do 21st.dev)
   ------------------------------------------------------------------------- */

/** Bloco do bento. */
function Bloco({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`relative overflow-hidden rounded-2xl bg-card p-5 ring-1 ring-foreground/10 ${className}`}>{children}</div>;
}

/**
 * Hachura de corte, como a de desenho técnico — some em degradê a partir do
 * canto superior direito. Só textura: não carrega informação.
 */
function Hachura() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,var(--color-primary)_0px,var(--color-primary)_1px,transparent_1px,transparent_9px)] opacity-[0.14] [mask-image:radial-gradient(ellipse_55%_70%_at_100%_0%,#000_30%,transparent_100%)] dark:opacity-20"
    />
  );
}

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">{children}</p>;
}

/* -------------------------------------------------------------------------
   Blocos de dados
   ------------------------------------------------------------------------- */

const UTIL_MAX = 1.5; // topo do gráfico = 150 % do Rn

function especificado(p: PosteProjeto): boolean {
  return p.memoria.especTrafo != null || p.memoria.especAmarracao != null;
}

/** Utilização de cada poste (esforço ÷ Rn) em barras, com a referência de 100 %. */
function UtilizacaoPostes({ postes }: { postes: PosteProjeto[] }) {
  const calculados = postes.filter((p) => !especificado(p));
  const maior = calculados.reduce((m, p) => Math.max(m, p.memoria.utilizacaoEfetiva), 0);
  const ref = (1 / UTIL_MAX) * 100;

  return (
    <Bloco className="col-span-2">
      <div className="flex items-baseline justify-between gap-2">
        <Rotulo>Utilização por poste</Rotulo>
        {calculados.length > 0 && (
          <span className="font-mono text-xs text-muted-foreground tabular-nums">máx. {fmt(maior * 100, 0)}%</span>
        )}
      </div>

      {postes.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">As barras aparecem conforme os postes são lançados.</p>
      ) : (
        <div className="relative mt-4 h-20">
          {/* referência: 100 % do Rn */}
          <div className="absolute inset-x-0 border-t border-dashed border-destructive/50" style={{ bottom: `${ref}%` }}>
            <span className="absolute -top-4 right-0 font-mono text-[10px] text-destructive/80">100%</span>
          </div>
          <div className="flex h-full items-end gap-1">
            {postes.map((p, i) => {
              const esp = especificado(p);
              const u = p.memoria.utilizacaoEfetiva;
              const altura = esp ? 100 : Math.max(4, (Math.min(u, UTIL_MAX) / UTIL_MAX) * 100);
              const n = String(i + 1).padStart(2, "0");
              return (
                <div
                  key={p.id}
                  title={esp ? `Poste ${n} — especificado por tabela` : `Poste ${n} — ${fmt(u * 100, 1)}% do Rn`}
                  className={`barra-crescer min-w-1 flex-1 origin-bottom rounded-sm ${
                    esp
                      ? "border border-dashed border-primary/50 bg-primary/10"
                      : tomUtilizacao(u * 100, p.memoria.limiarPct, p.memoria.aprovado).fundo
                  }`}
                  style={{ height: `${altura}%`, animationDelay: `${i * 40}ms` }}
                />
              );
            })}
          </div>
        </div>
      )}
      {postes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-green-600 dark:bg-green-500" /> com folga
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-amber-500" /> perto do limite
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-destructive" /> acima
          </li>
          {postes.some(especificado) && (
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-sm border border-dashed border-primary/50 bg-primary/10" /> especificado
            </li>
          )}
        </ul>
      )}
    </Bloco>
  );
}

/**
 * Situação da linha — mesmo quadro do memorial: medidor do poste mais
 * solicitado (entre os verificados por vento) e composição aprovados / a rever
 * / especificados.
 */
function SituacaoLinha({ postes }: { postes: PosteProjeto[] }) {
  const n = postes.length;
  let aprovados = 0;
  let rever = 0;
  let especificados = 0;
  let maior: { p: PosteProjeto; i: number } | null = null;
  for (const [i, p] of postes.entries()) {
    if (especificado(p)) {
      especificados++;
      continue;
    }
    if (p.memoria.aprovado) aprovados++;
    else rever++;
    if (!maior || p.memoria.utilizacaoEfetiva > maior.p.memoria.utilizacaoEfetiva) maior = { p, i };
  }
  const m = maior;

  return (
    <Bloco className="col-span-2">
      <div className="flex items-start justify-between gap-3">
        <Rotulo>Situação da linha</Rotulo>
        <Ladrilho icone={rever > 0 ? AlertTriangle : Waypoints} tom={rever > 0 ? "alerta" : "neutro"} />
      </div>
      <div className="mt-2 flex items-center gap-4">
        {m ? (
          <MedidorUtilizacao
            utilizacaoPct={m.p.memoria.utilizacaoEfetiva * 100}
            limiarPct={m.p.memoria.limiarPct}
            aprovado={m.p.memoria.aprovado}
            rotulo={`maior · P${String(m.i + 1).padStart(2, "0")}`}
            className="w-32"
          />
        ) : (
          <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Gauge className="size-7" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{n}</p>
          <p className="text-xs text-muted-foreground">
            {n === 0 ? "Nenhum lançado ainda" : n === 1 ? "poste lançado" : "postes lançados"}
          </p>
        </div>
      </div>
      {n > 0 && (
        <>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <span className="bg-green-600 dark:bg-green-500" style={{ width: `${(aprovados / n) * 100}%` }} />
            <span className="bg-destructive" style={{ width: `${(rever / n) * 100}%` }} />
            <span className="bg-primary/60" style={{ width: `${(especificados / n) * 100}%` }} />
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <li className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green-600 dark:bg-green-500" />
              <span className="font-semibold tabular-nums">{aprovados}</span>
              <span className="text-muted-foreground">aprovados</span>
            </li>
            {rever > 0 && (
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive" />
                <span className="font-semibold text-destructive tabular-nums">{rever}</span>
                <span className="text-muted-foreground">a rever</span>
              </li>
            )}
            {especificados > 0 && (
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary/60" />
                <span className="font-semibold tabular-nums">{especificados}</span>
                <span className="text-muted-foreground">especificados</span>
              </li>
            )}
          </ul>
        </>
      )}
    </Bloco>
  );
}

/** Ícone em ladrilho colorido — o mesmo dos indicadores do memorial. */
function Ladrilho({ icone: Icone, tom = "neutro" }: { icone: LucideIcon; tom?: "neutro" | "vento" | "alerta" }) {
  const cor =
    tom === "vento"
      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : tom === "alerta"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  return (
    <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${cor}`}>
      <Icone className="size-4" />
    </span>
  );
}

function Indicador({
  icone, rotulo, valor, detalhe, destaque = false, tom = "neutro", className = "col-span-2",
}: {
  icone: LucideIcon;
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  /** Número em corpo maior — o dado principal do bloco. */
  destaque?: boolean;
  tom?: "neutro" | "vento";
  className?: string;
}) {
  return (
    <Bloco className={`${className} md:col-span-2`}>
      <div className="flex items-start justify-between gap-3">
        <Rotulo>{rotulo}</Rotulo>
        <Ladrilho icone={icone} tom={tom} />
      </div>
      <p
        className={`mt-3 truncate font-semibold tracking-tight tabular-nums ${destaque ? "text-4xl" : "text-xl sm:text-2xl"} ${
          tom === "vento" ? "text-sky-700 dark:text-sky-300" : ""
        }`}
      >
        {valor}
      </p>
      {detalhe && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detalhe}</p>}
    </Bloco>
  );
}

/* -------------------------------------------------------------------------
   Etapas (linha do tempo adaptada do "Tracker Card" do 21st.dev)
   ------------------------------------------------------------------------- */

const ORDEM: FaseProjeto[] = ["abertura", "postes", "concluido"];

function Etapas() {
  const s = useProjetoV2();
  const atual = ORDEM.indexOf(s.fase);
  const iniciou = s.iniciadoEm != null;

  const itens: { icone: LucideIcon; titulo: string; detalhe: string }[] = [
    {
      icone: ClipboardList,
      titulo: "Abertura",
      detalhe: iniciou
        ? `Iniciada em ${new Date(s.iniciadoEm!).toLocaleDateString("pt-BR")} — vento e condutor travados.`
        : "Projetista, obra, coordenada do vento e condutor.",
    },
    {
      icone: Waypoints,
      titulo: "Postes",
      detalhe:
        s.postes.length > 0
          ? `${s.postes.length} ${s.postes.length === 1 ? "poste lançado" : "postes lançados"}, verificados contra o Rn.`
          : "Um por vez: estrutura, poste e vão.",
    },
    {
      icone: FileText,
      titulo: "Memorial",
      detalhe: s.fase === "concluido" ? "Pronto — imprima em PDF pela tela do projeto." : "Reúne todos os postes ao concluir.",
    },
  ];

  return (
    <Bloco>
      <Rotulo>Etapas</Rotulo>
      <ol className="mt-4">
        {itens.map((it, i) => {
          const feito = i < atual;
          const agora = i === atual;
          const ultimo = i === itens.length - 1;
          return (
            <li key={it.titulo} aria-current={agora ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
              {/* fio de cobre: trilho + trecho já percorrido, que cresce de cima */}
              {!ultimo && (
                <>
                  <span aria-hidden className="absolute top-8 bottom-1 left-[15px] w-0.5 -translate-x-1/4 rounded-full bg-border" />
                  <span
                    aria-hidden
                    className={`absolute top-8 bottom-1 left-[15px] w-0.5 origin-top -translate-x-1/4 rounded-full bg-primary transition-transform duration-700 motion-reduce:transition-none ${
                      feito ? "scale-y-100" : "scale-y-0"
                    }`}
                  />
                </>
              )}
              {/* marcador: mesmo das etapas da tela do projeto (pulso na atual, ✓ que entra girando) */}
              <span className="relative z-10 flex size-8 shrink-0 items-center justify-center">
                <span
                  className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                    feito || agora ? "bg-primary" : "border border-border bg-muted"
                  }`}
                />
                {agora && <span aria-hidden className="etapa-pulso absolute inset-0 rounded-full ring-2 ring-primary/50" />}
                {feito ? (
                  <Check className="etapa-icone relative size-4 text-primary-foreground" strokeWidth={3} />
                ) : (
                  <it.icone
                    className={`etapa-icone relative size-4 ${agora ? "text-primary-foreground" : "text-muted-foreground"}`}
                  />
                )}
              </span>
              <div className="min-w-0 pt-1">
                <p className={`text-sm font-medium ${!feito && !agora ? "text-muted-foreground" : ""}`}>
                  {it.titulo}
                  {agora && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-primary uppercase">
                      Agora
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.detalhe}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Bloco>
  );
}

/* -------------------------------------------------------------------------
   Projeto: bloco principal
   ------------------------------------------------------------------------- */

const ROTULO_FASE: Record<FaseProjeto, string> = {
  abertura: "Em abertura",
  postes: "Lançando postes",
  concluido: "Concluído",
};

function BlocoProjeto({ vazio }: { vazio: boolean }) {
  const router = useRouter();
  const s = useProjetoV2();
  const [confirmando, setConfirmando] = useState(false);

  function novo() {
    if (!vazio && !confirmando) {
      setConfirmando(true);
      return;
    }
    s.novoProjeto();
    router.push("/projeto");
  }

  if (vazio) {
    return (
      <Bloco className="col-span-2 p-6 md:col-span-6 md:p-8">
        <Hachura />
        <div className="relative">
          <Rotulo>Nenhum projeto em andamento</Rotulo>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-tight text-balance">
            A linha começa no poste de derivação.
          </h2>
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">
            Informe o projetista, a obra, a coordenada do vento e o condutor. Depois, cada poste é dimensionado em
            sequência e o memorial sai no final.
          </p>
          <div className="my-6">
            <LinhaResumo postes={[]} />
          </div>
          <Link href="/projeto" className={buttonVariants({ size: "lg" })}>
            Começar projeto <ArrowRight className="size-4" />
          </Link>
        </div>
      </Bloco>
    );
  }

  return (
    <Bloco className="col-span-2 flex flex-col p-6 md:col-span-4 md:row-span-2 md:p-8">
      <Hachura />
      <div className="relative flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-widest text-primary uppercase">
            {ROTULO_FASE[s.fase]}
          </span>
        </div>
        <h2 className="mt-3 truncate text-3xl font-semibold tracking-tight md:text-4xl">{s.obra.trim() || "Obra sem nome"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {s.projetista.trim() || "Projetista não informado"}
          {s.iniciadoEm && <> · desde {new Date(s.iniciadoEm).toLocaleDateString("pt-BR")}</>}
        </p>

        <div className="my-6 flex-1 content-center">
          <LinhaResumo postes={s.postes} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/projeto" className={buttonVariants({ size: "lg" })}>
            {s.fase === "concluido" ? "Ver memorial" : "Continuar projeto"} <ArrowRight className="size-4" />
          </Link>
          <Button variant={confirmando ? "destructive" : "outline"} size="lg" onClick={novo}>
            <Plus className="size-4" />
            {confirmando ? "Apagar e começar outro" : "Novo projeto"}
          </Button>
          {confirmando && (
            <Button variant="ghost" size="lg" onClick={() => setConfirmando(false)}>
              Manter este
            </Button>
          )}
        </div>
        {confirmando && (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            O projeto atual será apagado deste navegador. Baixe uma cópia antes, se quiser guardá-lo.
          </p>
        )}
      </div>
    </Bloco>
  );
}

/** Onde o projeto fica guardado + cópia de segurança em arquivo. */
function CopiaSeguranca() {
  const entrada = useRef<HTMLInputElement>(null);
  const temDados = useProjetoV2((s) => s.postes.length > 0 || s.obra.trim() !== "");

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    try {
      await abrirProjeto(arquivo);
      toast.success("Projeto aberto a partir da cópia.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível abrir a cópia.");
    }
  }

  async function aoSalvar() {
    try {
      await baixarProjeto();
    } catch {
      toast.error("Não foi possível salvar a cópia.");
    }
  }

  return (
    <Bloco>
      <div className="flex items-start justify-between gap-3">
        <Rotulo>Guardado neste navegador</Rotulo>
        <Ladrilho icone={HardDrive} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        O projeto fica só neste aparelho. Limpar os dados do site ou trocar de computador apaga o que não tiver cópia.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={aoSalvar} disabled={!temDados}>
          <Download className="size-3.5" /> Baixar cópia
        </Button>
        <Button variant="outline" size="sm" onClick={() => entrada.current?.click()}>
          <FolderOpen className="size-3.5" /> Abrir cópia
        </Button>
        <input ref={entrada} type="file" accept="application/json,.json" className="hidden" onChange={aoEscolher} />
      </div>
      <Link href="/ajuda#dados" className="mt-3 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline">
        Como funciona o salvamento
      </Link>
    </Bloco>
  );
}

/* -------------------------------------------------------------------------
   Painel
   ------------------------------------------------------------------------- */

function Conteudo() {
  const s = useProjetoV2();
  const vazio = s.fase === "abertura" && !s.obra.trim() && !s.projetista.trim() && s.postes.length === 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <BlocoProjeto vazio={vazio} />
        {!vazio && (
          <>
            <SituacaoLinha postes={s.postes} />
            <UtilizacaoPostes postes={s.postes} />
            <Indicador
              icone={Wind}
              tom="vento"
              rotulo="Vento de projeto"
              className="col-span-1"
              valor={s.vento ? `${fmt(s.vento.v_kmh, 1)} km/h` : "—"}
              detalhe={s.vento ? `V0 ${fmt(s.vento.V0, 1)} m/s · NBR 6123` : "Definido na abertura"}
            />
            <Indicador
              icone={Cable}
              rotulo="Condutor"
              className="col-span-1"
              valor={s.condutor ? `${s.condutor.tipoCabo} ${s.condutor.awg}` : "—"}
              detalhe={s.condutor ? `d = ${fmt(s.condutor.d, 2)} mm` : "Definido na abertura"}
            />
            <Indicador
              icone={Route}
              rotulo="Extensão da linha"
              valor={s.extensaoLinha ? `${fmt(s.extensaoLinha.distanciaKm, 2)} km` : "—"}
              detalhe={
                s.extensaoLinha
                  ? s.extensaoLinha.fonte === "geodesica"
                    ? "Reta × fator de sinuosidade"
                    : "Rota sobre o OpenStreetMap"
                  : "Opcional — não estimada"
              }
            />
          </>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Etapas />
        <CopiaSeguranca />
      </div>
    </>
  );
}

export function Painel() {
  const montado = useMounted();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight [font-stretch:108%]">Painel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu projeto de rede de distribuição, poste a poste.
          </p>
        </div>
        <Link href="/ajuda" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
          Como usar
        </Link>
      </header>

      {montado ? (
        <Conteudo />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <div className="h-80 animate-pulse rounded-2xl bg-muted/50 md:col-span-4" />
          <div className="h-80 animate-pulse rounded-2xl bg-muted/50 md:col-span-2" />
        </div>
      )}
    </div>
  );
}
