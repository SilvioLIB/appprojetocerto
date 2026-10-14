/**
 * Geometria da planta da rede (vista de topo). Puramente visual: lê o que o
 * dimensionamento já produziu (vão, α, esforço efetivo, Rn, tipo físico) e as
 * escolhas de planta do projetista (giro do poste e lado da curva) — nunca
 * altera o cálculo nem a aprovação.
 *
 * Convenções:
 *   - A resultante é TRANSVERSAL à linha, como o esforço calculado (vento nos
 *     condutores e no poste): na bissetriz nos postes de ângulo, apontando para
 *     dentro da curva; nos postes em reta, com duas pontas (o vento vem de
 *     qualquer lado).
 *   - Poste duplo T: a face lisa (mesa) vale Rn; a face com cavas vale Rn/2.
 *     Posição padrão = face lisa ao longo da linha (cavas recebem a resultante);
 *     "virado" = face lisa voltada para a resultante.
 *   - Poste circular: resistência igual em qualquer direção — não gira.
 */
import type { EntradaPoste, MemoriaCalculo } from "./dimensionamento";

export type SentidoDeflexao = "esquerda" | "direita";

/** Escolhas de planta do projetista para um poste (não entram no cálculo). */
export interface PlantaPoste {
  /** true = face lisa voltada para a resultante. */
  virado: boolean;
  /** Lado para o qual a linha dobra no poste (só importa com α > 0). */
  sentido: SentidoDeflexao;
}

export const PLANTA_PADRAO: PlantaPoste = { virado: false, sentido: "direita" };

type Vetor = [number, number];

/**
 * Estado do poste na planta:
 *   ok           → a face que recebe a resultante atende o esforço;
 *   alerta       → a resultante cai nas cavas e passa de Rn/2 (virar resolve);
 *   excede       → nem a face lisa atende (subir a classe / estai);
 *   especificado → transformador ou amarração: sem esforço a orientar.
 */
export type EstadoPlanta = "ok" | "alerta" | "excede" | "especificado";

export interface NoPlanta {
  indice: number;
  /** Posição em metros (x para leste, y para norte), origem no poste 01. */
  pos: Vetor;
  /** Unitário da linha no poste (bissetriz entre o vão que chega e o que sai). */
  eixo: Vetor;
  /** Unitário transversal: para dentro da curva (ou à esquerda, em reta). */
  normal: Vetor;
  circular: boolean;
  /** Unitário perpendicular à face lisa (eixo forte). Circular: = eixo. */
  forte: Vetor;
  /** Resultante transversal; null quando não há esforço a orientar. */
  resultante: { dir: Vetor; duasPontas: boolean; esforco: number } | null;
  /** Face que recebe a resultante (null: sem resultante ou poste circular). */
  face: "lisa" | "cava" | null;
  /** Capacidade na direção da resultante (daN). */
  capacidade: number;
  estado: EstadoPlanta;
  /** Pode girar: duplo T com resultante. */
  podeVirar: boolean;
  estaiado: boolean;
  alfa: number;
  planta: PlantaPoste;
}

export interface PostePlanta {
  entrada: EntradaPoste;
  memoria: MemoriaCalculo;
  planta?: PlantaPoste;
}

/** Vão usado quando o poste não tem vão informado (especificados, derivação implantada). */
const VAO_PADRAO_M = 40;

const unit = (v: Vetor): Vetor => {
  const m = Math.hypot(v[0], v[1]);
  return m < 1e-9 ? [1, 0] : [v[0] / m, v[1] / m];
};
const girar = (v: Vetor, graus: number): Vetor => {
  const r = (graus * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
};
/** Deflexão com sinal: esquerda = anti-horário (+), direita = horário (−). */
const deflexao = (alfa: number, sentido: SentidoDeflexao) => (sentido === "esquerda" ? alfa : -alfa);

export function montarPlanta(postes: PostePlanta[]): {
  nos: NoPlanta[];
  /** Posição e eixo sugeridos para o próximo poste (fantasma em dimensionamento). */
  proximo: { pos: Vetor; eixo: Vetor };
} {
  const vaos = postes.map((p) => p.entrada.vao).filter((v) => v > 0);
  const vaoFallback = vaos.length ? vaos.reduce((a, b) => a + b, 0) / vaos.length : VAO_PADRAO_M;
  const vaoDe = (p: PostePlanta) => (p.entrada.vao > 0 ? p.entrada.vao : vaoFallback);

  const nos: NoPlanta[] = [];
  let pos: Vetor = [0, 0];
  let dirEntrada: Vetor = [1, 0];

  postes.forEach((p, i) => {
    const planta = p.planta ?? PLANTA_PADRAO;
    if (i > 0) pos = [pos[0] + vaoDe(p) * dirEntrada[0], pos[1] + vaoDe(p) * dirEntrada[1]];

    const alfa = Math.max(0, Math.min(90, p.entrada.alfa || 0));
    const dirSaida = unit(girar(dirEntrada, deflexao(alfa, planta.sentido)));
    const eixo = unit([dirEntrada[0] + dirSaida[0], dirEntrada[1] + dirSaida[1]]);
    const esquerda: Vetor = [-eixo[1], eixo[0]];
    const normal: Vetor = alfa > 0 && planta.sentido === "direita" ? [-esquerda[0], -esquerda[1]] : esquerda;

    const m = p.memoria;
    const circular = p.entrada.tipoFisico === "circular";
    const especificado = m.especTrafo != null || m.especAmarracao != null;
    const Rn = p.entrada.resistencia;
    const esforco = m.esforcoEfetivo ?? m.Ftotal;

    const podeVirar = !circular && !especificado;
    const forte: Vetor = circular ? eixo : planta.virado && podeVirar ? normal : eixo;

    let face: NoPlanta["face"] = null;
    let capacidade = Rn;
    let estado: EstadoPlanta;
    if (especificado) {
      estado = "especificado";
    } else if (circular) {
      estado = esforco > Rn ? "excede" : "ok";
    } else {
      face = planta.virado ? "lisa" : "cava";
      capacidade = face === "lisa" ? Rn : Rn / 2;
      estado = esforco > Rn ? "excede" : esforco > capacidade ? "alerta" : "ok";
    }

    nos.push({
      indice: i,
      pos,
      eixo,
      normal,
      circular,
      forte,
      resultante: especificado ? null : { dir: normal, duasPontas: alfa === 0, esforco },
      face,
      capacidade,
      estado,
      podeVirar,
      estaiado: !!m.estaiado,
      alfa,
      planta,
    });

    dirEntrada = dirSaida;
  });

  const ultimo = nos[nos.length - 1];
  const proximo = ultimo
    ? { pos: [ultimo.pos[0] + vaoFallback * dirEntrada[0], ultimo.pos[1] + vaoFallback * dirEntrada[1]] as Vetor, eixo: dirEntrada }
    : { pos: [0, 0] as Vetor, eixo: [1, 0] as Vetor };

  return { nos, proximo };
}
