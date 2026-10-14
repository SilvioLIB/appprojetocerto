import "./globals.css";
import { AvisoOffline } from "@/components/aviso-offline";
import { PonteNativa } from "@/components/ponte-nativa";
import { RaizHtml, metadataRaiz, viewportRaiz } from "@/components/raiz-html";
import { USUARIO_LOCAL } from "@/lib/plataforma";

/** Layout raiz do APK: sem servidor, sem login — usuário local fixo. */

export const metadata = metadataRaiz;
export const viewport = viewportRaiz;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <RaizHtml usuario={USUARIO_LOCAL} aviso={<AvisoOffline />}>
      <PonteNativa />
      {children}
    </RaizHtml>
  );
}
