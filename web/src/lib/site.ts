/**
 * Identidade e mapa do site — fonte única para cabeçalho, rodapé, metadados,
 * manifest e 404. Ao criar uma rota nova, registre-a em NAVEGACAO.
 */
import { FolderKanban, LifeBuoy, Waypoints, type LucideIcon } from "lucide-react";

export const SITE = {
  nome: "Projeto Certo",
  slogan: "Uma solução para redes de distribuição",
  /** Norma que embasa os cálculos — referência técnica, não a marca. */
  normaReferencia: "CPFL GED-3648",
  descricao:
    "Projeto Certo: projeto guiado de postes para redes de distribuição — amarre vento e condutor da obra, dimensione cada poste e gere o memorial.",
  versao: "2.0",
} as const;

export interface ItemNavegacao {
  href: string;
  rotulo: string;
  icone: LucideIcon;
}

/** Rotas do site, na ordem em que aparecem no cabeçalho. */
export const NAVEGACAO: ItemNavegacao[] = [
  { href: "/", rotulo: "Painel", icone: FolderKanban },
  { href: "/projeto", rotulo: "Projeto", icone: Waypoints },
  { href: "/ajuda", rotulo: "Como usar", icone: LifeBuoy },
];

/** Rotas de tela cheia, sem cabeçalho e rodapé do site. */
export const ROTAS_TELA_CHEIA = ["/login"];

/** Rota ativa: "/" só casa exatamente; as demais casam também subcaminhos. */
export function rotaAtiva(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
