# Pacote `clima/`

Ferramentas de **descargas atmosféricas (Ng)** e **contorno climático por estado**,
portadas do projeto *Redes resilientes* (CEAR/UFPB) e adaptadas para uso genérico
— **não dependem de cadastro de transformadores**.

## Módulos

| Arquivo | O que faz | Normas |
|---|---|---|
| `ng_nbr5419.py` | Ng (nº de descargas atmosféricas/km²/ano) por município + casamento com malhas do IBGE | NBR 5419-2 |
| `ng_faixas_sturges.py` | Classifica o Ng em 4 faixas (Baixo→Muito alto) pelo método de Sturges | NBR 5419-2 |
| `isopletas_nbr6123.py` | Campo espacial de V0 (vento de projeto) a partir das isopletas | NBR 6123 |
| `contorno_clima_estados.py` | Análise climática de um estado: Temperatura + V0 + Ng, com mapa/GeoJSON/CSV | NBR 6123 + 5419-2 |
| `ng_nbr5419_municipios.csv` | Tabela-fonte de Ng (5.572 municípios) | — |

> `contorno_clima_estados.py` importa `isopletas_nbr6123` e `ng_nbr5419` — por isso os três vêm juntos.

## Uso rápido — Ng (leve, sem rede)

```python
from clima import ng_municipio, grau_de_ng

ng  = ng_municipio("João Pessoa", "PB")   # -> valor tabelado
cls = grau_de_ng(ng)                       # -> {'faixa','nivel','intervalo','cor'}
```

O lookup simples (`ng_municipio`) e a classificação (`grau_de_ng`) rodam **só com a
biblioteca padrão** do Python.

## Uso — contorno climático de um estado (pesado, ~1–2 min)

```python
from clima import executar_analise
res = executar_analise("PB")   # baixa IBGE + NASA POWER, grava em clima/saidas/
```

Ou pela linha de comando / interface:

```bash
python clima/contorno_clima_estados.py --uf PB      # direto (sem janela)
python clima/contorno_clima_estados.py              # abre a interface Tkinter
```

Saídas (`clima/saidas/`): `subcontornos_<uf>.png`, `subcontornos_<uf>.geojson`,
`pontos_qualificados_<uf>.csv`.

## Dependências

- **Ng lookup / faixas:** nenhuma além do stdlib.
- **`carregar_ng_estado` e contorno:** `requests numpy scipy matplotlib shapely`
  (já incluídas no `requirements.txt` da raiz).

## Adaptações em relação ao projeto original

- Imports entre módulos resolvidos para funcionar como **pacote** (`from clima import …`)
  e como **script** standalone.
- Saídas gravadas em `clima/saidas/` (não sujam a raiz do projeto).
- Removidas as referências a transformadores nos comentários (a lógica já era agnóstica).
