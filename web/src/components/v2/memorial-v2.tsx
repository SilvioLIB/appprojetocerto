"use client";

import { Fragment, useState, type ReactNode } from "react";
import {
  AlertTriangle, Cable, ChevronDown, Gauge, Layers, Map as MapIcon, Plus, Printer, RotateCcw, Wind,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { estruturaPorId, fmt, orientacaoLado, type MemoriaCalculo } from "@/lib/dimensionamento";
import { MAX_POSTES, useProjetoV2, type PosteProjeto } from "@/lib/projeto-v2-store";
import { estimarNumeroPostes, VAO_MEDIO_MIN_M, VAO_MEDIO_MAX_M } from "@/lib/distancia";
import { imprimir } from "@/lib/nativo/imprimir";
import { MapaTrajeto, TIPO_POSTE, type MarcadorPoste } from "./mapa-trajeto";
import { paraNumero } from "./campos";
import { PlantaRede } from "./planta-rede";
import { MedidorMini, MedidorUtilizacao, tomUtilizacao } from "./medidor-utilizacao";
import { ICONES_ESTRUTURA } from "./icones-estrutura";

/** Descreve, em texto, os esforços extras somados ao poste (para o memorial). */
function detalhesExtras(m: MemoriaCalculo): string[] {
  const det: string[] = [];
  // Derivação: verificação do poste existente (ausente em projetos antigos).
  const dv = m.derivacao;
  if (dv) {
    const r = dv.rede;
    det.push(
      `derivação de rede existente ${r.nFases} × ${r.tipoCabo} ${r.awg} (${r.situacao === "passagem" ? "passagem" : r.situacao === "angulo" ? `ângulo ${fmt(r.alfa, 0)}°` : "fim de linha"}, vão ${fmt(r.vao, 0)} m), θ = ${fmt(r.anguloDerivacao, 0)}°`,
      `trações: existente ${fmt(dv.Rexistente, 0)} daN no poste + nova ${fmt(dv.Tnova, 0)} daN → resultante ${fmt(dv.Rtracao, 0)} daN; com vento F = ${fmt(dv.F, 0)} daN`,
      `capacidade ${dv.circular ? "Rn" : r.lado === "maior" ? "lado maior (Rn)" : "lado menor (Rn/2)"} ${fmt(dv.capacidade, 0)} daN → ${dv.atende ? "o poste existente suporta" : "NÃO suporta"}`,
    );
    if (!dv.atende) {
      const s = dv.solucoes;
      if (s.girar) det.push("solução: girar o poste (lado maior atende)");
      if (s.estai) det.push(`solução: estai de contraposição entre ${fmt(s.estai.heMin, 2)} e ${fmt(s.estai.heMax, 2)} m`);
      det.push(
        s.posteSugerido
          ? `solução: trocar por poste de ${fmt(s.posteSugerido.resistencia, 0)} daN (lado ${s.posteSugerido.lado})`
          : "solução: nenhum poste da mesma altura no catálogo atende",
      );
    }
  }
  if (m.especTrafo != null)
    det.push(
      `transformador — poste especificado ${fmt(m.especTrafo.comprimentoM, 0)} m / ${fmt(m.especTrafo.esforcoDaN, 0)} daN`,
    );
  if (m.especAmarracao != null)
    det.push(
      `amarração — esforço tabelado ${fmt(m.especAmarracao.esforcoDaN, 0)} daN (cabo ${m.especAmarracao.cabo})`,
    );
  if (m.posteInformado) det.push(`poste informado ${fmt(m.esforcoPoste, 1)} daN`);
  if (m.Fcruzeta != null) det.push(`cruzeta ${fmt(m.Fcruzeta, 1)} daN`);
  // STANDBY — método dos momentos (m.momentoTrafo fica nulo na versão atual).
  if (m.momentoTrafo != null)
    det.push(
      `transformador — Mposte ${fmt(m.momentoTrafo.Mposte, 1)} vs M7m ${fmt(m.momentoTrafo.M7m, 1)} daN·m`,
    );
  if (m.Fextra != null) det.push(`circuito extra ${fmt(m.Fextra, 1)} daN`);
  // Tração de projeto (ausente em projetos salvos antes de ela entrar no cálculo).
  if (m.tracao)
    det.push(
      m.tracao.somaDireta
        ? `F = vento ${fmt(m.Fvento, 1)} + T ${fmt(m.tracao.T, 0)} daN (soma direta)`
        : m.tracao.modo === "deflexao"
        ? `tração: R = ${fmt(m.tracao.Rtotal, 1)} daN (T ${fmt(m.tracao.T, 0)} daN · 2·sen(α/2)) + vento ${fmt(m.Fvento, 1)} daN`
        : `início/fim de linha: T ${fmt(m.tracao.T, 0)} daN — situação ${m.tracao.governa ?? "?"} governa (${fmt(m.tracao.situacao1 ?? 0, 1)} ⟂ / ${fmt(m.tracao.situacao2 ?? 0, 1)} no sentido da tração)`,
    );
  const tb = m.tracao?.tabelada;
  if (tb) {
    // Trecho cujo vão regulador deu a tração.
    const tr = m.tracao?.trechos?.find((t) => t.ar === tb.vao);
    const vaoTexto = tr
      ? `regulador de ${fmt(tb.vao, 1)} m (trecho P${String(tr.de + 1).padStart(2, "0")}–P${String(tr.ate + 1).padStart(2, "0")})`
      : `de ${fmt(tb.vao, 0)} m`;
    det.push(
      `T pela tabela de montagem no vão ${vaoTexto}, ${fmt(tb.tempC, 0)} °C sem vento → ${fmt(tb.Tprojeto, 0)} daN por condutor${
        tb.tabelado ? "" : ` (flecha constante a partir do ${tb.tipo} ${tb.awgBase ?? "336.4"})`
      }, flecha ${fmt(tb.flecha, 2)} m`,
    );
  } else if (m.tracao?.fonte === "tabela") {
    det.push(`T pela NDU 007, Tabela 26 (tração de projeto) → ${fmt(m.tracao.Tcondutor, 1)} daN por condutor`);
  }
  return det;
}

/** Cartão de indicador do resumo do memorial. */
function Indicador({
  icone, rotulo, valor, detalhe, tom = "neutro",
}: {
  icone: ReactNode;
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  tom?: "neutro" | "vento" | "alerta";
}) {
  const corValor =
    tom === "vento" ? "text-sky-700 dark:text-sky-300" : tom === "alerta" ? "text-destructive" : "";
  const corIcone =
    tom === "vento"
      ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : tom === "alerta"
        ? "bg-destructive/10 text-destructive"
        : "bg-primary/10 text-primary";
  return (
    <div className="flex break-inside-avoid flex-col rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{rotulo}</span>
        <span className={`flex size-7 items-center justify-center rounded-lg print:hidden ${corIcone}`}>{icone}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${corValor}`}>{valor}</div>
      {detalhe && <div className="mt-auto pt-1 text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
}

/** Conclusão do projeto: memorial com as amarras e todos os postes da linha. */
/**
 * Notas e flags de uma linha do memorial — compartilhado pela tabela
 * (tablet/desktop/impressão) e pelos cartões do celular.
 */
function resumoPoste(p: PosteProjeto) {
  // Origem da linha (poste 01): registro informativo do poste de onde a
  // linha deriva — anexado às notas da linha do memorial.
  const notas = [...detalhesExtras(p.memoria)];
  if (p.entrada.derivacaoExistente && p.memoria.baseOrigemDerivacao != null) {
    const ok = p.memoria.atendeOrigemDerivacao ? "atende" : "ABAIXO da base — subir o esforço";
    notas.push(
      `origem: deriva do lado ${p.memoria.ladoOrigemDerivacao} de poste de ${fmt(p.entrada.esforcoOrigemDerivacao ?? 0, 0)} daN → base ${fmt(p.memoria.baseOrigemDerivacao, 0)} daN (${ok})`,
    );
  }
  // Lado do poste (esforço direcional): qual sentido posicionar.
  const orient = orientacaoLado(p.memoria);
  if (orient) notas.push(orient.resumo);
  // Posição escolhida na planta da rede (só duplo T com esforço a orientar).
  if (orient && p.entrada.tipoFisico !== "circular")
    notas.push(
      p.planta?.virado ? "planta: face lisa voltada para a resultante" : "planta: cavas na resultante (posição padrão)",
    );
  // Postes especificados (transformador ou amarração) e derivação
  // implantada não têm ação de vento — colunas de vento como "—".
  const espec = p.memoria.especTrafo != null || p.memoria.especAmarracao != null;
  const semVento = espec || p.memoria.posteInformado;
  return { notas, espec, semVento };
}

/** Selo de situação do poste (mesmo texto na tabela e nos cartões). */
function SeloSituacao({ p, espec }: { p: PosteProjeto; espec: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {espec ? (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Especificado</span>
      ) : p.memoria.aprovado ? (
        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
          Aprovado
        </span>
      ) : (
        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Rever poste</span>
      )}
      {p.memoria.estaiado && (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
          estai {fmt(p.memoria.estaiHe ?? 0, 1)} m
        </span>
      )}
    </span>
  );
}

/** Estrutura com o ícone em ladrilho — o mesmo dos cartões de escolha do poste. */
function Estrutura({ p, grande = false }: { p: PosteProjeto; grande?: boolean }) {
  const Icone = ICONES_ESTRUTURA[p.entrada.estrutura];
  return (
    <span className="flex items-center gap-2">
      <span
        className={`flex shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary print:hidden ${
          grande ? "size-7" : "size-6"
        }`}
      >
        {Icone && <Icone className={grande ? "size-4" : "size-3.5"} />}
      </span>
      <span className={grande ? "text-sm font-medium" : ""}>{estruturaPorId(p.entrada.estrutura).label}</span>
    </span>
  );
}

/** Utilização com o mini medidor (mesma escala e cores do medidor do poste). */
function Utilizacao({ p, alinhar = "fim" }: { p: PosteProjeto; alinhar?: "fim" | "inicio" }) {
  const pct = (p.memoria.utilizacaoEfetiva ?? p.memoria.utilizacao) * 100;
  const tom = tomUtilizacao(pct, p.memoria.limiarPct, p.memoria.aprovado);
  return (
    <span className={`flex items-center gap-2 ${alinhar === "fim" ? "justify-end" : ""}`}>
      <MedidorMini utilizacaoPct={pct} limiarPct={p.memoria.limiarPct} aprovado={p.memoria.aprovado} className="w-8" />
      <span className={`font-semibold ${tom.texto}`}>{fmt(pct, 1)}%</span>
      {p.memoria.estaiado && <span className="text-[10px] text-muted-foreground">c/ estai</span>}
    </span>
  );
}

function DadoCartao({ rotulo, valor, forte = false }: { rotulo: string; valor: ReactNode; forte?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] tracking-wide text-muted-foreground uppercase">{rotulo}</dt>
      <dd className={`truncate tabular-nums ${forte ? "font-semibold" : ""}`}>{valor}</dd>
    </div>
  );
}

/** Memorial no celular: um cartão por poste, com os mesmos dados da tabela. */
function CartoesPostes({ postes }: { postes: PosteProjeto[] }) {
  return (
    <ol className="flex flex-col gap-3 md:hidden print:hidden">
      {postes.map((p, i) => {
        const { notas, espec, semVento } = resumoPoste(p);
        return (
          <li
            key={p.id}
            className={`rounded-xl bg-card p-4 ring-1 ${!espec && !p.memoria.aprovado ? "ring-destructive/40" : "ring-foreground/10"}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-lg font-semibold text-primary tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <Estrutura p={p} grande />
              </div>
              <SeloSituacao p={p} espec={espec} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {p.entrada.tipoFisico} {p.entrada.comprimento} m · Rn {fmt(p.entrada.resistencia, 0)} daN
            </p>

            {!espec && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  Utilização · limite {fmt(p.memoria.limiarPct, 0)}%
                </span>
                <span className="text-sm tabular-nums">
                  <Utilizacao p={p} />
                </span>
              </div>
            )}

            <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <DadoCartao rotulo="Vão" valor={semVento ? "—" : `${fmt(p.entrada.vao, 0)} m`} />
              <DadoCartao rotulo="Ângulo" valor={semVento ? "—" : `${fmt(p.entrada.alfa, 0)}°`} />
              <DadoCartao rotulo="Fases" valor={semVento ? "—" : p.entrada.nFases} />
              <DadoCartao rotulo="Fc" valor={semVento ? "—" : `${fmt(p.memoria.Fc, 1)} daN`} />
              <DadoCartao rotulo="Fp,topo" valor={semVento ? "—" : `${fmt(p.memoria.FpTopo, 1)} daN`} />
              <DadoCartao rotulo="F total" valor={espec ? "—" : `${fmt(p.memoria.Ftotal, 1)} daN`} forte />
            </dl>

            {notas.length > 0 && <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">+ {notas.join(" · ")}</p>}
          </li>
        );
      })}
    </ol>
  );
}

export function MemorialV2() {
  const s = useProjetoV2();
  // Visualização da disposição dos postes sobre o trajeto (revelada ao clicar).
  // Declarado antes de qualquer retorno para respeitar as regras de hooks.
  const [mostrarMapa, setMostrarMapa] = useState(false);
  if (!s.vento || !s.condutor) return null;
  const { vento, condutor } = s;

  const data = s.iniciadoEm ? new Date(s.iniciadoEm).toLocaleDateString("pt-BR") : "—";

  // Estimativa de postes: só quando há extensão calculada e vão médio válido.
  const vaoMedioNum = paraNumero(s.vaoMedio);
  const postesEstimados =
    s.extensaoLinha &&
    !Number.isNaN(vaoMedioNum) &&
    vaoMedioNum >= VAO_MEDIO_MIN_M &&
    vaoMedioNum <= VAO_MEDIO_MAX_M
      ? estimarNumeroPostes(s.extensaoLinha.distanciaKm, vaoMedioNum)
      : null;

  const deriv = { lat: paraNumero(s.derivLat), lon: paraNumero(s.derivLon) };
  const entrega = { lat: paraNumero(s.entregaLat), lon: paraNumero(s.entregaLon) };
  const temCoordsTrajeto = [deriv.lat, deriv.lon, entrega.lat, entrega.lon].every(
    (x) => !Number.isNaN(x),
  );

  // Disposição inicial: início e fim sempre como derivação; o miolo segue o tipo
  // preenchido pelo projetista. A distância de cada poste acumula o vão aplicado,
  // e a fração (0..1) posiciona o poste sobre o traçado derivação → entrega.
  const nPostes = s.postes.length;
  const distanciasAcum: number[] = [];
  {
    let acc = 0;
    s.postes.forEach((p, i) => {
      distanciasAcum[i] = acc;
      acc += p.entrada.vao || 0;
    });
  }
  const totalVao = nPostes > 0 ? distanciasAcum[nPostes - 1] : 0;
  const marcadores: MarcadorPoste[] = s.postes.map((p, i) => ({
    n: i + 1,
    estrutura: i === 0 || i === nPostes - 1 ? "derivacao" : p.entrada.estrutura,
    fracao: totalVao > 0 ? distanciasAcum[i] / totalVao : nPostes > 1 ? i / (nPostes - 1) : 0,
    distanciaM: distanciasAcum[i],
  }));

  // Resumo para os indicadores — lido direto da memória já calculada, sem recalcular.
  // Mesmo critério da coluna "Situação": especificado → aprovado → rever poste.
  const resumo = s.postes.reduce(
    (acc, p, i) => {
      const espec = p.memoria.especTrafo != null || p.memoria.especAmarracao != null;
      if (espec) {
        acc.especificados++;
        return acc;
      }
      if (p.memoria.aprovado) acc.aprovados++;
      else acc.rever++;
      const u = p.memoria.utilizacaoEfetiva ?? p.memoria.utilizacao;
      if (acc.maiorUtil == null || u > acc.maiorUtil.valor)
        acc.maiorUtil = { valor: u, n: i + 1, limiarPct: p.memoria.limiarPct, aprovado: p.memoria.aprovado };
      return acc;
    },
    {
      aprovados: 0,
      rever: 0,
      especificados: 0,
      maiorUtil: null as { valor: number; n: number; limiarPct: number; aprovado: boolean } | null,
    },
  );

  const novoProjeto = () => {
    if (window.confirm("Começar um novo projeto? O projeto atual será apagado deste navegador.")) {
      s.novoProjeto();
      window.scrollTo({ top: 0 });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <div className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          Memorial do projeto
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">{s.obra}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Projetista: {s.projetista} · Início: {data} · Coordenada: ({fmt(vento.latitude, 5)},{" "}
          {fmt(vento.longitude, 5)})
        </p>
        {s.extensaoLinha && (
          <p className="mt-1 text-sm text-muted-foreground">
            Extensão estimada da linha (derivação → entrega):{" "}
            <span className="font-medium text-foreground tabular-nums">
              {fmt(s.extensaoLinha.distanciaKm, 2)} km
            </span>{" "}
            · {s.extensaoLinha.observacao}
          </p>
        )}
        {postesEstimados && (
          <p className="mt-1 text-sm text-muted-foreground">
            Quantidade estimada de postes:{" "}
            <span className="font-medium text-foreground tabular-nums">
              {postesEstimados.numeroPostes} postes
            </span>{" "}
            · {fmt(postesEstimados.distanciaKm, 2)} km ÷ {fmt(postesEstimados.vaoMedioM, 0)} m ≈{" "}
            {postesEstimados.numeroVaos} vãos + 1
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {/* Situação da linha: medidor do poste mais solicitado + composição da linha. */}
        <div className="flex break-inside-avoid flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:col-span-2 sm:flex-row sm:items-center">
          {resumo.maiorUtil != null ? (
            <MedidorUtilizacao
              utilizacaoPct={resumo.maiorUtil.valor * 100}
              limiarPct={resumo.maiorUtil.limiarPct}
              aprovado={resumo.maiorUtil.aprovado}
              rotulo={`maior · poste ${String(resumo.maiorUtil.n).padStart(2, "0")}`}
              className="mx-auto w-40 sm:mx-0"
            />
          ) : (
            <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-muted text-muted-foreground sm:mx-0">
              <Gauge className="size-8" />
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Situação da linha</span>
              <span
                className={`flex size-7 items-center justify-center rounded-lg print:hidden ${
                  resumo.rever > 0 ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                }`}
              >
                {resumo.rever > 0 ? <AlertTriangle className="size-4" /> : <Layers className="size-4" />}
              </span>
            </div>
            <div className="text-2xl font-semibold tabular-nums">
              {nPostes}{" "}
              <span className="text-sm font-normal text-muted-foreground">{nPostes === 1 ? "poste" : "postes"}</span>
            </div>
            {nPostes > 0 && (
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="bg-green-600 dark:bg-green-500" style={{ width: `${(resumo.aprovados / nPostes) * 100}%` }} />
                <span className="bg-destructive" style={{ width: `${(resumo.rever / nPostes) * 100}%` }} />
                <span className="bg-primary/60" style={{ width: `${(resumo.especificados / nPostes) * 100}%` }} />
              </div>
            )}
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-green-600 dark:bg-green-500" />
                <span className="font-semibold tabular-nums">{resumo.aprovados}</span>
                <span className="text-muted-foreground">aprovados</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-destructive" />
                <span className={`font-semibold tabular-nums ${resumo.rever > 0 ? "text-destructive" : ""}`}>{resumo.rever}</span>
                <span className="text-muted-foreground">a rever</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-primary/60" />
                <span className="font-semibold tabular-nums">{resumo.especificados}</span>
                <span className="text-muted-foreground">especificados</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              {resumo.maiorUtil != null
                ? `Medidor: o poste mais solicitado entre os verificados por vento (poste ${String(resumo.maiorUtil.n).padStart(2, "0")}).`
                : "Nenhum poste com verificação de vento — todos especificados por tabela."}
            </p>
          </div>
        </div>
        <Indicador
          icone={<Wind className="size-4" />}
          rotulo="Vento de projeto"
          tom="vento"
          valor={
            <>
              {fmt(vento.v_kmh, 1)} <span className="text-sm font-normal text-muted-foreground">km/h</span>
            </>
          }
          detalhe={
            <>
              V0 = {fmt(vento.V0, 1)} m/s (isopletas NBR 6123) · Vk = V0 · 1,00 · 0,79 · 0,85 ={" "}
              {fmt(vento.Vk, 2)} m/s
            </>
          }
        />
        <Indicador
          icone={<Cable className="size-4" />}
          rotulo="Condutor da obra"
          valor={
            <>
              {condutor.tipoCabo} {condutor.awg}
            </>
          }
          detalhe={
            <>
              d = {fmt(condutor.d, 2)} mm · tração tabelada a {fmt(condutor.tempC ?? 25, 0)} °C · vale para todos os
              postes
            </>
          }
        />
      </div>

      {/* Item de visualização: disposição dos postes no mapa do trajeto. */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 print:hidden">
        <button
          type="button"
          onClick={() => setMostrarMapa((v) => !v)}
          disabled={!temCoordsTrajeto || nPostes === 0}
          aria-expanded={mostrarMapa}
          className="flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <MapIcon className="size-4 text-primary" />
            <span className="text-sm font-semibold">Disposição dos postes no mapa</span>
            <span className="text-xs text-muted-foreground">
              {temCoordsTrajeto
                ? nPostes > 0
                  ? `${nPostes} ${nPostes === 1 ? "poste" : "postes"} ao longo do trajeto`
                  : "nenhum poste cadastrado"
                : "coordenadas do trajeto não informadas"}
            </span>
          </span>
          <ChevronDown className={`size-4 shrink-0 transition-transform ${mostrarMapa ? "rotate-180" : ""}`} />
        </button>

        {mostrarMapa && temCoordsTrajeto && nPostes > 0 && (
          <div className="border-t border-border p-4">
            <MapaTrajeto derivacao={deriv} entrega={entrega} postes={marcadores} />
            <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
              {marcadores.map((m) => {
                const t = TIPO_POSTE[m.estrutura] ?? { cor: "#64748b", label: "Poste" };
                return (
                  <li key={m.n} className="flex items-center gap-2 text-xs">
                    <span
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: t.cor }}
                    />
                    <span className="font-mono font-semibold text-foreground">
                      {String(m.n).padStart(2, "0")}
                    </span>
                    <span className="text-muted-foreground">{t.label}</span>
                    <span className="ml-auto tabular-nums text-muted-foreground">
                      ~{fmt(m.distanciaM, 0)} m
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Disposição estimada: início e fim como derivação; o miolo segue o tipo preenchido em
              cada poste. A distância de cada poste acumula o vão aplicado (posição aproximada sobre o
              traçado derivação → entrega). Distância total pelos vãos:{" "}
              <span className="font-medium tabular-nums text-foreground">{fmt(totalVao, 0)} m</span>.
            </p>
          </div>
        )}
      </div>

      <CartoesPostes postes={s.postes} />

      <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block print:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground uppercase">
              <th className="px-3 py-2.5 font-semibold">Nº</th>
              <th className="px-3 py-2.5 font-semibold">Estrutura</th>
              <th className="px-3 py-2.5 font-semibold">Poste</th>
              <th className="px-3 py-2.5 text-right font-semibold">Vão (m)</th>
              <th className="px-3 py-2.5 text-right font-semibold">α (°)</th>
              <th className="px-3 py-2.5 text-right font-semibold">Fases</th>
              <th className="px-3 py-2.5 text-right font-semibold">Fc (daN)</th>
              <th className="px-3 py-2.5 text-right font-semibold">Fp,topo (daN)</th>
              <th className="px-3 py-2.5 text-right font-semibold">F total (daN)</th>
              <th className="px-3 py-2.5 text-right font-semibold">Rn (daN)</th>
              <th className="px-3 py-2.5 text-right font-semibold">Utilização</th>
              <th className="px-3 py-2.5 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {s.postes.map((p, i) => {
              const { notas, espec, semVento } = resumoPoste(p);
              const destaque = !espec && !p.memoria.aprovado ? "bg-destructive/[0.04]" : "";
              return (
                <Fragment key={p.id}>
                  <tr className={`break-inside-avoid ${destaque} ${notas.length ? "" : "border-b"} last:border-0`}>
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td className="px-3 py-2.5">
                      <Estrutura p={p} />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {p.entrada.tipoFisico} {p.entrada.comprimento} m
                    </td>
                    <td className="px-3 py-2.5 text-right">{semVento ? "—" : fmt(p.entrada.vao, 0)}</td>
                    <td className="px-3 py-2.5 text-right">{semVento ? "—" : fmt(p.entrada.alfa, 0)}</td>
                    <td className="px-3 py-2.5 text-right">{semVento ? "—" : p.entrada.nFases}</td>
                    <td className="px-3 py-2.5 text-right">{semVento ? "—" : fmt(p.memoria.Fc, 1)}</td>
                    <td className="px-3 py-2.5 text-right">{semVento ? "—" : fmt(p.memoria.FpTopo, 1)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{espec ? "—" : fmt(p.memoria.Ftotal, 1)}</td>
                    <td className="px-3 py-2.5 text-right">{fmt(p.entrada.resistencia, 0)}</td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {espec ? "—" : <Utilizacao p={p} />}
                    </td>
                    <td className="px-3 py-2.5">
                      <SeloSituacao p={p} espec={espec} />
                    </td>
                  </tr>
                  {notas.length > 0 && (
                    <tr className={`break-inside-avoid border-b last:border-0 ${destaque}`}>
                      <td />
                      <td colSpan={11} className="px-3 pb-2.5 text-xs text-muted-foreground">
                        + {notas.join(" · ")}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <PlantaRede />

      <p className="text-xs text-muted-foreground">
        Esforço considerado: ação do vento sobre o poste (Fp, transferida a 10 cm do topo) somada ao
        vento sobre os condutores (Fc = Cc · a · cos(α/2) · nº de fases), com v ={" "}
        {fmt(vento.v_kmh, 1)} km/h pela coordenada (NBR 6123) e condutor {condutor.tipoCabo}{" "}
        {condutor.awg}. A utilização é comparada ao limiar definido pelo projetista em cada poste;
        postes estaiados são avaliados pela reação residual na base (|Fr| = F − F·h/he, item 6.3.3).
        Trações de projeto e resultantes de deflexão não entram nesta versão — confira sempre com a
        GED-3648 vigente.
      </p>

      <div className="flex flex-wrap gap-3 print:hidden">
        <Button onClick={() => void imprimir(`Memorial ${s.obra || "do projeto"}`)}>
          <Printer className="size-4" /> Imprimir / salvar PDF
        </Button>
        {s.postes.length < MAX_POSTES && (
          <Button variant="outline" onClick={s.reabrir}>
            <Plus className="size-4" /> Adicionar mais postes
          </Button>
        )}
        <Button variant="ghost" onClick={novoProjeto}>
          <RotateCcw className="size-4" /> Novo projeto
        </Button>
      </div>
    </div>
  );
}
