"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Warp } from "@paper-design/shaders-react";

import { CATEGORIAS, operacoesDaCategoria } from "@/lib/operacoes";
import { useMounted } from "@/lib/use-mounted";

/** Configurações de shader por índice (baseadas no componente original). */
function getShaderConfig(index: number) {
  const configs = [
    { proportion: 0.3, softness: 0.8, distortion: 0.15, swirl: 0.6, swirlIterations: 8, shape: "checks" as const, shapeScale: 0.08,
      colors: ["hsl(210, 100%, 22%)", "hsl(200, 100%, 55%)", "hsl(190, 90%, 35%)", "hsl(205, 100%, 65%)"] },
    { proportion: 0.4, softness: 1.2, distortion: 0.2, swirl: 0.9, swirlIterations: 12, shape: "stripes" as const, shapeScale: 0.12,
      colors: ["hsl(160, 100%, 20%)", "hsl(150, 100%, 55%)", "hsl(170, 90%, 30%)", "hsl(155, 100%, 60%)"] },
    { proportion: 0.35, softness: 0.9, distortion: 0.18, swirl: 0.7, swirlIterations: 10, shape: "checks" as const, shapeScale: 0.1,
      colors: ["hsl(255, 100%, 28%)", "hsl(265, 100%, 60%)", "hsl(250, 90%, 35%)", "hsl(260, 100%, 68%)"] },
    { proportion: 0.45, softness: 1.1, distortion: 0.22, swirl: 0.8, swirlIterations: 15, shape: "stripes" as const, shapeScale: 0.09,
      colors: ["hsl(28, 100%, 32%)", "hsl(40, 100%, 60%)", "hsl(35, 90%, 40%)", "hsl(45, 100%, 66%)"] },
    { proportion: 0.38, softness: 0.95, distortion: 0.16, swirl: 0.85, swirlIterations: 11, shape: "checks" as const, shapeScale: 0.11,
      colors: ["hsl(340, 90%, 28%)", "hsl(350, 100%, 58%)", "hsl(330, 90%, 35%)", "hsl(345, 100%, 66%)"] },
    { proportion: 0.42, softness: 1.0, distortion: 0.19, swirl: 0.75, swirlIterations: 9, shape: "stripes" as const, shapeScale: 0.13,
      colors: ["hsl(185, 100%, 22%)", "hsl(195, 100%, 55%)", "hsl(200, 90%, 32%)", "hsl(190, 100%, 62%)"] },
  ];
  return configs[index % configs.length];
}

export default function FeaturesCards() {
  // Só renderiza o WebGL depois de montar (evita SSR/hidratação e melhora o load).
  const montado = useMounted();

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h2 className="mb-3 text-3xl font-light text-foreground md:text-4xl">Escolha um grupo de cálculo</h2>
          <p className="mx-auto max-w-2xl text-muted-foreground">
            Cada categoria reúne os cálculos da norma GED-3648. Faça-os separadamente e, ao final,
            consolide tudo em um laudo.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIAS.map((cat, index) => {
            const cfg = getShaderConfig(index);
            const Icon = cat.icon;
            const qtd = operacoesDaCategoria(cat.id).length;
            return (
              <Link key={cat.id} href={`/categoria/${cat.id}`} className="group relative h-72 focus:outline-none">
                <div className="absolute inset-0 overflow-hidden rounded-3xl" style={{ background: `linear-gradient(135deg, ${cfg.colors[0]}, ${cfg.colors[2]})` }}>
                  {montado && (
                    <Warp
                      style={{ height: "100%", width: "100%" }}
                      proportion={cfg.proportion} softness={cfg.softness} distortion={cfg.distortion}
                      swirl={cfg.swirl} swirlIterations={cfg.swirlIterations} shape={cfg.shape}
                      shapeScale={cfg.shapeScale} scale={1} rotation={0} speed={0.6} colors={cfg.colors}
                    />
                  )}
                </div>

                <div className="relative z-10 flex h-full flex-col rounded-3xl border border-white/15 bg-black/70 p-7 transition-colors group-hover:bg-black/60 group-focus-visible:ring-2 group-focus-visible:ring-white">
                  <div className="mb-5 flex items-center justify-between">
                    <Icon className="size-10 text-white drop-shadow" />
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white">
                      {qtd} cálculo{qtd > 1 ? "s" : ""}
                    </span>
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-white">{cat.titulo}</h3>
                  <p className="flex-grow text-sm leading-relaxed text-gray-100">{cat.descricao}</p>
                  <div className="mt-5 flex items-center text-sm font-semibold text-white">
                    <span className="mr-2">Abrir cálculos</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
