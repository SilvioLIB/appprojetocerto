# -*- coding: utf-8 -*-
"""
Faixas de NG por municipio - metodo de Sturges
===============================================
Constroi faixas de classificacao do indice Ng (numero de descargas atmosfericas
por km2/ano, ABNT NBR 5419-2) a partir do arquivo ng_nbr5419_municipios.csv,
usando a mecanica do metodo de Sturges para tabela de frequencia:

    numero de classes (Sturges) ..... k = 1 + 3,322 * log10(n)
    amplitude total ................. R = max - min
    amplitude de classe ............. h = R / k

Aqui k e' FIXADO em 4 (parametro N_FAIXAS), pois foram pedidas 4 faixas. Como
o Ng vai de 0 a 32 (R = 32, divisivel por 4), as faixas ficam com amplitude
h = 8 exata. Obs.: o Sturges "puro" para n = 5.572 sugeriria k ~= 14 classes;
esta e' uma reducao intencional para uma classificacao pratica em 4 niveis.

Convencao dos intervalos: [a, b) (fechado-aberto), exceto a ultima faixa, que
e' fechada [a, b] para incluir o valor maximo.

Saidas (na pasta do script):
  - ng_faixas_sturges_resumo.csv      -> tabela de frequencia das 4 faixas
  - ng_faixas_sturges_municipios.csv  -> cada municipio com a sua faixa

Uso:  python ng_faixas_sturges.py

Projeto CEAR/UFPB
"""

import os
import csv
import math

ARQUIVO_CSV = "ng_nbr5419_municipios.csv"
N_FAIXAS = 4
ROTULOS = ("Baixo", "Moderado", "Alto", "Muito alto")   # grau de descarga de cada faixa
CORES   = ("#2e7d32", "#f9a825", "#ef6c00", "#c62828")  # verde->amarelo->laranja->vermelho
SEP = ";"


def caminho(nome):
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), nome)


def carregar_ng(caminho_csv):
    """Le (municipio, uf, ng) do CSV. Retorna lista de dicts com ng float."""
    registros = []
    with open(caminho_csv, encoding="utf-8-sig", newline="") as f:
        for linha in csv.DictReader(f):
            mun = (linha.get("municipio") or "").strip()
            uf = (linha.get("uf") or "").strip().upper()
            bruto = (linha.get("ng") or "").strip().replace(",", ".")
            if not mun or not bruto:
                continue
            try:
                ng = float(bruto)
            except ValueError:
                continue
            registros.append({"municipio": mun, "uf": uf, "ng": ng})
    return registros


def sturges_k(n):
    """Numero de classes sugerido por Sturges (apenas informativo)."""
    return 1 + 3.322 * math.log10(n) if n > 0 else 1


def construir_faixas(valores, k=N_FAIXAS):
    """Retorna (limites, h, vmin, vmax) das k faixas de igual amplitude."""
    vmin, vmax = min(valores), max(valores)
    h = (vmax - vmin) / k
    limites = [vmin + i * h for i in range(k + 1)]   # k+1 fronteiras
    limites[-1] = vmax                               # garante o topo exato
    return limites, h, vmin, vmax


def classificar(ng, limites):
    """Indice (0..k-1) da faixa de 'ng'. Ultima faixa e' fechada no topo."""
    k = len(limites) - 1
    for i in range(k):
        if ng < limites[i + 1] or (i == k - 1 and ng <= limites[k]):
            return i
    return k - 1


def rotulo_faixa(i, limites):
    """Texto do intervalo, ex.: '[8, 16)'. Ultima faixa fechada: '[24, 32]'."""
    a, b = limites[i], limites[i + 1]
    fecha = "]" if i == len(limites) - 2 else ")"
    return f"[{a:g}, {b:g}{fecha}"


def nome_nivel(i):
    return ROTULOS[i] if i < len(ROTULOS) else f"Faixa {i + 1}"


# ------------------------------------------------------------------------------
# API de classificacao de UMA cidade (reutilizavel por outros modulos)
# ------------------------------------------------------------------------------
_LIMITES_CACHE = None


def limites_padrao(caminho_csv=None):
    """Limites das N_FAIXAS faixas, construidos do CSV de Ng (cacheado em memoria).
       Faixas atuais (Ng 0..32): [0, 8, 16, 24, 32]."""
    global _LIMITES_CACHE
    if _LIMITES_CACHE is None:
        alvo = caminho_csv or caminho(ARQUIVO_CSV)
        valores = [r["ng"] for r in carregar_ng(alvo)]
        _LIMITES_CACHE = construir_faixas(valores, N_FAIXAS)[0]
    return _LIMITES_CACHE


def grau_de_ng(ng, caminho_csv=None):
    """Classifica um valor de Ng nas 4 faixas de Sturges.
       Retorna dict {faixa, nivel, intervalo, cor} ou None se ng invalido."""
    if ng is None:
        return None
    try:
        v = float(ng)
    except (TypeError, ValueError):
        return None
    lims = limites_padrao(caminho_csv)
    i = classificar(v, lims)
    return {"faixa": i + 1, "nivel": nome_nivel(i),
            "intervalo": rotulo_faixa(i, lims),
            "cor": CORES[i] if i < len(CORES) else "#888888"}


def saida(nome):
    """Caminho de um arquivo de saida dentro da pasta clima/saidas/."""
    pasta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "saidas")
    os.makedirs(pasta, exist_ok=True)
    return os.path.join(pasta, nome)


def main():
    csv_ng = caminho(ARQUIVO_CSV)
    if not os.path.exists(csv_ng):
        raise SystemExit(f"Arquivo nao encontrado: {csv_ng}")

    registros = carregar_ng(csv_ng)
    valores = [r["ng"] for r in registros]
    n = len(valores)

    limites, h, vmin, vmax = construir_faixas(valores, N_FAIXAS)
    k_sug = sturges_k(n)

    # frequencia por faixa
    freq = [0] * N_FAIXAS
    for r in registros:
        i = classificar(r["ng"], limites)
        r["faixa"] = i + 1
        r["faixa_intervalo"] = rotulo_faixa(i, limites)
        r["faixa_nivel"] = nome_nivel(i)
        freq[i] += 1

    # ---- impressao no terminal ----
    print(f"n municipios = {n} | Ng min = {vmin:g} | max = {vmax:g} | R = {vmax - vmin:g}")
    print(f"Sturges (informativo): k = 1 + 3.322*log10({n}) = {k_sug:.2f} "
          f"-> {math.ceil(k_sug)} classes")
    print(f"Faixas usadas: k = {N_FAIXAS} | amplitude de classe h = R/{N_FAIXAS} = {h:g}\n")
    print(f"{'Faixa':<6}{'Grau':<14}{'Intervalo':<12}{'freq':>7}{'%':>8}{'acum%':>8}")
    acum = 0.0
    for i in range(N_FAIXAS):
        p = 100 * freq[i] / n
        acum += p
        print(f"{i+1:<6}{nome_nivel(i):<14}{rotulo_faixa(i, limites):<12}"
              f"{freq[i]:>7}{p:>7.1f}%{acum:>7.1f}%")
    print(f"{'TOTAL':<32}{sum(freq):>7}{100.0:>7.1f}%")

    # ---- CSV 1: resumo das faixas ----
    arq_resumo = saida("ng_faixas_sturges_resumo.csv")
    with open(arq_resumo, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=SEP)
        w.writerow(["faixa", "grau_descarga", "intervalo_ng", "ng_de", "ng_ate",
                    "n_municipios", "percentual"])
        for i in range(N_FAIXAS):
            w.writerow([i + 1, nome_nivel(i), rotulo_faixa(i, limites),
                        f"{limites[i]:g}", f"{limites[i+1]:g}",
                        freq[i], f"{100*freq[i]/n:.1f}".replace(".", ",")])

    # ---- CSV 2: classificacao por municipio ----
    arq_mun = saida("ng_faixas_sturges_municipios.csv")
    with open(arq_mun, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=SEP)
        w.writerow(["municipio", "uf", "ng", "faixa", "faixa_intervalo", "grau_descarga"])
        for r in sorted(registros, key=lambda x: (x["uf"], x["municipio"])):
            w.writerow([r["municipio"], r["uf"], f"{r['ng']:g}",
                        r["faixa"], r["faixa_intervalo"], r["faixa_nivel"]])

    print(f"\n[saida] {arq_resumo}")
    print(f"[saida] {arq_mun}")


if __name__ == "__main__":
    main()
