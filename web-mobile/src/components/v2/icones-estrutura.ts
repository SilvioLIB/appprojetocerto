import {
  Anchor, ArrowRight, ArrowRightToLine, Cable, CornerUpRight, PlugZap, Split, X, type LucideIcon,
} from "lucide-react";

import type { EstruturaId } from "@/lib/dimensionamento";

/** Ícone de cada tipo de estrutura — o mesmo na escolha do poste e no memorial. */
export const ICONES_ESTRUTURA: Record<EstruturaId, LucideIcon> = {
  derivacao: Split,
  transformador: PlugZap,
  passagem: ArrowRight,
  angulo: CornerUpRight,
  circuito_duplo: Cable,
  cruzamento: X,
  amarracao: Anchor,
  fim_linha: ArrowRightToLine,
};
