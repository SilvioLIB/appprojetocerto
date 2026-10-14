"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Anchor, Cable, Calculator, Check, CircleCheck, Compass, Flag, Info,
  Milestone, Pencil, Plus, Ruler, Save, Split, TrainFront, TriangleAlert, Undo2, Waves, X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CONDUTORES, CRUZETAS_DIM, postes as catalogoPostes, tracaoProjetoFeixe, tracaoProjetoInterpolada } from "@/lib/validador";
import {
  ESTRUTURAS, LIMIAR_PADRAO, SITUACOES_REDE_EXISTENTE, dimensionarPoste, ehAncoragem, especificacaoAmarracao,
  esforcoAmarracao, fmt, modoTracao, orientacaoLado, trechosDaLinha,
  type CruzetaSel, type EntradaPoste, type EstruturaId, type MemoriaCalculo, type SituacaoRedeExistente,
  type TrechoTracao,
} from "@/lib/dimensionamento";
import {
  CLASSES_TENSAO_TRAFO, FASES_TRAFO, LIMITE_KVA_TRIFASICO_PRFV, acharTransformador, especificacaoTrafo,
  potenciasTrafo, rotuloKVA, type FaseTransformador,
} from "@/lib/transformadores";
import { MAX_POSTES, useProjetoV2 } from "@/lib/projeto-v2-store";
import { registrarVoltar } from "@/lib/nativo/voltar";
import { temTabela, tracaoTabelada } from "@/lib/tracao-tabelada";
import { PLANTA_PADRAO, type SentidoDeflexao } from "@/lib/planta-rede";
import { GlifoPoste } from "./simbolo-dt";
import { MedidorUtilizacao } from "./medidor-utilizacao";
import { ICONES_ESTRUTURA } from "./icones-estrutura";
import { ComUnidade, SelectSimples, paraNumero } from "./campos";

const ICONES = ICONES_ESTRUTURA;

const CABOS = Object.keys(CONDUTORES);
const MATERIAIS_CRUZETA = Object.keys(CRUZETAS_DIM);

/** Rótulo do poste pelo índice na linha (0 → "P01"). */
const rotuloPoste = (i: number) => `P${String(i + 1).padStart(2, "0")}`;

/** "Trecho P01–P03 (vãos à ré 40 · 80 m)" — memorial do vão regulador. */
function descreverTrecho(t: TrechoTracao): string {
  const vaos = t.vaos.map((a) => (a === null ? "—" : fmt(a, 0))).join(" · ");
  return `trecho ${rotuloPoste(t.de)}–${rotuloPoste(t.ate)} (vãos à ré ${vaos} m)`;
}

function Linha({ rotulo, valor, unidade, destaque }: { rotulo: string; valor: string; unidade?: string; destaque?: boolean }) {
  return (
    <li className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm text-muted-foreground">{rotulo}</span>
      <span className={`font-semibold tabular-nums ${destaque ? "text-xl" : "text-sm"}`}>
        {valor}
        {unidade && <span className="ml-1 text-xs font-normal text-muted-foreground">{unidade}</span>}
      </span>
    </li>
  );
}

/**
 * Demarcação visual do lado do poste (vista de topo), com o mesmo símbolo da
 * planta da rede. O eixo da rede é horizontal; a resultante do esforço
 * calculado (vento nos condutores e no poste) é TRANSVERSAL à linha. O duplo T
 * tem a face lisa (lado de MAIOR esforço, Rn) e as cavas (lado de MENOR, Rn/2).
 * Quando o esforço só cabe no lado de maior esforço, a face lisa deve ficar
 * voltada para a resultante — o esquema mostra o poste nessa posição.
 */
function DemarcacaoLado({
  lado,
  ladoMaior,
  ladoMenor,
}: {
  lado: "menor" | "maior" | "excede";
  ladoMaior: number;
  ladoMenor: number;
}) {
  const cor = lado === "excede" ? "var(--destructive)" : "var(--esforco-lisa)";
  // "menor": posição padrão (cavas na resultante); senão face lisa para a resultante.
  const virado = lado !== "menor";
  const seta = (y1: number, y2: number, tracejada: boolean) => {
    const dir = Math.sign(y2 - y1);
    return (
      <>
        <line
          x1="160" y1={y1} x2="160" y2={y2 - dir * 6}
          stroke={cor} strokeWidth={tracejada ? 1.8 : 3} strokeDasharray={tracejada ? "4 3" : undefined}
        />
        <polygon points={`160,${y2} 154,${y2 - dir * 10} 166,${y2 - dir * 10}`} style={{ fill: cor }} />
      </>
    );
  };
  return (
    <svg
      viewBox="0 0 320 140"
      className="mt-3 w-full max-w-sm"
      role="img"
      aria-label="Vista de topo: face do poste voltada para a resultante do esforço"
    >
      {/* Eixo da rede (condutor) */}
      <line x1="20" y1="80" x2="300" y2="80" stroke="var(--primary)" strokeOpacity="0.6" strokeWidth="2" strokeDasharray="5 5" />
      <text x="300" y="96" textAnchor="end" className="fill-muted-foreground text-[10px]">eixo da rede</text>

      {/* Resultante transversal */}
      {lado === "menor" ? (
        <>
          {seta(58, 22, true)}
          {seta(102, 132, true)}
        </>
      ) : (
        seta(58, 18, lado === "excede")
      )}
      {lado === "excede" && (
        <g stroke="var(--destructive)" strokeWidth="3" strokeLinecap="round">
          <line x1="178" y1="22" x2="192" y2="36" />
          <line x1="192" y1="22" x2="178" y2="36" />
        </g>
      )}

      <g transform="translate(160 80)">
        <GlifoPoste angulo={virado ? 0 : -90} escala={0.9} />
      </g>

      {/* Rótulos dos lados */}
      <text x="20" y="20" className="fill-foreground text-[10px] font-semibold">
        face lisa · {fmt(ladoMaior, 0)} daN
      </text>
      <text x="20" y="34" className="fill-muted-foreground text-[10px]">
        cavas · {fmt(ladoMenor, 0)} daN
      </text>
      <text x="300" y="20" textAnchor="end" className="fill-muted-foreground text-[10px]">
        {lado === "menor" ? "sentido livre" : lado === "maior" ? "face lisa → resultante" : "subir a classe"}
      </text>
    </svg>
  );
}

// Ângulo mínimo de travessia por tipo de obstáculo (NDU 007). Referência.
const ANGULOS_TRAVESSIA: { obstaculo: string; angulo: number }[] = [
  { obstaculo: "Ferrovias", angulo: 60 },
  { obstaculo: "Rodovias", angulo: 15 },
  { obstaculo: "Outras vias de transporte", angulo: 15 },
  { obstaculo: "Redes de distribuição", angulo: 45 },
  { obstaculo: "Linhas e redes de telecomunicações, sinalização e controle", angulo: 45 },
  { obstaculo: "Linhas de transmissão e alta tensão", angulo: 45 },
  { obstaculo: "Tubulações metálicas", angulo: 60 },
  { obstaculo: "Tubulações não metálicas", angulo: 30 },
  { obstaculo: "Rios, canais, córregos, ravinas", angulo: 30 },
  { obstaculo: "Cercas de arame", angulo: 15 },
];

/**
 * Poste de cruzamento: painel apenas informativo (sem cálculo). Reúne as alturas
 * mínimas de rede e os ângulos mínimos de travessia da NDU 007.
 */
function PainelCruzamento() {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h2 className="text-sm font-semibold">Travessias e cruzamentos — referência (NDU 007)</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Etapa apenas informativa: alturas mínimas de rede e ângulos mínimos de travessia.
            Não há cálculo de esforço neste ponto.
          </p>
        </div>
      </div>

      {/* Alturas mínimas de rede */}
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Ruler className="size-4 text-muted-foreground" /> Altura mínima da rede
        </h3>
        <ul className="mt-3 flex flex-col divide-y divide-dashed divide-border">
          <li className="flex items-baseline justify-between gap-4 py-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Milestone className="size-3.5 shrink-0" />
              Travessia sobre rodovias, entre postes de ancoragem
            </span>
            <span className="text-lg font-semibold tabular-nums">
              7<span className="ml-1 text-xs font-normal text-muted-foreground">m</span>
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-4 py-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <TrainFront className="size-3.5 shrink-0" />
              Travessia sobre ferrovias, do ponto de flecha à passagem do veículo/locomotiva
            </span>
            <span className="text-lg font-semibold tabular-nums">
              9<span className="ml-1 text-xs font-normal text-muted-foreground">m</span>
            </span>
          </li>
        </ul>
      </div>

      {/* Ângulo mínimo de travessia */}
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Split className="size-4 text-muted-foreground" /> Ângulo mínimo de travessia
        </h3>
        <div className="mt-3 overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60 text-left text-xs font-medium text-muted-foreground">
                <th className="px-3 py-2">Obstáculo</th>
                <th className="px-3 py-2 text-right">Ângulo mínimo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ANGULOS_TRAVESSIA.map((r) => (
                <tr key={r.obstaculo}>
                  <td className="px-3 py-2 text-muted-foreground">{r.obstaculo}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.angulo}°</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Travessias sobre ferrovias */}
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <TrainFront className="size-4 text-muted-foreground" /> Travessias sobre ferrovias
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Altura mínima entre o ponto de flecha e o local de passagem do veículo locomotivo:{" "}
          <span className="font-semibold text-foreground">9 m</span>.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" /> Informação visual: página 258 da NDU 007.
        </p>
      </div>

      {/* Travessias sobre águas fluviais */}
      <div className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Waves className="size-4 text-muted-foreground" /> Travessias sobre águas fluviais
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" /> Informação visual: página 260 da NDU 007.
        </p>
      </div>
    </section>
  );
}

/** Número salvo → texto do input (vírgula decimal); ausente → "". */
const txt = (v: number | undefined) => (typeof v === "number" ? String(v).replace(".", ",") : "");

/** Índice do modelo de cruzeta salvo dentro do catálogo do material ("" se sumiu). */
function indiceCruzeta(c: CruzetaSel | undefined): string {
  if (!c) return "";
  const i = (CRUZETAS_DIM[c.material]?.modelos ?? []).findIndex(
    (mo) => mo.formato === c.formato && mo.Lmm === c.Lmm && mo.cmm === c.cmm,
  );
  return i >= 0 ? String(i) : "";
}

/**
 * Dimensionamento do poste atual: estrutura → parâmetros → esforço → seguir.
 * Com um poste em edição (`editandoId` no store), a tela reabre esse poste com
 * os dados gravados, no lugar dele na linha; montada com `key` pelo id, então
 * os estados abaixo nascem da entrada salva.
 */
export function PosteAtual() {
  const s = useProjetoV2();
  const editando = s.editandoId ? s.postes.find((p) => p.id === s.editandoId) ?? null : null;
  const idxEdicao = editando ? s.postes.indexOf(editando) : -1;
  // Postes antes e depois do poste desta tela (o novo é sempre o último).
  const postesAntes = editando ? s.postes.slice(0, idxEdicao) : s.postes;
  const postesDepois = editando ? s.postes.slice(idxEdicao + 1) : [];
  const n = postesAntes.length + 1;
  // Entrada gravada do poste em edição: semente de todos os campos.
  const se = editando?.entrada;
  const rx = se?.redeExistente;

  const [estrutura, setEstrutura] = useState<EstruturaId | null>(se?.estrutura ?? null);
  // Voltar do Android: na edição, sai da edição; senão, com a estrutura
  // escolhida, volta à escolha da estrutura.
  const emEdicao = editando !== null;
  const cancelarEdicao = s.cancelarEdicao;
  useEffect(() => {
    if (emEdicao) {
      return registrarVoltar(() => {
        cancelarEdicao();
        return true;
      });
    }
    if (estrutura === null) return;
    return registrarVoltar(() => {
      setEstrutura(null);
      return true;
    });
  }, [estrutura, emEdicao, cancelarEdicao]);
  const [tipoFisico, setTipoFisico] = useState(se?.tipoFisico ?? "circular");
  const [comprimento, setComprimento] = useState(se ? String(se.comprimento) : "");
  const [resistencia, setResistencia] = useState(se ? String(se.resistencia) : "");
  const [vao, setVao] = useState(se && se.vao > 0 ? txt(se.vao) : "");
  // Trecho de tração: vão até o poste anterior e, em ângulo/circuito duplo, se
  // a estrutura é ancorada (fecha o trecho).
  const [vaoRe, setVaoRe] = useState(txt(se?.vaoRe));
  const [ancorado, setAncorado] = useState(se?.ancorado ?? false);
  const [alfa, setAlfa] = useState(se ? txt(se.alfa) : "0");
  // Lado da curva — só para a planta da rede; não entra no cálculo.
  const [sentido, setSentido] = useState<SentidoDeflexao>(editando?.planta?.sentido ?? "direita");
  const [nFases, setNFases] = useState(se ? String(se.nFases) : "3");
  const [estaiHe, setEstaiHe] = useState("");

  // Derivação (poste 01): rede existente no poste de onde a nova rede sai.
  const [exCabo, setExCabo] = useState(rx?.tipoCabo ?? "");
  const [exAwg, setExAwg] = useState(rx?.awg ?? "");
  const [exFases, setExFases] = useState(rx ? String(rx.nFases) : "3");
  const [exSituacao, setExSituacao] = useState<SituacaoRedeExistente | null>(rx?.situacao ?? null);
  const [exAlfa, setExAlfa] = useState(rx ? txt(rx.alfa) : "0");
  const [exVao, setExVao] = useState(txt(rx?.vao));
  const [exTheta, setExTheta] = useState(rx ? txt(rx.anguloDerivacao) : "90");
  const [exLado, setExLado] = useState<"maior" | "menor">(rx?.lado ?? "maior");
  const [exTracaoInf, setExTracaoInf] = useState(txt(rx?.tracaoInformada));

  // Especificações por tipo de estrutura
  // Transformador guiado: fase → classe de tensão → potência (kVA). A partir
  // dessa escolha o poste é especificado direto (comprimento + esforço). O
  // método dos momentos (MA, b+d, cruzeta, isolador, chave) está em standby.
  const [trafoFase, setTrafoFase] = useState<FaseTransformador>(se?.transformador?.fase ?? "monofasico");
  const [trafoClasse, setTrafoClasse] = useState(se?.transformador?.classe ?? "");
  const [trafoKVA, setTrafoKVA] = useState(se?.transformador ? String(se.transformador.kVA) : "");
  // Poste de PRFV: altura e esforço seguem o protocolo próprio (classe oculta).
  const [prfv, setPrfv] = useState(se?.transformador?.prfv ?? false);
  const [extraCabo, setExtraCabo] = useState(se?.circuitoExtra?.tipoCabo ?? "");
  const [extraAwg, setExtraAwg] = useState(se?.circuitoExtra?.awg ?? "");
  const [extraFases, setExtraFases] = useState(se?.circuitoExtra ? String(se.circuitoExtra.nFases) : "3");
  const [cruzMaterial, setCruzMaterial] = useState(se?.cruzeta?.material ?? "");
  const [cruzModelo, setCruzModelo] = useState(indiceCruzeta(se?.cruzeta)); // índice em CRUZETAS_DIM[material].modelos
  // Tração por condutor informada à mão (só p/ cabos fora da tabela). O
  // cabo do projeto é fixo, então o valor é herdado do último poste que o usou.
  const [tracaoInf, setTracaoInf] = useState(() => {
    if (typeof se?.tracaoInformada === "number") return txt(se.tracaoInformada);
    const ultima = [...postesAntes].reverse().find((p) => typeof p.entrada.tracaoInformada === "number");
    return ultima ? txt(ultima.entrada.tracaoInformada) : "";
  });
  const [tracaoExtraInf, setTracaoExtraInf] = useState(txt(se?.tracaoExtraInformada));

  // Na edição, o resultado gravado já aparece (com o estai, se houver);
  // qualquer mudança de campo o invalida e pede um novo cálculo.
  const [calc, setCalc] = useState<{ entrada: EntradaPoste; memoria: MemoriaCalculo } | null>(
    editando ? { entrada: editando.entrada, memoria: editando.memoria } : null,
  );
  const [erro, setErro] = useState<string | null>(null);

  // Tipos físicos do catálogo (na derivação, o do poste existente).
  const tiposFisicos = useMemo(() => Object.keys(catalogoPostes), []);
  const tipoFisicoAtual = tiposFisicos.includes(tipoFisico) ? tipoFisico : tiposFisicos[0];
  const comprimentos = useMemo(() => Object.keys(catalogoPostes[tipoFisicoAtual] ?? {}), [tipoFisicoAtual]);
  const compAtual = comprimentos.includes(comprimento) ? comprimento : comprimentos[0];
  const resistencias = useMemo(
    () => Object.keys(catalogoPostes[tipoFisicoAtual]?.[compAtual] ?? {}),
    [tipoFisicoAtual, compAtual],
  );
  const resistAtual = resistencias.includes(resistencia) ? resistencia : resistencias[0];

  // Qualquer mudança de entrada invalida o esforço já calculado (e o estai).
  const aoMudar = <T,>(setter: (v: T) => void) => (v: T) => {
    setCalc(null);
    setErro(null);
    setEstaiHe("");
    setter(v);
  };
  // Trocar de estrutura zera todas as especificações específicas do tipo.
  const mudarEstrutura = (id: EstruturaId) => {
    setCalc(null);
    setErro(null);
    setEstaiHe("");
    setExCabo("");
    setExAwg("");
    setExFases("3");
    setExSituacao(null);
    setExAlfa("0");
    setExVao("");
    setExTheta("90");
    setExLado("maior");
    setExTracaoInf("");
    setTrafoFase("monofasico");
    setTrafoClasse("");
    setTrafoKVA("");
    setPrfv(false);
    setExtraCabo("");
    setExtraAwg("");
    setExtraFases("3");
    setTracaoExtraInf("");
    setCruzMaterial("");
    setCruzModelo("");
    setAncorado(false);
    // Amarração: a altura é herdada dos postes já usados na linha (mesma altura
    // dos postes em uso). Semeia tipo físico e altura a partir do último poste.
    if (id === "amarracao") {
      const ultimo = postesAntes[postesAntes.length - 1];
      if (ultimo) {
        setTipoFisico(ultimo.entrada.tipoFisico);
        setComprimento(String(ultimo.entrada.comprimento));
      }
    }
    setEstrutura(id);
  };
  const mudarTipoFisico = aoMudar(setTipoFisico);
  const mudarComprimento = aoMudar(setComprimento);
  const mudarResistencia = aoMudar(setResistencia);
  const mudarVao = aoMudar(setVao);
  const mudarVaoRe = aoMudar(setVaoRe);
  const mudarAncorado = aoMudar(setAncorado);
  const mudarAlfa = aoMudar(setAlfa);
  const mudarNFases = aoMudar(setNFases);
  const mudarExCabo = aoMudar((v: string) => {
    setExCabo(v);
    setExAwg("");
  });
  const mudarExAwg = aoMudar(setExAwg);
  const mudarExFases = aoMudar(setExFases);
  const mudarExSituacao = aoMudar(setExSituacao);
  const mudarExAlfa = aoMudar(setExAlfa);
  const mudarExVao = aoMudar(setExVao);
  const mudarExTheta = aoMudar(setExTheta);
  const mudarExLado = aoMudar(setExLado);
  const mudarExTracaoInf = aoMudar(setExTracaoInf);
  // Trocar a fase reinicia classe e potência (tabelas diferentes por fase). Em
  // PRFV a classe fica na canônica ("15"), pois altura/esforço não dependem dela.
  const mudarTrafoFase = aoMudar((v: FaseTransformador) => {
    setTrafoFase(v);
    setTrafoClasse(prfv ? "15" : "");
    setTrafoKVA("");
  });
  // Alternar PRFV: liga o protocolo próprio; classe passa à canônica ("15") e
  // some da UI (só fase e potência são pedidas), ou volta a ser exigida.
  const mudarPrfv = aoMudar((v: boolean) => {
    setPrfv(v);
    setTrafoClasse(v ? "15" : "");
    setTrafoKVA("");
  });
  // Trocar a classe reinicia a potência (lista de kVA muda por classe).
  const mudarTrafoClasse = aoMudar((v: string) => {
    setTrafoClasse(v);
    setTrafoKVA("");
  });
  const mudarTrafoKVA = aoMudar(setTrafoKVA);
  const mudarExtraCabo = aoMudar((v: string) => {
    setExtraCabo(v);
    setExtraAwg("");
  });
  const mudarExtraAwg = aoMudar(setExtraAwg);
  const mudarExtraFases = aoMudar(setExtraFases);
  const mudarCruzMaterial = aoMudar((v: string) => {
    setCruzMaterial(v);
    setCruzModelo("");
  });
  const mudarCruzModelo = aoMudar(setCruzModelo);
  const mudarTracaoInf = aoMudar(setTracaoInf);
  const mudarTracaoExtraInf = aoMudar(setTracaoExtraInf);

  if (!s.vento || !s.condutor) return null;
  const { vento, condutor } = s;

  // Contador de espaço: soma dos vãos desde o último poste de amarração (o
  // contador zera a cada amarração colocada). Ao atingir o passo, o próximo
  // poste é OBRIGATORIAMENTE de amarração.
  // Na edição, conta só os postes antes do editado.
  const idxUltimaAmarracao = postesAntes.reduce(
    (idx, p, i) => (p.entrada.estrutura === "amarracao" ? i : idx),
    -1,
  );
  const distanciaAcumulada = postesAntes
    .slice(idxUltimaAmarracao + 1)
    .reduce((acc, p) => acc + (p.entrada.vao || 0), 0);
  const passoAmarracao = s.passoAmarracao;
  const precisaAmarracao = passoAmarracao > 0 && distanciaAcumulada >= passoAmarracao;

  const ehDerivacao = estrutura === "derivacao";
  // Estruturas sem ação de vento nos condutores (não pedem vão/ângulo/limiar):
  // poste com transformador (especificado direto).
  const semVento = estrutura === "transformador";
  // Rede existente da derivação: cabo sem tabela pede a tração à mão.
  const bitolasEx = exCabo ? CONDUTORES[exCabo]?.bitolas ?? [] : [];
  const exTracaoDisponivel =
    !!exCabo && !!exAwg && (tracaoProjetoFeixe(exCabo, exAwg) !== null || temTabela(exCabo, exAwg));
  const pedeCruzeta = estrutura === "derivacao" || estrutura === "circuito_duplo";

  // Poste de amarração: esforço tabelado pelo cabo do projeto (600/1000 daN) e
  // altura herdada dos postes da linha. Ainda pede o vão (alimenta o contador de
  // amarração), mas não passa por verificação de vento.
  const ehAmarracao = estrutura === "amarracao";
  const especAmarrPreview = ehAmarracao
    ? especificacaoAmarracao(condutor.tipoCabo, condutor.awg, Number(compAtual) || 0)
    : null;

  // Tração de projeto: como entra neste poste (deflexão, início/fim ou não entra)
  // e se o cabo está na tabela — fora dela, o projetista informa o valor.
  const alfaAtual = ehDerivacao ? 0 : paraNumero(alfa);
  const modoAtual = estrutura ? modoTracao(estrutura, Number.isNaN(alfaAtual) ? 0 : alfaAtual) : null;
  const tracaoTab = tracaoProjetoFeixe(condutor.tipoCabo, condutor.awg);
  const tracaoInterp = tracaoProjetoInterpolada(condutor.tipoCabo, condutor.awg);
  const tracaoExtraTab = extraCabo && extraAwg ? tracaoProjetoFeixe(extraCabo, extraAwg) : null;
  // Cabos com tabela de montagem (CA e CAA) dispensam a tração informada: ela
  // sai do vão regulador do trecho ou do vão do poste, na temperatura de projeto.
  const tempC = condutor.tempC;
  const tracaoDisponivel = tracaoTab !== null || temTabela(condutor.tipoCabo, condutor.awg);
  const tracaoExtraDisponivel =
    tracaoExtraTab !== null || (!!extraCabo && !!extraAwg && temTabela(extraCabo, extraAwg));
  const pedeTracaoExtra = modoAtual === "deflexao" && estrutura === "circuito_duplo" && !!extraAwg && !tracaoExtraDisponivel;
  // Trecho de tração do poste atual. O novo é o último da linha (só o trecho de
  // ré); o editado fica no seu lugar, entre os postes antes e depois dele.
  const podeAncorar = estrutura === "angulo" || estrutura === "circuito_duplo";
  const trechosNovo = (e: Pick<EntradaPoste, "estrutura" | "ancorado" | "vaoRe">) =>
    trechosDaLinha([
      ...postesAntes.map((p) => p.entrada),
      e,
      ...postesDepois.map((p) => p.entrada),
    ])[postesAntes.length];
  const vaoReN = paraNumero(vaoRe);
  const trechoRe =
    estrutura && n > 1
      ? trechosNovo({ estrutura, ancorado: podeAncorar && ancorado, vaoRe: vaoReN > 0 ? vaoReN : undefined })[0] ?? null
      : null;
  // Prévia da mudança de estado (só informativa): no vão regulador do trecho
  // ou, sem ele, no vão médio digitado.
  const vaoPrevia = trechoRe?.ar ?? paraNumero(vao);
  const previaTabela =
    vaoPrevia > 0 ? tracaoTabelada(condutor.tipoCabo, condutor.awg, vaoPrevia, tempC) : null;

  const bitolasExtra = extraCabo ? CONDUTORES[extraCabo]?.bitolas ?? [] : [];
  const modelosCruzeta = cruzMaterial ? CRUZETAS_DIM[cruzMaterial]?.modelos ?? [] : [];

  // Transformador: potências disponíveis para a fase+classe e o item selecionado.
  // Em PRFV a lista independe da classe (canônica "15"); no trifásico só entram
  // potências ≤ 75 kVA (limite do protocolo PRFV).
  const potenciasDisponiveis = prfv
    ? potenciasTrafo(trafoFase, "15").filter(
        (t) => trafoFase !== "trifasico" || t.kVA <= LIMITE_KVA_TRIFASICO_PRFV,
      )
    : trafoClasse
      ? potenciasTrafo(trafoFase, trafoClasse)
      : [];
  const trafoSelecionado = acharTransformador(trafoFase, trafoClasse, Number(trafoKVA));
  // Especificação do poste (comprimento + esforço) a partir da fase + potência.
  const especTrafoPreview = trafoSelecionado
    ? especificacaoTrafo(trafoFase, trafoSelecionado.kVA, prfv)
    : null;

  // Monta a cruzeta escolhida a partir do material + índice do modelo.
  const montarCruzeta = (): CruzetaSel | undefined => {
    const modelo = CRUZETAS_DIM[cruzMaterial]?.modelos[Number(cruzModelo)];
    if (!modelo) return undefined;
    return { material: cruzMaterial, formato: modelo.formato, Lmm: modelo.Lmm, cmm: modelo.cmm };
  };

  const calcular = () => {
    if (!estrutura) return;

    // Passo de amarração atingido: este poste é obrigatoriamente de amarração.
    if (precisaAmarracao && estrutura !== "amarracao") {
      setErro("O passo de amarração foi atingido — este poste deve ser de amarração.");
      return;
    }

    // Vão/ângulo só valem quando há vento nos condutores (não no poste com
    // transformador, especificado direto). Na derivação o ângulo é o θ da rede existente.
    let vaoN = 0;
    let alfaN = 0;
    if (!semVento) {
      vaoN = paraNumero(vao);
      if (Number.isNaN(vaoN) || vaoN <= 0) {
        setErro("Informe um vão médio maior que zero.");
        return;
      }
      alfaN = ehDerivacao ? 0 : paraNumero(alfa);
      if (Number.isNaN(alfaN) || alfaN < 0 || alfaN > 90) {
        setErro("O ângulo de deflexão vai de 0° a 90°.");
        return;
      }
    }
    // Vão à ré (do segundo poste em diante): fecha o trecho de tração.
    // Obrigatório — sem ele não há vão regulador.
    let vaoReCalc: number | undefined;
    if (n > 1) {
      if (Number.isNaN(vaoReN) || vaoReN <= 0) {
        setErro(`Informe o vão à ré (distância até o poste ${String(n - 1).padStart(2, "0")}), maior que zero.`);
        return;
      }
      vaoReCalc = vaoReN;
    }
    // Limiar de esforço fixo em 100% para todos os postes (F/Rn ≤ 100%).
    const limiarN = LIMIAR_PADRAO;

    // Especificações por tipo de estrutura
    const espec: Partial<EntradaPoste> = {};
    if (estrutura === "derivacao") {
      if (!exCabo || !exAwg) {
        setErro("Escolha o cabo da rede existente.");
        return;
      }
      if (!exSituacao) {
        setErro("Informe a situação da rede existente no poste (passagem, ângulo ou fim de linha).");
        return;
      }
      const exAlfaN = exSituacao === "angulo" ? paraNumero(exAlfa) : 0;
      if (Number.isNaN(exAlfaN) || exAlfaN < 0 || exAlfaN > 90) {
        setErro("O ângulo da rede existente vai de 0° a 90°.");
        return;
      }
      const exVaoN = paraNumero(exVao);
      if (Number.isNaN(exVaoN) || exVaoN <= 0) {
        setErro("Informe o vão médio da rede existente, maior que zero.");
        return;
      }
      const thetaN = paraNumero(exTheta);
      if (Number.isNaN(thetaN) || thetaN < 0 || thetaN > 180) {
        setErro("O ângulo da derivação vai de 0° a 180°.");
        return;
      }
      let exTracaoN: number | undefined;
      if (!exTracaoDisponivel) {
        exTracaoN = paraNumero(exTracaoInf);
        if (Number.isNaN(exTracaoN) || exTracaoN <= 0) {
          setErro(`O cabo existente ${exCabo} ${exAwg} não tem tabela de tração — informe a tração por condutor (daN).`);
          return;
        }
      }
      espec.redeExistente = {
        tipoCabo: exCabo,
        awg: exAwg,
        nFases: Number(exFases),
        situacao: exSituacao,
        alfa: exAlfaN,
        vao: exVaoN,
        anguloDerivacao: thetaN,
        lado: tipoFisicoAtual === "circular" ? "maior" : exLado,
        ...(exTracaoN !== undefined ? { tracaoInformada: exTracaoN } : {}),
      };
    }
    if (estrutura === "transformador") {
      const t = acharTransformador(trafoFase, trafoClasse, Number(trafoKVA));
      if (!t) {
        setErro("Escolha o tipo, a classe de tensão e a potência do transformador.");
        return;
      }
      // Só a seleção do transformador é necessária: fase + potência especificam
      // o poste (comprimento + esforço). A, B e massa são congeladas do catálogo.
      espec.transformador = {
        fase: trafoFase,
        classe: trafoClasse,
        kVA: t.kVA,
        A_mm: t.A_mm,
        B_mm: t.B_mm,
        massaKg: t.massaKg,
        prfv,
      };
    }
    if (estrutura === "circuito_duplo") {
      if (!extraCabo || !extraAwg) {
        setErro("Escolha o condutor do circuito extra.");
        return;
      }
      espec.circuitoExtra = { tipoCabo: extraCabo, awg: extraAwg, nFases: Number(extraFases) };
    }
    if (pedeCruzeta) {
      const cruzeta = montarCruzeta();
      if (!cruzeta) {
        setErro("Escolha a cruzeta (material e modelo).");
        return;
      }
      espec.cruzeta = cruzeta;
    }

    // Tração de projeto fora da tabela: exige o valor informado.
    const modoCalc = modoTracao(estrutura, alfaN);
    if (modoCalc && !tracaoDisponivel) {
      const t = paraNumero(tracaoInf);
      if (Number.isNaN(t) || t <= 0) {
        setErro(`O cabo ${condutor.tipoCabo} ${condutor.awg} não tem tração de projeto na tabela — informe a tração por condutor (daN).`);
        return;
      }
      espec.tracaoInformada = t;
    }
    if (modoCalc === "deflexao" && estrutura === "circuito_duplo" && espec.circuitoExtra && !tracaoExtraDisponivel) {
      const t = paraNumero(tracaoExtraInf);
      if (Number.isNaN(t) || t <= 0) {
        setErro("O cabo do circuito extra não tem tração de projeto na tabela — informe a tração por condutor (daN).");
        return;
      }
      espec.tracaoExtraInformada = t;
    }

    // Poste com transformador: comprimento e esforço vêm da especificação (fase
    // + potência), não dos seletores do catálogo. O tipo físico (circular/duplo
    // T) segue a escolha do projetista, sem alterar comprimento nem esforço.
    const especPoste =
      estrutura === "transformador" && espec.transformador
        ? especificacaoTrafo(espec.transformador.fase, espec.transformador.kVA, espec.transformador.prfv)
        : null;

    // Poste de amarração: o esforço é tabelado pela bitola do cabo do projeto
    // (600/1000 daN); a altura vem do seletor (herdada dos postes da linha).
    const esforcoAmarr = estrutura === "amarracao" ? esforcoAmarracao(condutor.awg) : null;

    const entrada: EntradaPoste = {
      estrutura,
      tipoFisico: tipoFisicoAtual,
      comprimento: especPoste ? especPoste.comprimentoM : Number(compAtual),
      resistencia: especPoste ? especPoste.esforcoDaN : esforcoAmarr ?? Number(resistAtual),
      vao: vaoN,
      ...(vaoReCalc !== undefined ? { vaoRe: vaoReCalc } : {}),
      ...(podeAncorar && ancorado ? { ancorado: true } : {}),
      alfa: alfaN,
      nFases: Number(nFases),
      limiarPct: limiarN,
      ...espec,
    };
    try {
      setCalc({ entrada, memoria: dimensionarPoste(vento.v_kmh, condutor.tipoCabo, condutor.awg, entrada, tempC, trechosNovo(entrada)) });
      setEstaiHe("");
      setErro(null);
    } catch (e) {
      setCalc(null);
      setErro(e instanceof Error ? e.message : "Erro no cálculo.");
    }
  };

  // Recalcula o poste atual com um estai fixado a `estaiHe` metros do solo.
  const aplicarEstai = () => {
    if (!calc) return;
    const heN = paraNumero(estaiHe);
    if (Number.isNaN(heN) || heN <= 0) {
      setErro("Informe a altura do estai (m) maior que zero.");
      return;
    }
    const entrada: EntradaPoste = { ...calc.entrada, estaiHe: heN };
    try {
      setCalc({ entrada, memoria: dimensionarPoste(vento.v_kmh, condutor.tipoCabo, condutor.awg, entrada, tempC, trechosNovo(entrada)) });
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro no cálculo do estai.");
    }
  };

  // Volta o poste ao estado sem estai.
  const removerEstai = () => {
    if (!calc) return;
    const entrada: EntradaPoste = { ...calc.entrada, estaiHe: undefined };
    setCalc({ entrada, memoria: dimensionarPoste(vento.v_kmh, condutor.tipoCabo, condutor.awg, entrada, tempC, trechosNovo(entrada)) });
    setEstaiHe("");
    setErro(null);
  };

  const limparFormulario = () => {
    setEstrutura(null);
    setTipoFisico("circular");
    setComprimento("");
    setResistencia("");
    setVao("");
    setVaoRe("");
    setAncorado(false);
    setAlfa("0");
    setSentido("direita");
    setNFases("3");
    setEstaiHe("");
    setExCabo("");
    setExAwg("");
    setExFases("3");
    setExSituacao(null);
    setExAlfa("0");
    setExVao("");
    setExTheta("90");
    setExLado("maior");
    setExTracaoInf("");
    setTrafoFase("monofasico");
    setTrafoClasse("");
    setTrafoKVA("");
    setPrfv(false);
    setExtraCabo("");
    setExtraAwg("");
    setExtraFases("3");
    setTracaoExtraInf("");
    setCruzMaterial("");
    setCruzModelo("");
    setCalc(null);
    setErro(null);
    // tracaoInf fica: é do cabo do projeto, igual para os próximos postes.
  };

  const adicionarMais = () => {
    if (!calc) return;
    s.adicionarPoste(calc.entrada, calc.memoria, { virado: false, sentido });
    toast.success(`Poste ${String(n).padStart(2, "0")} adicionado à linha`);
    limparFormulario();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const concluir = () => {
    if (!calc) return;
    s.adicionarPoste(calc.entrada, calc.memoria, { virado: false, sentido });
    s.concluir();
  };

  // Edição: grava no mesmo lugar da linha (a linha inteira é recalculada, pois
  // vão e ancoragem mexem nos trechos de tração dos vizinhos).
  const salvarEdicao = () => {
    if (!calc || !editando) return;
    s.substituirPoste(editando.id, calc.entrada, calc.memoria, {
      ...PLANTA_PADRAO,
      ...editando.planta,
      sentido,
    });
    toast.success(`Poste ${String(n).padStart(2, "0")} atualizado — linha recalculada`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Cabe mais um depois de gravar o atual? (limite interno do projeto)
  const podeMais = s.postes.length + 1 < MAX_POSTES;
  const m = calc?.memoria;
  const temExtras = !!m && (m.Fcruzeta !== null || m.Fextra !== null);
  // Poste com transformador (regra vigente): poste especificado direto pela fase
  // + potência (painel próprio, sem verificação de vento).
  const especTrafo = m?.especTrafo ?? null;
  // Poste de amarração: especificado pelo cabo do projeto (esforço tabelado).
  const especAmarr = m?.especAmarracao ?? null;
  // Mudança de estado do poste calculado: trechos, vão usado e cabos (avisos).
  // Tração tabelada do poste calculado: trechos e vão usados.
  const tabMemoria = m?.tracao?.tabelada ?? null;
  const trechosMemoria = tabMemoria ? m?.tracao?.trechos ?? [] : [];
  const vaoTracao = tabMemoria?.vao ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header className="mb-1 flex items-baseline gap-3">
        <span className="font-mono text-2xl font-semibold text-primary tabular-nums">
          {String(n).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">Poste {String(n).padStart(2, "0")}</h1>
          <p className="text-sm text-muted-foreground">
            {editando
              ? "Refaça este poste: troque a estrutura, a altura, o esforço ou o vão e calcule de novo."
              : "Escolha o tipo da estrutura e calcule o esforço deste ponto da linha."}
          </p>
        </div>
      </header>

      {editando && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/[0.06] p-4">
          <div className="flex min-w-0 items-start gap-2">
            <Pencil className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Editando um poste já dimensionado</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                O resultado gravado aparece abaixo. Mudou algum campo? Calcule de novo e salve — a
                linha inteira é recalculada. Cancelar mantém o poste como estava.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={s.cancelarEdicao}>
            <Undo2 className="size-4" /> Cancelar edição
          </Button>
        </div>
      )}

      {/* Contador de espaço + flag de amarração (ativo quando o passo > 0) */}
      {passoAmarracao > 0 && (
        <div
          className={`rounded-xl border p-4 ${
            precisaAmarracao ? "border-violet-500/60 bg-violet-500/10" : "border-border bg-card ring-1 ring-foreground/10"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Ruler className="size-3.5" /> Contador de espaço
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {fmt(distanciaAcumulada, 0)} m
              <span className="ml-1 text-xs font-normal text-muted-foreground">/ passo {fmt(passoAmarracao, 0)} m</span>
            </span>
          </div>
          {precisaAmarracao && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border-l-4 border-violet-500 bg-violet-500/10 p-3">
              <Flag className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" />
              <div>
                <div className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                  Poste de amarração obrigatório
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  A distância acumulada ({fmt(distanciaAcumulada, 0)} m) atingiu o passo de amarração
                  ({fmt(passoAmarracao, 0)} m). Este ponto deve receber um <strong>poste de
                  amarração</strong> — âncora que estabiliza a rede e alivia os esforços mecânicos.
                  O tipo de estrutura fica travado em <strong>Amarração</strong> até o poste ser
                  adicionado; o esforço é tabelado pelo cabo do projeto.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="text-sm font-semibold">Seu poste é de:</h2>
        {precisaAmarracao && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Flag className="size-3.5 shrink-0" /> Passo de amarração atingido — só é possível
            adicionar um poste de amarração agora.
          </p>
        )}
        {/* Cartões de escolha (ref.: Icon Card Radio Group do 21st, id 28351). */}
        <div role="radiogroup" aria-label="Tipo da estrutura" className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
          {ESTRUTURAS.map((e) => {
            const Icone = ICONES[e.id];
            const ativo = estrutura === e.id;
            // Quando o passo de amarração é atingido, o tipo fica travado em
            // "amarração" — as demais estruturas ficam desabilitadas.
            // A derivação é sempre o poste 01 (poste existente de onde a rede sai).
            const bloqueado = (precisaAmarracao && e.id !== "amarracao") || (e.id === "derivacao" && n > 1);
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={ativo}
                disabled={bloqueado}
                onClick={() => mudarEstrutura(e.id)}
                className={`group/cartao relative flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                  ativo
                    ? "border-primary bg-primary/[0.06] shadow-[0_0_0_1px_var(--primary)]"
                    : bloqueado
                      ? "cursor-not-allowed border-dashed border-border bg-muted/30 opacity-50"
                      : "border-border bg-background hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm"
                }`}
              >
                {/* Selo de seleção */}
                <span
                  aria-hidden
                  className={`absolute top-2.5 right-2.5 flex size-4 items-center justify-center rounded-full border transition-colors ${
                    ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"
                  }`}
                >
                  {ativo && <Check className="selo-entrar size-2.5" strokeWidth={3.5} />}
                </span>
                <span
                  className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                    ativo
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover/cartao:bg-primary/10 group-hover/cartao:text-primary"
                  }`}
                >
                  <Icone className="size-4" />
                </span>
                <span className="pr-5 text-sm leading-tight font-medium">{e.label}</span>
                <span className="text-xs text-muted-foreground">{e.descricao}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Vento no poste e nos condutores entra em todos os postes calculados. A tração dos cabos
          entra nos ângulos (α &gt; 0) e no início ou fim da linha (derivação e fim de linha). Poste
          com transformador e amarração são especificados por tabela; cruzamento é informativo. A
          derivação só existe no poste 01: é a verificação do poste existente de onde a rede sai.
        </p>
      </section>

      {/* Trecho de tração: vão à ré e ancoragem (vão regulador da mudança de estado). */}
      {estrutura && estrutura !== "cruzamento" && (n > 1 || podeAncorar) && (
        <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">Trecho entre ancoragens</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Na mudança de estado, a tração vem do vão regulador do trecho entre ancoragens,
            ar = √(Σa³/Σa). Fim de linha, amarração e derivação sempre fecham o trecho. O vão
            médio continua valendo para o vento nos cabos.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {n > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="v2-vao-re">Vão à ré</Label>
                <ComUnidade unidade="m">
                  <Input
                    id="v2-vao-re"
                    inputMode="decimal"
                    placeholder="ex.: 80"
                    value={vaoRe}
                    onChange={(e) => mudarVaoRe(e.target.value)}
                    className="pr-10"
                  />
                </ComUnidade>
                <span className="text-xs text-muted-foreground">
                  Distância até o poste {String(n - 1).padStart(2, "0")}.
                </span>
              </div>
            )}
            {podeAncorar && (
              <div className="flex flex-col gap-1.5">
                <Label>Estrutura ancorada?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: false, r: "Não", d: "O trecho continua" },
                    { v: true, r: "Sim", d: "Fecha o trecho aqui" },
                  ].map((op) => {
                    const ativo = ancorado === op.v;
                    return (
                      <button
                        key={op.r}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => mudarAncorado(op.v)}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          ativo
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{op.r}</span>
                        <span className={`text-xs ${ativo ? "text-accent-foreground/75" : "text-muted-foreground"}`}>
                          {op.d}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {trechoRe && vaoReN > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {trechoRe.ar === null ? (
                `Falta vão à ré no ${descreverTrecho(trechoRe)}: a tração usa o vão do próprio poste.`
              ) : (
                <>
                  Vão regulador do {descreverTrecho(trechoRe)}:{" "}
                  <span className="font-semibold text-foreground tabular-nums">{fmt(trechoRe.ar, 1)} m</span>.
                </>
              )}
              {!ehAncoragem({ estrutura, ancorado: podeAncorar && ancorado }) &&
                " O trecho segue nos próximos postes, e o vão regulador muda com eles."}
            </p>
          )}
        </section>
      )}

      {estrutura === "cruzamento" && <PainelCruzamento />}

      {estrutura && estrutura !== "transformador" && estrutura !== "cruzamento" && estrutura !== "amarracao" && (
        <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">{ehDerivacao ? "Poste existente e nova rede" : "Poste e vão"}</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>{ehDerivacao ? "Poste existente (de onde a nova rede deriva)" : "Poste (catálogo)"}</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">Tipo</Label>
                  <SelectSimples
                    value={tipoFisicoAtual}
                    onChange={mudarTipoFisico}
                    opcoes={tiposFisicos.map((t) => ({ label: t, valor: t }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">Altura</Label>
                  <SelectSimples
                    value={compAtual}
                    onChange={mudarComprimento}
                    opcoes={comprimentos.map((c) => ({ label: `${c} m`, valor: c }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">Esforço nominal</Label>
                  <SelectSimples
                    value={resistAtual}
                    onChange={mudarResistencia}
                    opcoes={resistencias.map((r) => ({ label: `${r} daN`, valor: r }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v2-vao">{ehDerivacao ? "Vão da nova rede (1º vão)" : "Vão médio (a)"}</Label>
              <ComUnidade unidade="m">
                <Input
                  id="v2-vao"
                  inputMode="decimal"
                  placeholder="ex.: 100"
                  value={vao}
                  onChange={(e) => mudarVao(e.target.value)}
                  className="pr-10"
                />
              </ComUnidade>
            </div>

            {!ehDerivacao && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v2-alfa">Ângulo de deflexão (α)</Label>
              <ComUnidade unidade="°">
                <Input
                  id="v2-alfa"
                  inputMode="decimal"
                  value={alfa}
                  onChange={(e) => mudarAlfa(e.target.value)}
                  className="pr-10"
                />
              </ComUnidade>
              <span className="text-xs text-muted-foreground">0° = alinhamento reto</span>
              {paraNumero(alfa) > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  Curva para
                  <div role="group" aria-label="Lado da curva" className="inline-flex rounded-md border">
                    {(["esquerda", "direita"] as SentidoDeflexao[]).map((sd) => (
                      <button
                        key={sd}
                        type="button"
                        aria-pressed={sentido === sd}
                        onClick={() => setSentido(sd)}
                        className={`px-2.5 py-1 text-xs capitalize outline-none first:rounded-l-md last:rounded-r-md focus-visible:ring-2 focus-visible:ring-ring/50 ${
                          sentido === sd ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted"
                        }`}
                      >
                        {sd}
                      </button>
                    ))}
                  </div>
                  <span>(só na planta)</span>
                </div>
              )}
            </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label>{ehDerivacao ? "Número de fases da nova rede" : "Número de fases"}</Label>
              <SelectSimples
                value={nFases}
                onChange={mudarNFases}
                opcoes={[
                  { label: "1 (monofásico)", valor: "1" },
                  { label: "2 (bifásico)", valor: "2" },
                  { label: "3 (trifásico)", valor: "3" },
                ]}
              />
            </div>
          </div>

          {modoAtual && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                <Cable className="size-4 text-primary" /> Tração de projeto dos condutores
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {estrutura === "derivacao"
                  ? "Derivação: a tração da nova rede (cabo do projeto) sai sem contrapeso na direção da derivação e é somada, como vetor, à tração da rede existente e ao vento na direção mais desfavorável. O vento nos cabos novos entra sobre metade do vão."
                  : modoAtual === "fim"
                  ? "A linha começa ou termina neste poste: a tração dos cabos fica sem contrapeso. Verificam-se o vento perpendicular à tração, √(T² + vento²), e o vento no sentido da tração, T + vento no poste — vale o maior (GED-3648, item 6.3.2). O vento nos cabos entra sobre metade do vão."
                  : `Na deflexão, as trações dos dois vãos geram uma resultante na bissetriz, na mesma direção do vento — R = T · 2·sen(α/2), somada ao vento.`}
              </p>
              {temTabela(condutor.tipoCabo, condutor.awg) ? (
                <p className="mt-2 text-sm">
                  Tabela de tração de montagem a {fmt(tempC, 0)} °C no{" "}
                  {trechoRe?.ar != null ? `vão regulador do trecho (${fmt(trechoRe.ar, 1)} m)` : "vão do poste"}
                  {previaTabela ? (
                    <>
                      :{" "}
                      <span className="font-semibold tabular-nums">{fmt(previaTabela.Tprojeto, 0)} daN por condutor</span>
                      <span className="block text-xs text-muted-foreground">
                        {previaTabela.tabelado
                          ? "Valor da tabela (interpolado no vão e na temperatura), sem vento"
                          : `Flecha constante a partir do ${previaTabela.tipo} ${previaTabela.awgBase} (${fmt(previaTabela.Tbase, 0)} daN), sem vento`}
                        ; flecha {fmt(previaTabela.flecha, 2)} m.
                        {" "}Com {nFases} {nFases === "1" ? "fase" : "fases"}: T = {fmt(previaTabela.Tprojeto * Number(nFases), 0)} daN.
                      </span>
                      {previaTabela.foraDaFaixa && (
                        <span className="mt-1 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                          Vão fora da tabela (20 a 200 m): usada a coluna da borda.
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground"> — informe o vão para ver a tração.</span>
                  )}
                </p>
              ) : tracaoTab !== null ? (
                <p className="mt-2 text-sm">
                  {condutor.tipoCabo} {condutor.awg}:{" "}
                  <span className="font-semibold tabular-nums">{fmt(tracaoTab, 0)} daN por condutor</span>
                  <span className="text-xs text-muted-foreground">
                    {" "}— {tracaoInterp
                      ? `NDU 007, Tabela 26: interpolado pelo peso entre ${tracaoInterp.abaixo} e ${tracaoInterp.acima}`
                      : "NDU 007, Tabela 26 (tração de projeto normal)"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Com {nFases} {nFases === "1" ? "fase" : "fases"}: T = {fmt(tracaoTab * Number(nFases), 0)} daN
                  </span>
                </p>
              ) : (
                <div className="mt-3 flex flex-col gap-1.5 sm:max-w-xs">
                  <Label htmlFor="v2-tracao">Tração por condutor ({condutor.tipoCabo} {condutor.awg})</Label>
                  <ComUnidade unidade="daN">
                    <Input
                      id="v2-tracao"
                      inputMode="decimal"
                      placeholder="ex.: 900"
                      value={tracaoInf}
                      onChange={(e) => mudarTracaoInf(e.target.value)}
                      className="pr-12"
                    />
                  </ComUnidade>
                  <span className="text-xs text-muted-foreground">
                    Este cabo não está na tabela de trações de projeto. O valor vale para os próximos postes.
                  </span>
                </div>
              )}
              {pedeTracaoExtra && (
                <div className="mt-3 flex flex-col gap-1.5 sm:max-w-xs">
                  <Label htmlFor="v2-tracao-extra">Tração por condutor do circuito extra ({extraCabo} {extraAwg})</Label>
                  <ComUnidade unidade="daN">
                    <Input
                      id="v2-tracao-extra"
                      inputMode="decimal"
                      placeholder="ex.: 900"
                      value={tracaoExtraInf}
                      onChange={(e) => mudarTracaoExtraInf(e.target.value)}
                      className="pr-12"
                    />
                  </ComUnidade>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Poste de amarração — esforço tabelado pelo cabo; altura herdada da linha. */}
      {ehAmarracao && (
        <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Anchor className="size-4 text-primary" /> Poste de amarração
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Poste âncora que estabiliza a rede e alivia os esforços mecânicos. O esforço é tabelado
            pela bitola do cabo do projeto; a altura acompanha os postes da linha.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Poste (altura herdada da linha)</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">Tipo</Label>
                  <SelectSimples
                    value={tipoFisicoAtual}
                    onChange={mudarTipoFisico}
                    opcoes={tiposFisicos.map((t) => ({ label: t, valor: t }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-normal text-muted-foreground">Altura</Label>
                  <SelectSimples
                    value={compAtual}
                    onChange={mudarComprimento}
                    opcoes={comprimentos.map((c) => ({ label: `${c} m`, valor: c }))}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="v2-vao-amarr">Vão médio (a)</Label>
              <ComUnidade unidade="m">
                <Input
                  id="v2-vao-amarr"
                  inputMode="decimal"
                  placeholder="ex.: 100"
                  value={vao}
                  onChange={(e) => mudarVao(e.target.value)}
                  className="pr-10"
                />
              </ComUnidade>
              <span className="text-xs text-muted-foreground">Vão até o próximo poste (reinicia o contador de amarração).</span>
            </div>
          </div>

          {/* Esforço tabelado pelo cabo do projeto (600 / 1000 daN). */}
          {especAmarrPreview && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
              <div className="text-xs font-semibold tracking-wide text-primary uppercase">
                Poste especificado — esforço tabelado
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                <span className="text-2xl font-semibold tabular-nums">
                  {fmt(Number(compAtual) || 0, 0)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">m</span>
                </span>
                <span className="text-2xl font-semibold tabular-nums">
                  {fmt(especAmarrPreview.esforcoDaN, 0)}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">daN</span>
                </span>
                <span className="text-sm text-muted-foreground capitalize">poste {tipoFisicoAtual}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{especAmarrPreview.criterio}</p>
            </div>
          )}
        </section>
      )}

      {estrutura && (estrutura === "derivacao" || estrutura === "transformador" || estrutura === "circuito_duplo") && (
        <section className="rounded-xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="text-sm font-semibold">Especificações da estrutura</h2>

          {estrutura === "derivacao" && (
            <div className="mt-3 flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Rede que já passa no poste existente. O cabo da nova rede é o da abertura (
                {condutor.tipoCabo} {condutor.awg}).
              </p>

              <div className="flex flex-col gap-1.5">
                <Label>Cabos da rede existente</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <SelectSimples
                    value={exCabo}
                    onChange={mudarExCabo}
                    placeholder="Tipo de cabo"
                    opcoes={CABOS.map((tc) => ({ label: `${tc} — ${CONDUTORES[tc].nome}`, valor: tc }))}
                  />
                  <SelectSimples
                    value={exAwg}
                    onChange={mudarExAwg}
                    placeholder={exCabo ? "Bitola" : "Escolha o cabo primeiro"}
                    opcoes={bitolasEx.map((b) => ({ label: `${b.awg} (d = ${fmt(b.diamMm, 2)} mm)`, valor: b.awg }))}
                  />
                  <SelectSimples
                    value={exFases}
                    onChange={mudarExFases}
                    opcoes={[
                      { label: "1 fase", valor: "1" },
                      { label: "2 fases", valor: "2" },
                      { label: "3 fases", valor: "3" },
                    ]}
                  />
                </div>
              </div>

              {exCabo && exAwg && !exTracaoDisponivel && (
                <div className="flex flex-col gap-1.5 sm:max-w-xs">
                  <Label htmlFor="v2-ex-tracao">Tração por condutor da rede existente</Label>
                  <ComUnidade unidade="daN">
                    <Input
                      id="v2-ex-tracao"
                      inputMode="decimal"
                      placeholder="ex.: 400"
                      value={exTracaoInf}
                      onChange={(e) => mudarExTracaoInf(e.target.value)}
                      className="pr-12"
                    />
                  </ComUnidade>
                  <span className="text-xs text-muted-foreground">
                    O cabo {exCabo} {exAwg} ainda não tem tabela de tração.
                  </span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <Label>Situação da rede existente neste poste</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {SITUACOES_REDE_EXISTENTE.map((op) => {
                    const ativo = exSituacao === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => mudarExSituacao(op.id)}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          ativo
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{op.label}</span>
                        <span className={`text-xs ${ativo ? "text-accent-foreground/75" : "text-muted-foreground"}`}>
                          {op.descricao}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {exSituacao === "angulo" && (
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="v2-ex-alfa">Ângulo da rede existente (α)</Label>
                    <ComUnidade unidade="°">
                      <Input
                        id="v2-ex-alfa"
                        inputMode="decimal"
                        value={exAlfa}
                        onChange={(e) => mudarExAlfa(e.target.value)}
                        className="pr-10"
                      />
                    </ComUnidade>
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v2-ex-vao">Vão médio da rede existente</Label>
                  <ComUnidade unidade="m">
                    <Input
                      id="v2-ex-vao"
                      inputMode="decimal"
                      placeholder="ex.: 40"
                      value={exVao}
                      onChange={(e) => mudarExVao(e.target.value)}
                      className="pr-10"
                    />
                  </ComUnidade>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v2-ex-theta">Ângulo da derivação (θ)</Label>
                  <ComUnidade unidade="°">
                    <Input
                      id="v2-ex-theta"
                      inputMode="decimal"
                      value={exTheta}
                      onChange={(e) => mudarExTheta(e.target.value)}
                      className="pr-10"
                    />
                  </ComUnidade>
                  <span className="text-xs text-muted-foreground">
                    {exSituacao === "fim_linha"
                      ? "Entre a nova rede e o vão existente (180° = prolonga a rede)."
                      : "Entre a nova rede e a rede existente (90° = perpendicular)."}
                  </span>
                </div>
              </div>

              {tipoFisicoAtual !== "circular" ? (
                <div className="flex flex-col gap-1.5">
                  <Label>Lado de esforço usado para derivar</Label>
                  <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                    {[
                      { v: "maior" as const, r: "Lado de maior esforço", d: "Face lisa — vale Rn" },
                      { v: "menor" as const, r: "Lado de menor esforço", d: "Cavas — vale Rn ÷ 2" },
                    ].map((op) => {
                      const ativo = exLado === op.v;
                      return (
                        <button
                          key={op.v}
                          type="button"
                          aria-pressed={ativo}
                          onClick={() => mudarExLado(op.v)}
                          className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          ativo
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                        >
                          <span className="font-medium">{op.r}</span>
                          <span className={`text-xs ${ativo ? "text-accent-foreground/75" : "text-muted-foreground"}`}>
                            {op.d}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Poste circular: resiste igual em qualquer direção (Rn).
                </p>
              )}
            </div>
          )}

          {estrutura === "transformador" && (
            <div className="mt-3 flex flex-col gap-3">
              {/* 0) Poste de PRFV? Liga o protocolo próprio (altura + esforço). */}
              <div className="flex flex-col gap-1.5">
                <Label>Poste de PRFV?</Label>
                <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                  {[
                    { v: false, r: "Não", d: "Protocolo padrão de dimensionamento" },
                    { v: true, r: "Sim", d: "Altura e esforço pelo protocolo PRFV" },
                  ].map((op) => {
                    const ativo = prfv === op.v;
                    return (
                      <button
                        key={op.r}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => mudarPrfv(op.v)}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          ativo
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{op.r}</span>
                        <span className={`text-xs ${ativo ? "text-accent-foreground/75" : "text-muted-foreground"}`}>
                          {op.d}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {prfv && (
                  <span className="text-xs text-muted-foreground">
                    PRFV: informe apenas o tipo e a potência — a altura e o esforço do poste vêm do
                    protocolo (trifásico só até {rotuloKVA(LIMITE_KVA_TRIFASICO_PRFV)}).
                  </span>
                )}
              </div>

              {/* 1) Tipo do transformador (fase) */}
              <div className="flex flex-col gap-1.5">
                <Label>Tipo do transformador</Label>
                <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                  {FASES_TRAFO.map((f) => {
                    const ativo = trafoFase === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => mudarTrafoFase(f.id)}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          ativo
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{f.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2) Classe de tensão (oculta em PRFV) e 3) potência (kVA) */}
              <div className={`grid grid-cols-1 gap-2 ${prfv ? "" : "sm:grid-cols-2"}`}>
                {!prfv && (
                  <div className="flex flex-col gap-1.5">
                    <Label>Classe de tensão</Label>
                    <SelectSimples
                      value={trafoClasse}
                      onChange={mudarTrafoClasse}
                      placeholder="Classe de tensão"
                      opcoes={CLASSES_TENSAO_TRAFO.map((c) => ({ label: c.label, valor: c.id }))}
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Label>Potência nominal</Label>
                  <SelectSimples
                    value={trafoKVA}
                    onChange={mudarTrafoKVA}
                    placeholder={prfv || trafoClasse ? "Potência (kVA)" : "Escolha a classe primeiro"}
                    opcoes={potenciasDisponiveis.map((t) => ({ label: rotuloKVA(t.kVA), valor: String(t.kVA) }))}
                  />
                </div>
              </div>

              {!prfv && trafoClasse && potenciasDisponiveis.length === 0 && (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  Nenhuma potência cadastrada para esta combinação de tipo e classe.
                </span>
              )}

              {/* 4) Tipo físico do poste (não altera comprimento nem esforço) */}
              <div className="flex flex-col gap-1.5">
                <Label>Tipo do poste</Label>
                <div className="grid grid-cols-2 gap-2 sm:max-w-md">
                  {Object.keys(catalogoPostes).map((t) => {
                    const ativo = tipoFisico === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={ativo}
                        onClick={() => mudarTipoFisico(t)}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left text-sm capitalize transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                          ativo
                            ? "border-primary bg-accent text-accent-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                      >
                        <span className="font-medium">{t}</span>
                      </button>
                    );
                  })}
                </div>
                <span className="text-xs text-muted-foreground">
                  Circular ou duplo T — o comprimento e o esforço do poste não mudam com essa escolha.
                </span>
              </div>

              {/* 5) Poste especificado a partir da fase + potência */}
              {especTrafoPreview && (
                <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-4">
                  <div className="text-xs font-semibold tracking-wide text-primary uppercase">
                    Poste especificado
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                    <span className="text-2xl font-semibold tabular-nums">
                      {fmt(especTrafoPreview.comprimentoM, 0)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">m</span>
                    </span>
                    <span className="text-2xl font-semibold tabular-nums">
                      {fmt(especTrafoPreview.esforcoDaN, 0)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">daN</span>
                    </span>
                    <span className="text-sm text-muted-foreground capitalize">
                      poste {tipoFisico}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">{especTrafoPreview.criterio}</p>
                </div>
              )}
            </div>
          )}

          {estrutura === "circuito_duplo" && (
            <div className="mt-3 flex flex-col gap-1.5">
              <Label>Condutor do circuito extra</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <SelectSimples
                  value={extraCabo}
                  onChange={mudarExtraCabo}
                  placeholder="Tipo de cabo"
                  opcoes={CABOS.map((tc) => ({ label: `${tc} — ${CONDUTORES[tc].nome}`, valor: tc }))}
                />
                <SelectSimples
                  value={extraAwg}
                  onChange={mudarExtraAwg}
                  placeholder={extraCabo ? "Bitola" : "Escolha o cabo primeiro"}
                  opcoes={bitolasExtra.map((b) => ({ label: `${b.awg} (d = ${fmt(b.diamMm, 2)} mm)`, valor: b.awg }))}
                />
                <SelectSimples
                  value={extraFases}
                  onChange={mudarExtraFases}
                  opcoes={[
                    { label: "1 fase", valor: "1" },
                    { label: "2 fases", valor: "2" },
                    { label: "3 fases", valor: "3" },
                  ]}
                />
              </div>
              <span className="text-xs text-muted-foreground">Mesmo vão e ângulo do circuito principal.</span>
            </div>
          )}

          {pedeCruzeta && (
            <div className="mt-4 flex flex-col gap-1.5">
              <Label>Cruzeta</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <SelectSimples
                  value={cruzMaterial}
                  onChange={mudarCruzMaterial}
                  placeholder="Material"
                  opcoes={MATERIAIS_CRUZETA.map((mat) => ({ label: CRUZETAS_DIM[mat].nome, valor: mat }))}
                />
                <SelectSimples
                  value={cruzModelo}
                  onChange={mudarCruzModelo}
                  placeholder={cruzMaterial ? "Modelo" : "Escolha o material primeiro"}
                  opcoes={modelosCruzeta.map((mo, i) => ({ label: `${mo.formato} · ${mo.Lmm} mm`, valor: String(i) }))}
                />
              </div>
              {(() => {
                const mo = CRUZETAS_DIM[cruzMaterial]?.modelos[Number(cruzModelo)];
                if (!mo) return null;
                const area = (mo.Lmm / 1000) * (mo.cmm / 1000);
                return (
                  <span className="text-xs text-muted-foreground">
                    Face ao vento {mo.Lmm}×{mo.cmm} mm · área {fmt(area, 3)} m² · esforço = Pvp · área
                  </span>
                );
              })()}
            </div>
          )}
        </section>
      )}

      {estrutura && estrutura !== "cruzamento" && (
        <div>
          <Button onClick={calcular}>
            <Calculator className="size-4" /> Calcular esforço
          </Button>
        </div>
      )}

      {erro && (
        <div className="rounded-lg border-l-4 border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}

      {m && calc && (
        <section
          className={`rounded-xl border-l-4 bg-card p-5 ring-1 ring-foreground/10 ${
            m.aprovado ? "border-green-600 dark:border-green-500" : "border-destructive"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              {especTrafo != null
                ? `Poste especificado ${String(n).padStart(2, "0")} — transformador`
                : especAmarr != null
                  ? `Poste especificado ${String(n).padStart(2, "0")} — amarração`
                  : `Esforço do poste ${String(n).padStart(2, "0")}`}
            </h2>
            {especTrafo != null ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                <CircleCheck className="size-3.5" /> Poste especificado por fase e potência
              </span>
            ) : especAmarr != null ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                <Anchor className="size-3.5" /> Amarração — esforço tabelado pelo cabo
              </span>
            ) : m.aprovado ? (
              <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-400">
                <CircleCheck className="size-3.5" />
                {m.estaiado ? "Dentro do limite com estai" : "Dentro do limite do projetista"} (≤{" "}
                {fmt(m.limiarPct, 0)}%)
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                <TriangleAlert className="size-3.5" /> Acima do limite do projetista ({fmt(m.limiarPct, 0)}%)
              </span>
            )}
          </div>

          {calc.entrada.derivacaoExistente && m.baseOrigemDerivacao != null && (
            <div
              className={`mt-3 flex items-start gap-2 rounded-lg border-l-4 p-3 text-xs ${
                m.atendeOrigemDerivacao
                  ? "border-primary bg-primary/[0.06]"
                  : "border-destructive bg-destructive/10"
              }`}
            >
              {m.atendeOrigemDerivacao ? (
                <Split className="mt-0.5 size-4 shrink-0 text-primary" />
              ) : (
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              )}
              <span className={m.atendeOrigemDerivacao ? "text-muted-foreground" : "text-destructive"}>
                <span className="font-semibold text-foreground">Origem da linha:</span> deriva do lado
                de {m.ladoOrigemDerivacao} esforço de um poste de{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {fmt(calc.entrada.esforcoOrigemDerivacao ?? 0, 0)} daN
                </span>{" "}
                → base da rede{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {fmt(m.baseOrigemDerivacao, 0)} daN
                </span>
                .{" "}
                {m.atendeOrigemDerivacao ? (
                  <>
                    O poste de derivação ({fmt(calc.entrada.resistencia, 0)} daN) atende à base —
                    esforço ≥ {fmt(m.baseOrigemDerivacao, 0)} daN.
                  </>
                ) : (
                  <>
                    <strong>
                      O poste de derivação ({fmt(calc.entrada.resistencia, 0)} daN) é inferior à base
                      ({fmt(m.baseOrigemDerivacao, 0)} daN).
                    </strong>{" "}
                    Suba o esforço do poste de derivação para pelo menos {fmt(m.baseOrigemDerivacao, 0)} daN.
                  </>
                )}
              </span>
            </div>
          )}

          {especTrafo != null && (
            <>
              <ul className="mt-2 flex flex-col divide-y divide-dashed divide-border">
                <Linha
                  rotulo="Transformador"
                  valor={`${calc.entrada.transformador?.fase === "monofasico" ? "Monofásico" : "Trifásico"} · ${rotuloKVA(calc.entrada.transformador?.kVA ?? 0)}`}
                />
                <Linha rotulo="Tipo do poste" valor={calc.entrada.tipoFisico} />
                <Linha rotulo="Comprimento do poste" valor={fmt(especTrafo.comprimentoM, 0)} unidade="m" destaque />
                <Linha rotulo="Esforço mecânico (Rn)" valor={fmt(especTrafo.esforcoDaN, 0)} unidade="daN" destaque />
              </ul>

              <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] p-4 text-xs text-muted-foreground">
                {especTrafo.criterio} Poste especificado direto pela fase e potência do transformador —
                sem verificação de vento nem de momentos nesta versão.
              </div>
            </>
          )}

          {especAmarr != null && (
            <>
              <ul className="mt-2 flex flex-col divide-y divide-dashed divide-border">
                <Linha rotulo="Cabo do projeto" valor={especAmarr.cabo} />
                <Linha rotulo="Tipo do poste" valor={calc.entrada.tipoFisico} />
                <Linha rotulo="Comprimento do poste" valor={fmt(especAmarr.comprimentoM, 0)} unidade="m" destaque />
                <Linha rotulo="Esforço mecânico (Rn) — tabelado" valor={fmt(especAmarr.esforcoDaN, 0)} unidade="daN" destaque />
                <Linha rotulo="Vão até o próximo poste" valor={fmt(calc.entrada.vao, 0)} unidade="m" />
              </ul>

              <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] p-4 text-xs text-muted-foreground">
                {especAmarr.criterio} Poste âncora — estabiliza a rede e alivia os esforços mecânicos.
                O esforço é tabelado pela bitola do cabo, sem verificação de vento. O contador de
                amarração reinicia a partir deste poste.
              </div>
            </>
          )}

          {especTrafo == null && especAmarr == null && (
            <>

          <ul className="mt-2 flex flex-col divide-y divide-dashed divide-border">
            {m.posteInformado ? (
              <Linha rotulo="Esforço do poste (informado — já implantado)" valor={fmt(m.esforcoPoste, 2)} unidade="daN" />
            ) : (
              <>
                <Linha rotulo="Pressão do vento (Pvp = c · v²)" valor={fmt(m.Pvp, 3)} unidade="daN/m²" />
                <Linha rotulo={`Área do poste (Sp) — dt ${fmt(m.dt, 0)} / ds ${fmt(m.ds, 0)} mm`} valor={fmt(m.Sp, 3)} unidade="m²" />
                <Linha rotulo="Vento no poste (Fp = Pvp · Sp)" valor={fmt(m.Fp, 2)} unidade="daN" />
                <Linha
                  rotulo={`Fp transferido a 10 cm do topo (H = ${fmt(m.H, 2)} m; h = ${fmt(m.hTopo, 2)} m)`}
                  valor={fmt(m.FpTopo, 2)}
                  unidade="daN"
                />
                <Linha rotulo={`Coeficiente do cabo (Cc) — d = ${fmt(m.d, 2)} mm`} valor={fmt(m.Cc, 3)} unidade="daN/m" />
                <Linha
                  rotulo={
                    calc.entrada.estrutura === "derivacao" || calc.entrada.estrutura === "fim_linha"
                      ? "Vento por condutor (Fv = Cc · a/2 · cos(α/2)) — só um vão chega ao poste"
                      : "Vento por condutor (Fv = Cc · a · cos(α/2))"
                  }
                  valor={fmt(m.Fv, 2)}
                  unidade="daN"
                />
                <Linha rotulo={`Vento nos condutores (${calc.entrada.nFases} fases)`} valor={fmt(m.Fc, 2)} unidade="daN" />
                {temExtras && (
                  <Linha rotulo="Esforço do poste (Fc + Fp,topo)" valor={fmt(m.esforcoPoste, 2)} unidade="daN" />
                )}
              </>
            )}
            {m.Fcruzeta !== null && (
              <Linha
                rotulo={`Vento na cruzeta (Pvp · área; área = ${fmt(m.cruzetaArea ?? 0, 3)} m²)`}
                valor={fmt(m.Fcruzeta, 2)}
                unidade="daN"
              />
            )}
            {m.Fextra !== null && (
              <Linha
                rotulo={`Vento no circuito extra (${calc.entrada.circuitoExtra?.nFases ?? ""} fases; d = ${fmt(m.dExtra ?? 0, 2)} mm)`}
                valor={fmt(m.Fextra, 2)}
                unidade="daN"
              />
            )}
            {m.derivacao && (
              <>
                <Linha
                  rotulo={`Vento nos cabos existentes (${m.derivacao.rede.tipoCabo} ${m.derivacao.rede.awg}, ${m.derivacao.rede.nFases} fases; d = ${fmt(m.derivacao.dExistente, 2)} mm)`}
                  valor={fmt(m.derivacao.FcExistente, 2)}
                  unidade="daN"
                />
                <Linha
                  rotulo={`Tração da rede existente — ${m.derivacao.rede.nFases} × ${fmt(m.derivacao.TcondExistente, 2)} daN (${
                    m.derivacao.fonteExistente === "tabelada" ? `tabela de montagem, vão de ${fmt(m.derivacao.rede.vao, 0)} m` : m.derivacao.fonteExistente === "tabela" ? "NDU 007 Tab. 26" : "informada"
                  })`}
                  valor={fmt(m.derivacao.Texistente, 2)}
                  unidade="daN"
                />
                <Linha
                  rotulo={
                    m.derivacao.rede.situacao === "passagem"
                      ? "Tração existente que fica no poste (passagem: se anula)"
                      : m.derivacao.rede.situacao === "angulo"
                        ? `Tração existente que fica no poste (T · 2·sen(α/2); α = ${fmt(m.derivacao.rede.alfa, 0)}°)`
                        : "Tração existente que fica no poste (fim de linha: T inteira)"
                  }
                  valor={fmt(m.derivacao.Rexistente, 2)}
                  unidade="daN"
                />
                <Linha
                  rotulo={`Tração da nova rede — ${calc.entrada.nFases} × ${fmt(m.derivacao.TcondNova, 2)} daN (${
                    m.derivacao.tabeladaNova
                      ? `tabela de montagem, vão de ${fmt(m.derivacao.tabeladaNova.vao, 1)} m a ${fmt(m.derivacao.tabeladaNova.tempC, 0)} °C`
                      : m.derivacao.fonteNova === "tabela" ? "NDU 007 Tab. 26" : "informada"
                  })`}
                  valor={fmt(m.derivacao.Tnova, 2)}
                  unidade="daN"
                />
                <Linha
                  rotulo={`Resultante das trações (soma vetorial; θ = ${fmt(m.derivacao.rede.anguloDerivacao, 0)}°)`}
                  valor={fmt(m.derivacao.Rtracao, 2)}
                  unidade="daN"
                />
              </>
            )}
            {m.tracao && (
              <>
                <Linha rotulo="Vento total no topo" valor={fmt(m.Fvento, 2)} unidade="daN" />
                <Linha
                  rotulo={`Tração de projeto — ${calc.entrada.nFases} ${calc.entrada.nFases === 1 ? "condutor" : "condutores"} (T; ${m.tracao.fonte === "tabelada" ? "tabela de montagem" : m.tracao.fonte === "tabela" ? "NDU 007 Tab. 26" : "informada"})`}
                  valor={fmt(m.tracao.T, 2)}
                  unidade="daN"
                />
                {tabMemoria && (
                  <>
                    {trechosMemoria.map((t) => (
                      <Linha
                        key={t.de}
                        rotulo={`Vão regulador do ${descreverTrecho(t)}${
                          t.ar === null
                            ? " — falta vão à ré"
                            : trechosMemoria.length > 1 && t.ar === vaoTracao
                              ? " ← governa"
                              : ""
                        }`}
                        valor={t.ar === null ? "—" : fmt(t.ar, 1)}
                        unidade="m"
                      />
                    ))}
                    {!tabMemoria.tabelado && (
                      <Linha
                        rotulo={`Tração do ${tabMemoria.tipo} ${tabMemoria.awgBase ?? "336.4"} na tabela, vão de ${fmt(tabMemoria.vao, 1)} m a ${fmt(tabMemoria.tempC, 0)} °C (base da flecha constante)`}
                        valor={fmt(tabMemoria.Tbase, 2)}
                        unidade="daN"
                      />
                    )}
                    <Linha
                      rotulo={`Tração por condutor ${tabMemoria.tipo} ${tabMemoria.awg}, vão de ${fmt(tabMemoria.vao, 1)} m a ${fmt(tabMemoria.tempC, 0)} °C, sem vento (${tabMemoria.tabelado ? "tabela de montagem" : "flecha constante"}${tabMemoria.foraDaFaixa ? "; fora da tabela: borda" : ""})`}
                      valor={fmt(tabMemoria.Tprojeto, 2)}
                      unidade="daN"
                    />
                    <Linha rotulo={`Flecha no vão de ${fmt(tabMemoria.vao, 1)} m`} valor={fmt(tabMemoria.flecha, 3)} unidade="m" />
                  </>
                )}
                {m.tracao.modo === "deflexao" && !m.tracao.somaDireta && (
                  <Linha
                    rotulo={`Resultante da tração na deflexão (T · 2·sen(α/2); α = ${fmt(calc.entrada.alfa, 0)}°)`}
                    valor={fmt(m.tracao.R, 2)}
                    unidade="daN"
                  />
                )}
                {m.tracao.Rextra !== null && (
                  <Linha rotulo="Resultante da tração do circuito extra" valor={fmt(m.tracao.Rextra, 2)} unidade="daN" />
                )}
                {m.tracao.modo === "fim" && m.tracao.situacao1 !== null && m.tracao.situacao2 !== null && (
                  <>
                    <Linha
                      rotulo={`Situação 1 — vento perpendicular à tração: √(T² + vento²)${m.tracao.governa === 1 ? " ← governa" : ""}`}
                      valor={fmt(m.tracao.situacao1, 2)}
                      unidade="daN"
                    />
                    <Linha
                      rotulo={`Situação 2 — vento no sentido da tração: T + vento no poste${m.tracao.governa === 2 ? " ← governa" : ""}`}
                      valor={fmt(m.tracao.situacao2, 2)}
                      unidade="daN"
                    />
                  </>
                )}
              </>
            )}
            <Linha
              rotulo={
                m.derivacao
                  ? `Esforço resultante no topo (trações + vento na direção mais desfavorável, φ = ${fmt(m.derivacao.phiCritico, 0)}°)`
                  : m.tracao
                  ? m.tracao.modo === "deflexao" || m.tracao.somaDireta
                    ? "Esforço total no topo (F = vento + tração)"
                    : "Esforço total no topo (maior das duas situações)"
                  : temExtras || m.posteInformado
                    ? "Esforço total no topo (F = soma)"
                    : "Esforço total no topo (F = Fc + Fp,topo)"
              }
              valor={fmt(m.Ftotal, 2)}
              unidade="daN"
              destaque={!m.estaiado}
            />
            {m.estaiado && m.Fe !== null && m.Fr !== null && (
              <>
                <Linha
                  rotulo={`Força absorvida pelo estai (Fe = F · h/he; he = ${fmt(m.estaiHe ?? 0, 2)} m)`}
                  valor={fmt(m.Fe, 2)}
                  unidade="daN"
                />
                <Linha
                  rotulo="Reação residual na base (Fr = F − Fe)"
                  valor={fmt(Math.abs(m.Fr), 2)}
                  unidade="daN"
                  destaque
                />
              </>
            )}
          </ul>

          {(() => {
            const cap = m.derivacao?.capacidade ?? calc.entrada.resistencia;
            const rotCap = !m.derivacao || m.derivacao.circular ? "Rn" : m.derivacao.rede.lado === "maior" ? "Rn (lado maior)" : "Rn/2 (lado menor)";
            const pct = m.utilizacaoEfetiva * 100;
            const folga = cap - m.esforcoEfetivo;
            return (
              <div className="mt-3 flex flex-col items-center gap-4 rounded-lg bg-muted/50 p-4 sm:flex-row sm:items-center sm:gap-6">
                <MedidorUtilizacao
                  utilizacaoPct={pct}
                  limiarPct={m.limiarPct}
                  aprovado={m.aprovado}
                  rotulo={m.estaiado ? "utilização com estai" : "utilização"}
                />
                <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-3 text-xs sm:grid-cols-1 sm:gap-y-2">
                  <div>
                    <dt className="text-muted-foreground">
                      {m.estaiado ? `Reação na base |Fr| / ${rotCap}` : `Esforço F / ${rotCap}`}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                      {fmt(m.esforcoEfetivo, 1)}
                      <span className="font-normal text-muted-foreground"> / {fmt(cap, 0)} daN</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{folga >= 0 ? "Folga até o Rn" : "Excesso sobre o Rn"}</dt>
                    <dd
                      className={`mt-0.5 text-sm font-semibold tabular-nums ${
                        folga >= 0 ? "text-green-700 dark:text-green-400" : "text-destructive"
                      }`}
                    >
                      {fmt(Math.abs(folga), 1)}
                      <span className="font-normal text-muted-foreground"> daN</span>
                    </dd>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <dt className="text-muted-foreground">Limite do projetista</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                      {fmt(m.limiarPct, 0)}%
                      <span className="font-normal text-muted-foreground"> da capacidade</span>
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })()}

          {/* Derivação: o poste existente suporta a nova rede? O que fazer se não. */}
          {m.derivacao && (
            <div
              className={`mt-3 rounded-lg border-l-4 bg-muted/40 p-4 ${
                m.aprovado ? "border-green-600" : "border-destructive"
              }`}
            >
              <div
                className={`flex items-center gap-1.5 text-sm font-semibold ${
                  m.aprovado ? "text-green-700 dark:text-green-400" : "text-destructive"
                }`}
              >
                {m.aprovado ? <CircleCheck className="size-4" /> : <TriangleAlert className="size-4" />}
                {m.aprovado
                  ? m.estaiado
                    ? "O poste existente suporta a derivação com o estai"
                    : "O poste existente suporta a derivação"
                  : "O poste existente NÃO suporta a derivação"}
              </div>
              {!m.aprovado && !m.estaiado && (
                <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-xs text-muted-foreground">
                  {m.derivacao.solucoes.girar && (
                    <li>
                      <strong className="text-foreground">Girar o poste:</strong> o lado de maior esforço (
                      {fmt(calc.entrada.resistencia, 0)} daN) atende — posicione a face lisa voltada para
                      a derivação.
                    </li>
                  )}
                  {m.derivacao.solucoes.estai && (
                    <li>
                      <strong className="text-foreground">Estai de contraposição</strong>, no sentido oposto à
                      derivação, fixado entre {fmt(m.derivacao.solucoes.estai.heMin, 2)} m e{" "}
                      {fmt(m.derivacao.solucoes.estai.heMax, 2)} m do solo — confira abaixo em “Calcular com
                      estai”.
                    </li>
                  )}
                  <li>
                    <strong className="text-foreground">Trocar o poste:</strong>{" "}
                    {m.derivacao.solucoes.posteSugerido
                      ? `${calc.entrada.tipoFisico} ${fmt(calc.entrada.comprimento, 0)} m / ${fmt(m.derivacao.solucoes.posteSugerido.resistencia, 0)} daN${
                          m.derivacao.circular ? "" : `, lado ${m.derivacao.solucoes.posteSugerido.lado} voltado para a derivação`
                        } — a menor classe do catálogo que atende.`
                      : `nenhum ${calc.entrada.tipoFisico} de ${fmt(calc.entrada.comprimento, 0)} m do catálogo atende ${fmt(m.derivacao.F, 0)} daN — use estai ou outra altura.`}
                  </li>
                </ol>
              )}
            </div>
          )}

          {/* Lado do poste: qual sentido posicionar (esforço direcional). */}
          {(() => {
            const o = orientacaoLado(m);
            if (!o) return null;
            const paleta = {
              verde: { borda: "border-green-600", texto: "text-green-700 dark:text-green-400" },
              ambar: { borda: "border-amber-500", texto: "text-amber-700 dark:text-amber-400" },
              vermelho: { borda: "border-destructive", texto: "text-destructive" },
            }[o.cor];
            return (
              <div className={`mt-3 rounded-lg border-l-4 ${paleta.borda} bg-muted/40 p-4`}>
                <div className={`flex items-center gap-1.5 text-sm font-semibold ${paleta.texto}`}>
                  <Compass className="size-4" /> {o.titulo}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    Lado de maior esforço:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {fmt(m.ladoMaior, 0)} daN
                    </span>
                  </span>
                  <span>
                    Lado de menor esforço:{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {fmt(m.ladoMenor, 0)} daN
                    </span>
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{o.descricao}</p>
                {m.ladoRequerido && (
                  <DemarcacaoLado
                    lado={m.ladoRequerido}
                    ladoMaior={m.ladoMaior}
                    ladoMenor={m.ladoMenor}
                  />
                )}
              </div>
            );
          })()}

          {(m.estaiado || !m.aprovado) && (
            <div className="mt-3 rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] p-4">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Anchor className="size-4 text-primary" />
                {m.estaiado ? "Poste estaiado" : "Esforço acima do limite — adicionar estai?"}
              </div>

              {m.estaiado ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.aprovado ? (
                    <>
                      Resolvido com estai a {fmt(m.estaiHe ?? 0, 2)} m: a reação na base caiu para{" "}
                      {fmt(m.esforcoEfetivo, 1)} daN ({fmt(m.utilizacaoEfetiva * 100, 1)}% ≤{" "}
                      {fmt(m.limiarPct, 0)}%).
                    </>
                  ) : (
                    <>
                      Estai a {fmt(m.estaiHe ?? 0, 2)} m ainda insuficiente (
                      {fmt(m.utilizacaoEfetiva * 100, 1)}% &gt; {fmt(m.limiarPct, 0)}%) — aproxime o
                      estai do topo (h = {fmt(m.hTopo, 2)} m) ou suba a classe do poste.
                    </>
                  )}
                </p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  O poste está em {fmt(m.utilizacaoEfetiva * 100, 1)}% (limite {fmt(m.limiarPct, 0)}%).
                  Adicione um estai para trazer o esforço ao limite, ou siga assim e revise depois.
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="v2-estai-he">Altura do estai (he)</Label>
                  <ComUnidade unidade="m">
                    <Input
                      id="v2-estai-he"
                      inputMode="decimal"
                      placeholder={`ex.: ${fmt(m.hTopo, 1)}`}
                      value={estaiHe}
                      onChange={(e) => setEstaiHe(e.target.value)}
                      className="w-40 pr-9"
                    />
                  </ComUnidade>
                </div>
                <Button variant="outline" onClick={aplicarEstai}>
                  <Anchor className="size-4" /> {m.estaiado ? "Recalcular estai" : "Calcular com estai"}
                </Button>
                {m.estaiado && (
                  <Button variant="ghost" onClick={removerEstai}>
                    <X className="size-4" /> Remover estai
                  </Button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Estai fixado a he metros do solo; quanto mais próximo do topo (h = {fmt(m.hTopo, 2)} m),
                mais esforço ele absorve (item 6.3.3).
              </p>
            </div>
          )}
            </>
          )}

          {editando ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <Button onClick={salvarEdicao}>
                <Save className="size-4" /> {s.edicaoDoMemorial ? "Salvar e voltar ao memorial" : "Salvar alterações"}
              </Button>
              <Button variant="outline" onClick={s.cancelarEdicao}>
                <Undo2 className="size-4" /> Cancelar edição
              </Button>
            </div>
          ) : (
          <div className="mt-5 flex flex-wrap gap-3">
            {podeMais && (
              <Button variant="outline" onClick={adicionarMais}>
                <Plus className="size-4" /> Adicionar mais um poste
              </Button>
            )}
            <Button onClick={concluir}>
              <Check className="size-4" /> Concluir projeto
            </Button>
          </div>
          )}
        </section>
      )}
    </div>
  );
}
