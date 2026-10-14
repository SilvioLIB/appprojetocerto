import "./globals.css";
import { UserMenu } from "@/components/auth/user-menu";
import { RaizHtml, metadataRaiz, viewportRaiz } from "@/components/raiz-html";
import { getUsuarioAtual } from "@/lib/auth/session";

/** Layout raiz do alvo web: o usuário vem do cookie de sessão (portão de login). */

export const metadata = metadataRaiz;
export const viewport = viewportRaiz;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const usuario = await getUsuarioAtual();
  return (
    <RaizHtml usuario={usuario} menuUsuario={usuario && <UserMenu usuario={usuario} />}>
      {children}
    </RaizHtml>
  );
}
