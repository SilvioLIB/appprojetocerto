# -*- coding: utf-8 -*-
"""
Gera web/public/clima/ng-municipios.json a partir da tabela-fonte
clima/ng_nbr5419_municipios.csv (NBR 5419-2).

As faixas de Sturges (4 classes de igual amplitude) sao calculadas AQUI, sobre
todos os valores de Ng, exatamente como em clima/ng_faixas_sturges.py
(construir_faixas), para que o lado web fique fiel a fonte. Ver ng.ts.

Uso:  python web/scripts/gerar-ng-json.py
"""
import csv
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CSV_NG = os.path.join(RAIZ, "clima", "ng_nbr5419_municipios.csv")
SAIDA = os.path.join(RAIZ, "web", "public", "clima", "ng-municipios.json")

N_FAIXAS = 4
ROTULOS = ["Baixo", "Moderado", "Alto", "Muito alto"]
CORES = ["#2e7d32", "#f9a825", "#ef6c00", "#c62828"]


def main():
    por_uf = {}
    valores = []
    with open(CSV_NG, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            mun = (row.get("municipio") or "").strip()
            uf = (row.get("uf") or "").strip().upper()
            bruto = (row.get("ng") or "").strip().replace(",", ".")
            if not mun or not uf or not bruto:
                continue
            try:
                ng = int(round(float(bruto)))
            except ValueError:
                continue
            por_uf.setdefault(uf, []).append([mun, ng])
            valores.append(ng)

    # Faixas de Sturges: k=4 classes de igual amplitude sobre [min, max].
    vmin, vmax = min(valores), max(valores)
    h = (vmax - vmin) / N_FAIXAS
    limites = [vmin + i * h for i in range(N_FAIXAS + 1)]
    limites[-1] = vmax
    limites = [round(x, 6) for x in limites]

    for uf in por_uf:
        por_uf[uf].sort(key=lambda x: x[0])

    dados = {
        "fonte": "ABNT NBR 5419-2 (Ng por municipio) - metodo de Sturges, 4 faixas",
        "bandas": {"limites": limites, "rotulos": ROTULOS, "cores": CORES},
        "municipios": dict(sorted(por_uf.items())),
    }

    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, separators=(",", ":"))

    n = sum(len(v) for v in por_uf.values())
    print(f"[ok] {n} municipios / {len(por_uf)} UFs")
    print(f"[ok] Ng min={vmin} max={vmax} | limites={limites}")
    print(f"[saida] {SAIDA}  ({os.path.getsize(SAIDA)} bytes)")


if __name__ == "__main__":
    main()
