"use client";

import { useEffect } from "react";
import { Cable, Lock, Wind } from "lucide-react";

import { useMounted } from "@/lib/use-mounted";
import { useProjetoV2 } from "@/lib/projeto-v2-store";
import { registrarVoltar } from "@/lib/nativo/voltar";
import { fmt } from "@/lib/dimensionamento";
import { LinhaProjeto } from "./linha-projeto";
import { LinhaProjetoCompacta } from "./linha-projeto-compacta";
import { AberturaProjeto } from "./abertura-projeto";
import { PosteAtual } from "./poste-atual";
import { MemorialV2 } from "./memorial-v2";
import { PlantaRede } from "./planta-rede";
import { DevBar, DevToggle } from "./dev-mode";
import { EtapasProjeto } from "./etapas-projeto";

/** Chips com as amarras travadas do projeto, visíveis em todas as etapas. */
function AmarrasTravadas() {
  const s = useProjetoV2();
  if (!s.vento || !s.condutor) return null;
  const chip = "inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <span className={chip}>
        <Lock className="size-3 text-muted-foreground" />
        <span className="font-medium">{s.obra}</span>
        <span className="text-muted-foreground">· {s.projetista}</span>
      </span>
      <span className={`${chip} border-sky-600/30 bg-sky-500/10`}>
        <Wind className="size-3 text-sky-700 dark:text-sky-300" />
        <span className="font-medium tabular-nums">{fmt(s.vento.v_kmh, 1)} km/h</span>
      </span>
      <span className={chip}>
        <Cable className="size-3 text-primary" />
        <span className="font-medium">
          {s.condutor.tipoCabo} {s.condutor.awg}
        </span>
        <span className="text-muted-foreground tabular-nums">· d = {fmt(s.condutor.d, 2)} mm</span>
      </span>
    </div>
  );
}

/** Fluxo guiado do projeto (v2): abertura → postes em sequência → memorial. */
export default function ProjetoV2() {
  const montado = useMounted();
  const fase = useProjetoV2((s) => s.fase);
  const reabrir = useProjetoV2((s) => s.reabrir);
  const editandoId = useProjetoV2((s) => s.editandoId);

  // Abrir (ou sair de) um poste para edição leva a tela ao topo do formulário.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [editandoId]);

  // Voltar do Android no memorial: retorna aos postes sem apagar nada.
  useEffect(() => {
    if (fase !== "concluido") return;
    return registrarVoltar(() => {
      reabrir();
      return true;
    });
  }, [fase, reabrir]);

  if (!montado) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="h-64 animate-pulse rounded-xl bg-muted/50" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-8">
      <div className="mb-4 flex justify-end print:hidden">
        <DevToggle />
      </div>

      <DevBar />

      <div className="mb-5 rounded-xl bg-card px-2 py-4 ring-1 ring-foreground/10 sm:px-4 print:hidden">
        <EtapasProjeto />
      </div>

      {fase !== "abertura" && <AmarrasTravadas />}

      {/* Celular e tablet: a linha lateral não cabe — vira uma faixa horizontal. */}
      {fase !== "abertura" && (
        <div className="mt-4">
          <LinhaProjetoCompacta />
        </div>
      )}

      <div className={`grid grid-cols-1 gap-10 lg:grid-cols-[230px_minmax(0,1fr)] ${fase !== "abertura" ? "mt-6" : ""}`}>
        <div className="hidden lg:block print:hidden">
          <div className="sticky top-20">
            <LinhaProjeto />
          </div>
        </div>

        <div className="min-w-0">
          {fase === "abertura" && <AberturaProjeto />}
          {fase === "postes" && (
            <div className="flex flex-col gap-6">
              <PlantaRede fantasma />
              {/* key: trocar de poste em edição remonta o formulário com os dados dele. */}
              <PosteAtual key={editandoId ?? "novo"} />
            </div>
          )}
          {fase === "concluido" && <MemorialV2 />}
        </div>
      </div>
    </div>
  );
}
