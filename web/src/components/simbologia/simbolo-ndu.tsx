/**
 * Glifos da simbologia NDU 006.34 (só os símbolos ATIVOS de lib/simbologia.ts).
 * Símbolo em standby não tem glifo: `SimboloNDU` devolve null para ele.
 *
 * Convenção de cores da norma: postes em verde, rede primária em vermelho,
 * secundária em azul; demais elementos no traço do texto.
 */
import type { ReactNode } from "react";

import { simboloPorId } from "@/lib/simbologia";

export const VERDE_NDU = "#22b345";
export const VERMELHO_NDU = "#e5322d";
const TRACO = "currentColor";

/** Caixa padrão 24×24 (postes); linhas usam 40×12. */
const GLIFOS: Record<string, { viewBox: string; desenho: ReactNode }> = {
  // Duplo T existente: retângulo com as duas diagonais (⊠).
  poste_duplo_t_existente: {
    viewBox: "0 0 24 24",
    desenho: (
      <g fill="none" stroke={VERDE_NDU} strokeWidth="1.6">
        <rect x="6" y="3" width="12" height="18" />
        <path d="M6 3L18 21M18 3L6 21" />
      </g>
    ),
  },
  // Duplo T projetado: idem, com os triângulos de cima e de baixo cheios (ampulheta).
  poste_duplo_t_projetado: {
    viewBox: "0 0 24 24",
    desenho: (
      <g stroke={VERDE_NDU} strokeWidth="1.6" strokeLinejoin="round">
        <path d="M6 3H18L12 12z M6 21H18L12 12z" fill={VERDE_NDU} />
        <rect x="6" y="3" width="12" height="18" fill="none" />
      </g>
    ),
  },
  // Tubular de concreto existente: dois círculos concêntricos (◎).
  poste_concreto_tubular_existente: {
    viewBox: "0 0 24 24",
    desenho: (
      <g fill="none" stroke={VERDE_NDU} strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
      </g>
    ),
  },
  // Tubular de concreto projetado: círculo com metade direita cheia e anel interno.
  poste_concreto_tubular_projetado: {
    viewBox: "0 0 24 24",
    desenho: (
      <g stroke={VERDE_NDU} strokeWidth="1.6">
        <path d="M12 3A9 9 0 0 1 12 21z" fill={VERDE_NDU} />
        <circle cx="12" cy="12" r="9" fill="none" />
        <circle cx="12" cy="12" r="4" fill="none" />
      </g>
    ),
  },
  rede_primaria_existente: {
    viewBox: "0 0 40 12",
    desenho: <line x1="1" y1="6" x2="39" y2="6" stroke={VERMELHO_NDU} strokeWidth="1.8" />,
  },
  rede_primaria_projetada: {
    viewBox: "0 0 40 12",
    desenho: <line x1="1" y1="6" x2="39" y2="6" stroke={VERMELHO_NDU} strokeWidth="1.8" strokeDasharray="6 4" />,
  },
  // Textos: o existente é texto corrido; o projetado vai dentro de um oval.
  texto_existente: {
    viewBox: "0 0 40 12",
    desenho: (
      <text x="20" y="9" textAnchor="middle" fill={TRACO} fontSize="8">
        3#2 CAA
      </text>
    ),
  },
  texto_projetado: {
    viewBox: "0 0 40 12",
    desenho: (
      <g>
        <rect x="1" y="1" width="38" height="10" rx="5" fill="none" stroke={TRACO} strokeWidth="1" />
        <text x="20" y="9" textAnchor="middle" fill={TRACO} fontSize="8">
          3#2 CAA
        </text>
      </g>
    ),
  },
  // Estai de âncora projetado: traço tracejado terminando em arco “)”.
  estai_ancora_projetado: {
    viewBox: "0 0 40 12",
    desenho: (
      <g fill="none" stroke={TRACO} strokeWidth="1.2">
        <line x1="2" y1="6" x2="32" y2="6" strokeDasharray="3 2" />
        <path d="M32 1.5Q37 6 32 10.5" />
      </g>
    ),
  },
  // Transformador da empresa projetado: ponto, haste e triângulo com metade inferior cheia.
  trafo_empresa_projetado: {
    viewBox: "0 0 40 24",
    desenho: (
      <g stroke={TRACO} strokeWidth="1.2" strokeLinejoin="round">
        <circle cx="3" cy="12" r="1.6" fill={TRACO} />
        <line x1="3" y1="12" x2="22" y2="12" />
        <path d="M22 12L37 12L37 21z" fill={TRACO} />
        <path d="M22 12L37 3V21z" fill="none" />
      </g>
    ),
  },
};

/** Glifo do símbolo, só se ele estiver ativo. */
function glifoAtivo(id: string) {
  const simbolo = simboloPorId(id);
  const glifo = GLIFOS[id];
  if (!simbolo || simbolo.status !== "ativo" || !glifo) return null;
  const [, , w, h] = glifo.viewBox.split(" ").map(Number);
  return { simbolo, glifo, w, h };
}

/** Largura (px) do glifo para uma altura dada — 0 se o símbolo não está ativo. */
export function larguraGlifoNDU(id: string, altura: number): number {
  const g = glifoAtivo(id);
  return g ? (altura * g.w) / g.h : 0;
}

/**
 * Mesmo glifo, para usar DENTRO de um <svg> (planta da rede): centrado na
 * origem — posicione e gire com um <g transform> por fora.
 */
export function GlifoNDU({ id, altura = 20 }: { id: string; altura?: number }) {
  const g = glifoAtivo(id);
  if (!g) return null;
  const largura = (altura * g.w) / g.h;
  return (
    <svg
      x={-largura / 2}
      y={-altura / 2}
      width={largura}
      height={altura}
      viewBox={g.glifo.viewBox}
      overflow="visible"
      aria-hidden
    >
      {g.glifo.desenho}
    </svg>
  );
}

/** Desenha o símbolo NDU pelo id; null se o símbolo está em standby (sem glifo). */
export function SimboloNDU({
  id,
  altura = 20,
  className,
}: {
  id: string;
  /** Altura em px; a largura segue a proporção do viewBox. */
  altura?: number;
  className?: string;
}) {
  const g = glifoAtivo(id);
  if (!g) return null;
  const { simbolo, glifo, w, h } = g;
  return (
    <svg
      viewBox={glifo.viewBox}
      height={altura}
      width={(altura * w) / h}
      role="img"
      aria-label={simbolo.descricao}
      className={className}
    >
      {glifo.desenho}
    </svg>
  );
}
