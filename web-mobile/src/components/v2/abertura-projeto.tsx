"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, ArrowRight, Cable, Check, ClipboardList, CloudLightning, FlaskConical, Lock, Play, Route, Wind,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDUTORES } from "@/lib/validador";
import { ventoNoPonto } from "@/lib/vento";
import { useProjetoV2 } from "@/lib/projeto-v2-store";
import { fmt } from "@/lib/dimensionamento";
import { TEMP_MAX, TEMP_MIN } from "@/lib/tracao-tabelada";
import { CampoCoordenada, ComUnidade, SelectSimples, paraNumero } from "./campos";
import { EstimativaLinha } from "./estimativa-linha";
import { ClimaRegiaoSecao } from "./clima-regiao";
import { UsarLocalizacao } from "./usar-localizacao";
import { Nota } from "./recolhivel";
import { AcaoDock } from "@/components/dock";

/** Situação de preenchimento de uma seção da abertura (só apresentação). */
type StatusSecao = "ok" | "pendente" | "opcional";

/** Ícone de cada seção da abertura (mesmo ladrilho do memorial e do painel). */
const ICONES_SECAO: Record<number, LucideIcon> = {
  1: ClipboardList,
  2: Wind,
  3: Cable,
  4: Route,
  5: CloudLightning,
};

/**
 * Marcador da seção — o mesmo das etapas do projeto: ladrilho com o ícone,
 * ✓ que entra girando ao concluir e pulso na seção a preencher agora.
 */
function MarcadorSecao({ n, status, atual }: { n: number; status: StatusSecao; atual: boolean }) {
  const Icone = ICONES_SECAO[n] ?? ClipboardList;
  const ok = status === "ok";
  const vento = n === 2;
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center">
      <span
        className={`absolute inset-0 rounded-lg transition-colors duration-300 ${
          ok ? "bg-primary" : vento ? "bg-sky-500/10" : "bg-primary/10"
        }`}
      />
      {atual && <span aria-hidden className="etapa-pulso absolute inset-0 rounded-lg ring-2 ring-primary/50" />}
      {ok ? (
        <Check key="ok" className="etapa-icone relative size-4 text-primary-foreground" strokeWidth={3} />
      ) : (
        <Icone
          key="icone"
          className={`etapa-icone relative size-4 ${vento ? "text-sky-700 dark:text-sky-300" : "text-primary"}`}
        />
      )}
    </span>
  );
}

function Secao({
  n, titulo, ajuda, status, atual = false, oculta = false, children,
}: {
  n: number;
  titulo: string;
  ajuda?: string;
  status: StatusSecao;
  /** Primeira seção obrigatória ainda a preencher. */
  atual?: boolean;
  /** Celular/tablet: a abertura vai em passos — só a seção do passo aparece. */
  oculta?: boolean;
  children: ReactNode;
}) {
  const ok = status === "ok";
  return (
    <section
      id={`v2-secao-${n}`}
      className={`scroll-mt-24 rounded-xl bg-card p-4 ring-1 transition-shadow duration-300 sm:p-5 ${
        ok ? "ring-primary/30" : atual ? "shadow-[0_0_0_1px_var(--primary)] ring-transparent" : "ring-foreground/10"
      } ${oculta ? "max-lg:hidden" : "max-lg:animate-in max-lg:fade-in max-lg:slide-in-from-right-4 max-lg:duration-300 motion-reduce:animate-none"}`}
    >
      <header className="mb-4 flex items-start gap-3">
        <MarcadorSecao n={n} status={status} atual={atual} />
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h2 className="text-sm font-semibold">
              <span className="mr-1.5 font-mono text-xs text-muted-foreground tabular-nums">{String(n).padStart(2, "0")}</span>
              {titulo}
            </h2>
            {status === "opcional" && (
              <span className="rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Opcional
              </span>
            )}
            {status === "pendente" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-700 uppercase dark:text-amber-300">
                A preencher
              </span>
            )}
            {ok && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
                Concluído
              </span>
            )}
          </div>
          {ajuda && <Nota className="mt-1">{ajuda}</Nota>}
        </div>
      </header>
      {children}
    </section>
  );
}

/**
 * Etapas da abertura em linha — aparece só quando a linha lateral some (telas
 * menores). Mesmo visual das etapas do projeto: fio de cobre que se preenche a
 * cada seção concluída, ✓ animado e pulso na seção a preencher.
 */
function EtapasAbertura({
  etapas, atual, passo, irPara,
}: {
  etapas: { n: number; rotulo: string; status: StatusSecao }[];
  atual: number | null;
  /** Passo à vista no celular/tablet. */
  passo: number;
  irPara: (n: number) => void;
}) {
  return (
    <nav aria-label="Etapas da abertura" className="rounded-xl bg-card px-1 py-3 ring-1 ring-foreground/10 lg:hidden print:hidden">
      <ol className="flex items-start">
        {etapas.map((e, i) => {
          const ok = e.status === "ok";
          const agora = e.n === atual;
          const visivel = e.n === passo;
          const Icone = ICONES_SECAO[e.n] ?? ClipboardList;
          return (
            <li key={e.n} aria-current={visivel ? "step" : undefined} className="relative flex min-w-0 flex-1 flex-col items-center">
              {/* fio até a próxima etapa: preenche quando esta está concluída */}
              {i < etapas.length - 1 && (
                <>
                  <span aria-hidden className="absolute top-[15px] left-1/2 h-0.5 w-full rounded-full bg-border" />
                  <span
                    aria-hidden
                    className={`absolute top-[15px] left-1/2 h-0.5 w-full origin-left rounded-full bg-primary transition-transform duration-500 motion-reduce:transition-none ${
                      ok ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </>
              )}
              <button
                type="button"
                onClick={() => irPara(e.n)}
                aria-label={`Passo ${e.n}: ${e.rotulo}${ok ? " (concluído)" : e.status === "opcional" ? " (opcional)" : ""}`}
                className="alvo-toque relative z-10 flex min-w-0 flex-col items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span
                  className={`relative flex size-8 items-center justify-center rounded-full transition-shadow ${
                    visivel ? "shadow-[0_0_0_3px_var(--card),0_0_0_5px_var(--primary)]" : ""
                  }`}
                >
                  <span
                    className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                      ok || agora ? "bg-primary" : "border border-border bg-muted"
                    }`}
                  />
                  {agora && <span aria-hidden className="etapa-pulso absolute inset-0 rounded-full ring-2 ring-primary/50" />}
                  {ok ? (
                    <Check key="ok" className="etapa-icone relative size-4 text-primary-foreground" strokeWidth={3} />
                  ) : (
                    <Icone
                      key="icone"
                      className={`etapa-icone relative size-4 ${agora ? "text-primary-foreground" : "text-muted-foreground"}`}
                    />
                  )}
                </span>
                <span
                  className={`mt-1.5 max-w-full truncate px-0.5 text-[11px] ${
                    visivel ? "font-semibold text-primary" : ok || agora ? "font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {e.rotulo}
                </span>
                {e.status === "opcional" && <span className="text-[9px] text-muted-foreground uppercase">opcional</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Abertura do projeto: fixa as amarras antes de dimensionar o primeiro poste. */
export function AberturaProjeto() {
  const s = useProjetoV2();

  const lat = paraNumero(s.coordLat);
  const lon = paraNumero(s.coordLon);
  const coordValida =
    !Number.isNaN(lat) && !Number.isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

  const previa = useMemo(
    () => (coordValida ? ventoNoPonto(lat, lon) : null),
    [coordValida, lat, lon],
  );

  const cabos = Object.keys(CONDUTORES);
  const bitolas = s.tipoCabo ? CONDUTORES[s.tipoCabo]?.bitolas ?? [] : [];
  const bitola = bitolas.find((b) => b.awg === s.awg) ?? null;

  // Temperatura de projeto da tabela de tração (faixa das tabelas: −5 a 50 °C).
  const tempNum = paraNumero(s.temperaturaProjeto);
  const tempValida = s.temperaturaProjeto.trim() !== "" && !Number.isNaN(tempNum) && tempNum >= TEMP_MIN && tempNum <= TEMP_MAX;

  const faltando = [
    s.projetista.trim() === "" && "o nome do projetista",
    s.obra.trim() === "" && "a identificação da obra",
    !previa && "uma coordenada válida",
    !bitola && "o condutor da obra",
    !tempValida && "a temperatura de projeto",
  ].filter(Boolean) as string[];
  const pronto = faltando.length === 0;

  // Status visual das seções — espelha exatamente as mesmas condições de `faltando`.
  const st = (ok: boolean): StatusSecao => (ok ? "ok" : "pendente");
  const stOpc = (ok: boolean): StatusSecao => (ok ? "ok" : "opcional");
  const etapas = [
    { n: 1, rotulo: "Projeto", status: st(s.projetista.trim() !== "" && s.obra.trim() !== "") },
    { n: 2, rotulo: "Vento", status: st(!!previa) },
    { n: 3, rotulo: "Condutor", status: st(!!bitola && tempValida) },
    { n: 4, rotulo: "Extensão", status: stOpc(!!s.extensaoLinha) },
    { n: 5, rotulo: "Clima", status: stOpc(!!s.climaRegiao) },
  ];
  const obrigatoriasOk = etapas.slice(0, 3).filter((e) => e.status === "ok").length;
  // Seção a preencher agora: a primeira obrigatória pendente (pulsa).
  const atual = etapas.find((e) => e.status === "pendente")?.n ?? null;

  // Celular/tablet: uma seção por vez. Começa na primeira pendente.
  const [passo, setPasso] = useState(() => atual ?? 1);
  const irPara = (n: number) => {
    setPasso(Math.min(Math.max(n, 1), etapas.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const etapaPasso = etapas[passo - 1];

  const iniciar = () => {
    if (!previa || !bitola || !tempValida || !pronto) return;
    s.iniciar(previa, { tipoCabo: s.tipoCabo, awg: s.awg, d: bitola.diamMm, tempC: tempNum });
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="lg:mb-2">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase lg:hidden">
          Etapa 1 de 3 · Abertura
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Novo projeto de postes</h1>
        <p className={`mt-2 max-w-2xl text-sm text-muted-foreground ${passo === 1 ? "" : "max-lg:hidden"}`}>
          Amarre as variáveis da obra uma única vez — vento pela coordenada e condutor valem
          para todos os postes. Depois, cada poste é dimensionado em sequência na mesma linha.
        </p>
      </header>

      <EtapasAbertura etapas={etapas} atual={atual} passo={passo} irPara={irPara} />

      <Secao n={1} titulo="Quem assina e o que se constrói" status={etapas[0].status} atual={atual === 1} oculta={passo !== 1}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v2-projetista">Projetista</Label>
            <Input
              id="v2-projetista"
              placeholder="Nome de quem assina o projeto"
              value={s.projetista}
              onChange={(e) => s.setAbertura({ projetista: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v2-obra">Obra</Label>
            <Input
              id="v2-obra"
              placeholder="Identificação da obra ou do trecho"
              value={s.obra}
              onChange={(e) => s.setAbertura({ obra: e.target.value })}
            />
          </div>
        </div>
      </Secao>

      <Secao
        n={2}
        oculta={passo !== 2}
        titulo="Vento de projeto"
        status={etapas[1].status}
        atual={atual === 2}
        ajuda="A coordenada lê o V0 das isopletas da NBR 6123 e define a velocidade do vento de toda a obra."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CampoCoordenada
            unidade="lat"
            placeholder="Latitude (ex.: -7,115)"
            value={s.coordLat}
            onChange={(coordLat) => s.setAbertura({ coordLat })}
          />
          <CampoCoordenada
            unidade="lon"
            placeholder="Longitude (ex.: -34,863)"
            value={s.coordLon}
            onChange={(coordLon) => s.setAbertura({ coordLon })}
          />
        </div>
        <div className="mt-2">
          <UsarLocalizacao onLocalizar={(coordLat, coordLon) => s.setAbertura({ coordLat, coordLon })} />
        </div>
        {previa && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-sky-600/30 bg-sky-500/10 p-3 text-sm">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-700 dark:text-sky-300">
              <Wind className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-2xl font-semibold text-sky-700 tabular-nums dark:text-sky-300">
                  {fmt(previa.v_kmh, 1)}
                  <span className="ml-1 text-sm font-normal">km/h</span>
                </span>
                <span className="text-xs text-muted-foreground">velocidade do vento (v) para todos os postes</span>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                V0 = {fmt(previa.V0, 1)} m/s (isopletas NBR 6123) · Vk = V0 · 1,00 · 0,79 · 0,85 ={" "}
                {fmt(previa.Vk, 2)} m/s · v = Vk · 3,6
              </div>
            </div>
          </div>
        )}
      </Secao>

      <Secao
        n={3}
        oculta={passo !== 3}
        titulo="Condutor da obra"
        status={etapas[2].status}
        atual={atual === 3}
        ajuda="Cabo, bitola e temperatura de projeto ficam fixados: o vento nos condutores usa este diâmetro e a tração sai da tabela de montagem nesta temperatura, em todos os postes."
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <SelectSimples
            value={s.tipoCabo}
            onChange={(v) => s.setAbertura({ tipoCabo: v, awg: "" })}
            placeholder="Tipo de cabo"
            opcoes={cabos.map((tc) => ({ label: `${tc} — ${CONDUTORES[tc].nome}`, valor: tc }))}
          />
          <SelectSimples
            value={s.awg}
            onChange={(v) => s.setAbertura({ awg: v })}
            placeholder={s.tipoCabo ? "Bitola" : "Escolha o tipo de cabo primeiro"}
            opcoes={bitolas.map((b) => ({ label: `${b.awg} (d = ${fmt(b.diamMm, 2)} mm)`, valor: b.awg }))}
          />
        </div>
        {bitola && (
          <p className="mt-3 text-xs text-muted-foreground">
            {CONDUTORES[s.tipoCabo].nome} · bitola {bitola.awg} · d = {fmt(bitola.diamMm, 2)} mm ·{" "}
            {fmt(bitola.pesoKgKm, 1)} kg/km
          </p>
        )}
        <div className="mt-4 flex flex-col gap-1.5 sm:max-w-xs">
          <Label htmlFor="v2-temp">Temperatura de projeto</Label>
          <ComUnidade unidade="°C">
            <Input
              id="v2-temp"
              inputMode="decimal"
              placeholder="ex.: 25"
              value={s.temperaturaProjeto}
              onChange={(e) => s.setAbertura({ temperaturaProjeto: e.target.value })}
              className="pr-9"
              aria-invalid={s.temperaturaProjeto.trim() !== "" && !tempValida}
            />
          </ComUnidade>
          <span
            className={`text-xs ${
              s.temperaturaProjeto.trim() !== "" && !tempValida
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            }`}
          >
            Temperatura da tabela de tração de montagem (sem vento), de {TEMP_MIN} a {TEMP_MAX} °C. Vale para
            todos os postes.
          </span>
        </div>
      </Secao>

      <Secao
        n={4}
        oculta={passo !== 4}
        titulo="Extensão da linha e quantidade de postes"
        status={etapas[3].status}
        ajuda="Informe a coordenada do ponto de derivação e a do ponto de entrega da carga para estimar, em km, a extensão da linha pelo arruamento (OpenStreetMap). Com o vão médio pretendido, estima também a quantidade de postes."
      >
        <EstimativaLinha />
      </Secao>

      <Secao
        n={5}
        oculta={passo !== 5}
        titulo="Clima da região — descargas atmosféricas"
        status={etapas[4].status}
        ajuda="Amostra o clima entre o ponto de derivação e o de entrega: o Ng (densidade de descargas atmosféricas, NBR 5419-2) por município e o V0 do vento no corredor. Usa as coordenadas da seção anterior."
      >
        <ClimaRegiaoSecao />
      </Secao>

      {/* Configuração de teste (modo dev): passo de amarração, escolhido antes de iniciar. */}
      {s.dev && (
        <section className={`rounded-xl border border-dashed border-amber-500/50 bg-amber-500/[0.06] p-5 print:hidden ${passo === 3 ? "" : "max-lg:hidden"}`}>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.14em] text-amber-700 uppercase dark:text-amber-300">
            <FlaskConical className="size-3.5" /> Modo dev — passo de amarração (teste)
          </div>
          <div className="mt-3 flex flex-col gap-1.5 sm:max-w-xs">
            <Label htmlFor="v2-passo">Passo de amarração</Label>
            <ComUnidade unidade="m">
              <Input
                id="v2-passo"
                inputMode="decimal"
                placeholder="ex.: 500"
                value={s.passoAmarracao ? String(s.passoAmarracao) : ""}
                onChange={(e) => {
                  const v = paraNumero(e.target.value);
                  s.setAbertura({ passoAmarracao: Number.isNaN(v) || v < 0 ? 0 : v });
                }}
                className="pr-9"
              />
            </ComUnidade>
            <span className="text-xs text-muted-foreground">
              A cada {s.passoAmarracao ? fmt(s.passoAmarracao, 0) : "—"} m de vão somados nos postes
              cadastrados, o próximo poste é sinalizado como de amarração. 0 desabilita.
            </span>
          </div>
        </section>
      )}

      {/* Barra de ação fixa: progresso das amarras obrigatórias + início do projeto. */}
      <div className="sticky bottom-4 z-20 mt-2 max-lg:hidden print:hidden">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl bg-card/95 p-3 pl-4 shadow-lg ring-1 ring-foreground/10 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="min-w-[12rem] flex-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium">
                {pronto ? "Tudo pronto para iniciar" : `Falta preencher ${faltando[0]}`}
              </span>
              <span className="text-muted-foreground tabular-nums">{obrigatoriasOk} de 3</span>
            </div>
            {/* Um segmento por amarra obrigatória (projeto, vento, condutor). */}
            <div
              className="mt-1.5 flex gap-1"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={3}
              aria-valuenow={obrigatoriasOk}
              aria-label="Amarras obrigatórias preenchidas"
            >
              {etapas.slice(0, 3).map((e) => (
                <span key={e.n} className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={`absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none ${
                      e.status === "ok" ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                  {e.n === atual && (
                    <span aria-hidden className="absolute inset-0 animate-pulse rounded-full bg-primary/25 motion-reduce:animate-none" />
                  )}
                </span>
              ))}
            </div>
            {pronto && (
              <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> Vento, condutor e temperatura ficam travados para toda a obra.
              </p>
            )}
          </div>
          <Button size="lg" disabled={!pronto} onClick={iniciar} className="max-sm:w-full">
            Iniciar projeto <ArrowRight data-icon="inline-end" className="size-4" />
          </Button>
        </div>
      </div>

      {/* Celular/tablet: progresso + navegação dos passos no dock, ao alcance do polegar. */}
      <AcaoDock>
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <div className="flex items-center justify-between gap-2 text-xs">
            {pronto ? (
              <span className="flex min-w-0 items-center gap-1.5 font-medium">
                <Lock className="size-3 shrink-0 text-primary" />
                <span className="truncate">Pronto para iniciar</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => atual && irPara(atual)}
                className="min-w-0 truncate text-left font-medium underline-offset-2 active:underline"
              >
                Falta {faltando[0]}
              </button>
            )}
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {obrigatoriasOk} de 3 · passo {passo}/{etapas.length}
            </span>
          </div>
          <div className="flex gap-1" aria-hidden>
            {etapas.slice(0, 3).map((e) => (
              <span key={e.n} className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <span
                  className={`absolute inset-0 origin-left rounded-full bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none ${
                    e.status === "ok" ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            {passo > 1 && (
              <Button
                variant="outline"
                size="lg"
                className="h-11 w-11 shrink-0 px-0"
                aria-label="Passo anterior"
                onClick={() => irPara(passo - 1)}
              >
                <ArrowLeft className="size-4" />
              </Button>
            )}
            {passo < etapas.length && (
              <Button
                variant={pronto ? "outline" : "default"}
                size="lg"
                className="h-11 min-w-0 flex-1"
                onClick={() => irPara(passo + 1)}
              >
                <span className="truncate">
                  {pronto ? etapas[passo].rotulo : `Próximo: ${etapas[passo].rotulo}`}
                </span>
                <ArrowRight data-icon="inline-end" className="size-4" />
              </Button>
            )}
            {(pronto || passo === etapas.length) && (
              <Button size="lg" className="h-11 min-w-0 flex-1" disabled={!pronto} onClick={iniciar}>
                <Play data-icon="inline-start" className="size-4" /> Iniciar projeto
              </Button>
            )}
          </div>
          {etapaPasso.status === "opcional" && !pronto && (
            <p className="text-[11px] text-muted-foreground">Este passo é opcional — dá para iniciar sem ele.</p>
          )}
        </div>
      </AcaoDock>
    </div>
  );
}
