# Projeto Certo

**Uma solução para redes de distribuição.**

Ferramenta de apoio ao dimensionamento mecânico de postes e estruturas de redes
de distribuição, baseada na Norma Técnica **CPFL GED-3648 — "Projeto de Rede de
Distribuição – Cálculo Mecânico"** (v2.9).

O site é organizado em torno do **projeto guiado**: amarre vento e condutor da
obra na abertura, dimensione os postes em sequência e gere o memorial no final.

## Estrutura do repositório

```
Novo validador/
├── web/                 Aplicação web (Next.js + shadcn + Tailwind + TypeScript)  ← app principal
│   ├── src/app/               Rotas: /  (painel)  /projeto  /ajuda  /login
│   │                          + not-found, error, robots, manifest, icon
│   ├── src/lib/site.ts        Marca (nome, slogan), versão e mapa de navegação
│   ├── src/lib/validador.ts   Motor de cálculo (fórmulas + catálogos) — porte do Python
│   ├── src/lib/dimensionamento.ts  Dimensionamento poste a poste (projeto guiado)
│   ├── src/lib/vento.ts       Vento de projeto (NBR 6123) por coordenada
│   ├── src/lib/projeto-v2-store.ts  Estado do projeto (zustand + localStorage)
│   ├── src/lib/projeto-arquivo.ts   Cópia de segurança do projeto (.json)
│   ├── src/components/v2/     Telas do projeto guiado
│   ├── src/components/painel/ Painel inicial
│   └── scripts/validar.ts     Revalidação dos números contra a norma
│
├── clima/               Ng (NBR 5419-2) e isopletas — origem dos dados da web
├── validador.py         Motor de cálculo em Python — REFERÊNCIA validada
├── menu.py              Interface de linha de comando (menu no terminal)
└── arquivo/             Código fora de uso, guardado para consulta
    ├── web-v1/          Calculadora por categorias + laudo avulso (v1)
    └── flask-legado/    Servidor Flask antigo (app.py, static/, templates/)
```

O `validador.py` (Python) permanece como **referência validada** das fórmulas.
O motor TypeScript (`web/src/lib/validador.ts`) é um porte fiel dele e foi
revalidado contra os exemplos da norma (`web/scripts/validar.ts`).

### Vento por coordenada (NBR 6123)

A velocidade do vento não é mais um preset regional (SP/RS): ela é derivada da
**coordenada (lat, lon)** do ponto da rede, seguindo o mesmo esquema do "Projeto
Validador de Projeto". O módulo `web/src/lib/vento.ts` porta para TypeScript os
módulos `isopletas_nbr6123.py`, `nbr6123.py` e `vento_nbr6123.py`:

1. **V0** (velocidade básica) é lido das isopletas da Figura 1 pela coordenada,
   via interpolação RBF *thin-plate-spline* dos pontos de controle;
2. aplicam-se os fatores **fixos** S1 = 1,00 · S2 = 0,79 · S3 = 0,85 →
   Vk = V0·S1·S2·S3;
3. **v = Vk · 3,6** (km/h) alimenta a ação do vento (Pvp = c · v²).

O port foi validado ao V0/v de referência do módulo Python (`scripts/validar.ts`).

## Aplicação web (recomendada)

Stack: **Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui**.
Componentes shadcn ficam em `web/src/components/ui` (caminho padrão do projeto).

```bash
cd web
npm install

# Desenvolvimento
npm run dev            # http://localhost:3000

# Produção (build + servir)
npm run build
npm run start          # http://localhost:3000
```

Revalidar os cálculos contra a norma:

```bash
cd web
npx tsx scripts/validar.ts
```

### Deploy (hosting para outros usuários)

Por ser um app Next.js sem backend próprio (os cálculos rodam no cliente em
TypeScript), o deploy é direto na **Vercel** (ou Netlify):

1. Suba o repositório no GitHub.
2. Na Vercel, importe o repositório e defina **Root Directory = `web`**.
3. Framework detectado automaticamente (Next.js). Deploy.

## Interface de terminal (Python)

Alternativa em linha de comando, útil para conferência rápida:

```bash
python menu.py
```

## Aviso

Ferramenta de apoio. Os resultados devem sempre ser conferidos com a norma
GED-3648 vigente e sob a responsabilidade técnica do projetista.
