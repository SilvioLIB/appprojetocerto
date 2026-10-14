import { ImageResponse } from "next/og";

// Exigido pelo export estático do APK; no site o PNG é gerado no build.
export const dynamic = "force-static";

/**
 * Ícone da tela inicial do iPhone/iPad ("Adicionar à Tela de Início"): o iOS
 * ignora SVG, então o mesmo traço do app/icon.svg sai aqui em PNG 180×180,
 * sem cantos arredondados (o próprio iOS recorta).
 */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#b4642a" }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <path
            d="M8 16.5l5 5L23 8.5"
            fill="none"
            stroke="#fdf8f3"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M18.5 8.5h9" stroke="#fdf8f3" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    ),
    size,
  );
}
