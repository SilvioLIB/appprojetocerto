import type { PosteProjeto } from "@/lib/projeto-v2-store";
import { tomUtilizacao } from "@/components/v2/medidor-utilizacao";

/**
 * A obra em miniatura: o condutor de cobre atravessa os postes já
 * dimensionados, na ordem em que foram lançados. Poste que não passou fica em
 * vermelho. Sem postes, o condutor aparece tracejado — a linha ainda por fazer.
 */
export function LinhaResumo({ postes }: { postes: PosteProjeto[] }) {
  const L = 640;
  const H = 96;
  const yCabo = 34;
  const margem = 28;
  const n = postes.length;
  const passo = n > 1 ? (L - 2 * margem) / (n - 1) : 0;
  const xs = n === 1 ? [L / 2] : postes.map((_, i) => margem + i * passo);

  return (
    <svg
      viewBox={`0 0 ${L} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={n === 0 ? "Nenhum poste lançado ainda" : `${n} poste(s) lançados na linha`}
    >
      {/* chão */}
      <line x1={0} x2={L} y1={H - 14} y2={H - 14} className="stroke-border" strokeWidth={1} />

      {/* condutor */}
      {n === 0 ? (
        <line x1={margem} x2={L - margem} y1={yCabo} y2={yCabo} className="stroke-primary/50" strokeWidth={2} strokeDasharray="6 6" />
      ) : (
        <path
          d={xs
            .map((x, i) => {
              if (i === 0) return `M ${n === 1 ? margem : x} ${yCabo}`;
              const meio = (xs[i - 1] + x) / 2;
              // Leve catenária entre postes: o cabo "pesa" no vão.
              return `Q ${meio} ${yCabo + Math.min(10, passo / 12)} ${x} ${yCabo}`;
            })
            .join(" ") + (n === 1 ? ` L ${L - margem} ${yCabo}` : "")}
          className="fill-none stroke-primary"
          strokeWidth={2}
        />
      )}

      {/* postes */}
      {n === 0 ? (
        <g className="opacity-60">
          <rect x={margem - 3} y={yCabo - 8} width={6} height={H - 14 - (yCabo - 8)} rx={1} className="fill-muted stroke-muted-foreground/60" strokeDasharray="3 3" />
        </g>
      ) : (
        postes.map((p, i) => {
          const x = xs[i];
          const ok = p.memoria.aprovado;
          // Mesma regra de cor do medidor de utilização; especificado em cobre.
          const espec = p.memoria.especTrafo != null || p.memoria.especAmarracao != null;
          const cor = espec
            ? "fill-primary"
            : tomUtilizacao(p.memoria.utilizacaoEfetiva * 100, p.memoria.limiarPct, ok).fill;
          return (
            <g key={p.id}>
              <title>{`Poste ${String(i + 1).padStart(2, "0")} — ${espec ? "especificado" : ok ? "aprovado" : "a rever"}`}</title>
              <rect x={x - 3} y={yCabo - 8} width={6} height={H - 14 - (yCabo - 8)} rx={1} className="fill-poste-fill stroke-poste-stroke" strokeWidth={1} />
              <rect x={x - 10} y={yCabo - 3} width={20} height={3} rx={1} className="fill-poste-stroke" />
              <circle cx={x} cy={yCabo - 15} r={3.5} className={cor} />
              {(n <= 12 || i === 0 || i === n - 1) && (
                <text x={x} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px] tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </text>
              )}
            </g>
          );
        })
      )}
    </svg>
  );
}
