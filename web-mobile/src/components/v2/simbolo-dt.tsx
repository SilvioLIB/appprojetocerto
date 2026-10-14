/**
 * Símbolo do poste em corte (vista de topo) — a marca visual da planta da rede.
 * Duplo T: as mesas (faces lisas) ficam em cima e embaixo, as cavas nas
 * laterais; o eixo forte (perpendicular à face lisa) é o eixo y local.
 * Circular: um disco — resistência igual em qualquer direção.
 *
 * Para usar DENTRO de um <svg>: o grupo é centrado na origem; posicione com um
 * <g transform="translate(x y)"> por fora.
 */

/** Perfil duplo T em uma caixa 48×48 (centro em 24,24), cantos arredondados. */
export const PATH_DT =
  "M10 6H38C39.1 6 40 6.9 40 8V13C40 14.1 39.1 15 38 15H29V33H38C39.1 33 40 33.9 40 35V40C40 41.1 39.1 42 38 42H10C8.9 42 8 41.1 8 40V35C8 33.9 8.9 33 10 33H19V15H10C8.9 15 8 14.1 8 13V8C8 6.9 8.9 6 10 6Z";

/**
 * Rotação (graus, sentido de tela) que alinha o eixo forte do símbolo com o
 * vetor `forte` dado em coordenadas de tela (y para baixo).
 */
export function anguloForte(forteTela: [number, number]): number {
  return (Math.atan2(forteTela[1], forteTela[0]) * 180) / Math.PI - 90;
}

export function GlifoPoste({
  circular = false,
  angulo = 0,
  alerta = false,
  escala = 0.5,
}: {
  circular?: boolean;
  /** Rotação em graus (use `anguloForte`). */
  angulo?: number;
  /** Contorno em âmbar: a resultante está nas cavas acima de Rn/2. */
  alerta?: boolean;
  /** 0,5 → ~16×18 px (planta); 1 → ~32×36 px (esquemas). */
  escala?: number;
}) {
  const stroke = alerta ? "var(--esforco-cava)" : "var(--poste-stroke)";
  if (circular) {
    return (
      <circle r={17 * escala} fill="var(--poste-fill)" stroke={stroke} strokeWidth={3 * escala} />
    );
  }
  return (
    <g
      className="transition-transform duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
      style={{ transform: `rotate(${angulo}deg)` }}
    >
      <path
        d={PATH_DT}
        transform={`scale(${escala}) translate(-24 -24)`}
        fill="var(--poste-fill)"
        stroke={stroke}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </g>
  );
}
