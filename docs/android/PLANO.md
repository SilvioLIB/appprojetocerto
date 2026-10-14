# Projeto Certo → Android (celular e tablet) — Plano de portabilidade

> Estudo feito em 2026-10-04 sobre o código em `web/` (Next.js 16.3 · React 19 · Tailwind v4 · shadcn · zustand).
> Objetivo final: **arquivo `.apk` instalável** em celulares e tablets Android, com a mesma interface e os mesmos números do site.

---

## 1. Diagnóstico do sistema atual

| Aspecto | Situação hoje | Impacto no Android |
|---|---|---|
| Motor de cálculo (`validador.ts`, `dimensionamento.ts`, `vento.ts`, `tracao-tabelada.ts`) | TypeScript puro, roda no cliente | ✅ Porta sem mudança — funciona offline |
| Estado do projeto | zustand + `localStorage` (`projeto-v2-ged3648`) | ✅ Funciona no WebView; ⚠️ some se o app for desinstalado ou "Limpar dados" |
| Portão de login | Server Action + cookie httpOnly + `proxy.ts` + `getUsuarioAtual()` no `layout.tsx` | ❌ **Não existe servidor dentro do APK** — tem de ser removido/trocado no build Android |
| `next.config.ts` (redirects, headers) | Recursos de servidor | ⚠️ Ignorados no export estático (sem prejuízo) |
| Fontes (`next/font/google`) | Baixadas no build e servidas localmente | ✅ Funciona offline |
| Tabela Ng (`public/clima/ng-municipios.json`) | Arquivo estático | ✅ Vai embutido no APK |
| Rota OSRM, Nominatim, Open-Meteo, tiles OSM | `fetch` para internet | ⚠️ Só com internet; políticas de uso do OSM/Nominatim exigem identificação |
| Geolocalização (`usar-localizacao.tsx`) | `navigator.geolocation` | ⚠️ Precisa permissão nativa (`ACCESS_FINE_LOCATION`) → plugin Capacitor |
| Memorial → PDF (`window.print()`) | Diálogo de impressão do navegador | ❌ **`window.print()` não faz nada no WebView Android** → precisa ponte nativa |
| Backup do projeto (`Blob` + `<a download>`) | Download do navegador | ❌ Não baixa no WebView → Filesystem + Share nativos |
| Importar backup (`<input type="file">`) | Seletor do navegador | ✅ Capacitor já trata o seletor de arquivos |
| Responsividade | Já mobile-first: barra inferior (`NavegacaoInferior`), `safe-area`, `md:`/`lg:` | ✅ Boa base; falta densidade de toque, teclado, botão "voltar", tablet |
| Botões/inputs | `h-7`/`h-8` (28–32 px) | ⚠️ Abaixo dos 48 dp recomendados para toque |

**Conclusão:** o app é quase todo "cliente". Os únicos pedaços que dependem de servidor são o **login** e o **proxy**. Isso torna viável empacotar o site inteiro **dentro** do APK, funcionando offline.

---

## 2. Caminho escolhido (e por quê)

| Opção | Como funciona | Veredito |
|---|---|---|
| **Capacitor + `output: "export"`** | O Next gera HTML/JS/CSS estáticos; o Capacitor embala num projeto Android nativo com WebView e plugins | ✅ **Recomendado.** Reaproveita 100% da UI e do motor; offline; acesso nativo (GPS, arquivos, impressão); gera APK/AAB via Gradle |
| TWA (Bubblewrap / PWABuilder) | APK que só abre o site hospedado em Chrome em tela cheia | ❌ Exige internet sempre, domínio HTTPS próprio + `assetlinks.json`; sem acesso nativo; mantém o login, mas não funciona em campo sem sinal |
| Capacitor com `server.url` remoto | APK abre o site da Vercel dentro do WebView | ❌ Mesmo problema de internet; Google desencoraja para loja |
| Reescrever em React Native / Flutter / Kotlin | App nativo do zero | ❌ Reescrita de ~10 mil linhas de UI, risco de divergir dos números validados |

**Princípio:** o site web continua exatamente como está (com login). O Android é um **segundo alvo de build** do mesmo código, ativado por variável de ambiente (`NEXT_PUBLIC_PLATAFORMA=android`). Nada de fork.

---

## 3. Arquitetura alvo

```
web/
├── src/lib/plataforma.ts          ← EH_APP (build Android?) + detecção Capacitor.isNativePlatform()
├── src/lib/nativo/                ← fachada única para tudo que muda entre web e APK
│   ├── localizacao.ts             (web: navigator.geolocation | app: @capacitor/geolocation)
│   ├── arquivo.ts                 (web: Blob+download | app: Filesystem + Share)
│   ├── imprimir.ts                (web: window.print | app: plugin nativo PrintManager → "Salvar como PDF")
│   ├── rede.ts                    (status online/offline; CapacitorHttp p/ User-Agent nas APIs OSM)
│   └── voltar.ts                  (botão "voltar" do Android → etapa anterior do projeto)
├── capacitor.config.ts            ← appId: br.com.projetocerto.app, webDir: "out"
├── android/                       ← projeto Gradle gerado pelo Capacitor (versionado)
│   └── app/src/main/java/.../ImprimirPlugin.java  ← plugin local de impressão
└── scripts/build-android.mjs      ← next build (export) → cap sync → gradlew assemble
```

Os componentes **nunca** chamam `window.print`, `navigator.geolocation` ou `URL.createObjectURL` diretamente — só a fachada `nativo/`. Assim web e APK seguem o mesmo componente.

---

## 4. Fases de execução

### Fase 0 — Ambiente (no Windows)
- Instalar **Android Studio** (traz JDK 21 embutido + SDK Manager). O Java instalado hoje é **1.8 — insuficiente** (Gradle/AGP atuais exigem JDK 17+, Capacitor 7+ exige 21).
- SDK Platform da API alvo (35/36), Build-Tools, Platform-Tools (adb), Command-line Tools.
- Variáveis: `ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk`, `JAVA_HOME` → JBR do Android Studio.
- Emuladores: **Pixel 8 (celular)**, **Pixel Tablet (tablet 10")**, e um **celular API 26–28** para testar WebView antigo.
- Um aparelho real com "Depuração USB" ligada (recomendado).

### Fase 1 — Build estático sem servidor
1. Ler `node_modules/next/dist/docs/` sobre **static export** (Next 16 tem mudanças — ver `web/AGENTS.md`).
2. `next.config.ts` condicional: quando `NEXT_PUBLIC_PLATAFORMA=android` → `output: "export"`, `trailingSlash: true`, `images.unoptimized: true`, sem `redirects/headers/serverActions`.
3. Desligar o portão no alvo Android:
   - `layout.tsx` não pode chamar `getUsuarioAtual()` (usa `cookies()`); usuário vira um "usuário local" fixo no app.
   - `proxy.ts`, `actions/auth.ts`, `/login`, `user-menu` fora do build Android (via `pageExtensions` condicional ou build em cópia temporária — escolher o que o Next 16 aceitar sem gambiarra).
4. `manifest.ts`, `robots.ts`, `icon.svg` com `dynamic = "force-static"` se o export exigir.
5. Critério: `out/` gerado, abre com um servidor estático qualquer, navega `/`, `/projeto/`, `/ajuda/` e calcula igual ao site.

### Fase 2 — Capacitor + ponte nativa
1. `@capacitor/core`, `@capacitor/cli`, `@capacitor/android` → `npx cap init` / `npx cap add android`.
2. Plugins: `@capacitor/geolocation`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor/app`, `@capacitor/keyboard`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/network`, `@capacitor/preferences`.
3. Criar a fachada `src/lib/nativo/*` e trocar os 3 pontos de chamada:
   - `memorial-v2.tsx:535` `window.print()` → `imprimir()`
   - `projeto-arquivo.ts:42` Blob/download → `salvarArquivo()` (grava em Documentos + abre "Compartilhar": WhatsApp, Drive, e-mail)
   - `usar-localizacao.tsx:45-55` → `obterPosicao()`
4. **Plugin local de impressão** (Java/Kotlin, ~40 linhas): `webView.createPrintDocumentAdapter()` + `PrintManager.print()`. Reaproveita o `@media print` que já existe em `globals.css` e dá "Salvar como PDF" nativo. (Alternativa, se der problema: gerar PDF com jsPDF — pior fidelidade.)
5. Cópia de segurança automática do estado em `Preferences`/Filesystem, além do `localStorage` (proteção contra limpeza do WebView).
6. `AndroidManifest.xml`: `INTERNET`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`.

### Fase 3 — Adaptação visual (celular e tablet)
Faixas-alvo (dp de largura):

| Faixa | Aparelho | Layout |
|---|---|---|
| < 600 | celular retrato | 1 coluna, barra inferior, `linha-projeto-compacta`, botões grandes |
| 600–839 | celular paisagem / tablet retrato (`md:`) | 1 coluna larga, grids de 2–3 colunas nos campos, planta maior |
| ≥ 840 | tablet paisagem (`lg:`) | mestre-detalhe: linha do projeto à esquerda (230 px) + poste atual à direita (já existe) |

Itens:
- **Densidade de toque** sob `@media (pointer: coarse)`: botões/inputs/selects com mínimo **44–48 px**; chips e itens de lista com área de toque ampliada. Não muda o desktop.
- **Teclado**: `inputMode="decimal"` em todos os campos numéricos (vírgula decimal pt-BR), `enterKeyHint="next"`; `@capacitor/keyboard` com `resize: "body"` para a barra fixa (`sticky bottom`) não ficar atrás do teclado.
- **Botão voltar do Android**: fechar diálogo → voltar etapa (memorial → postes → abertura) → só então sair (com confirmação).
- **Safe areas / edge-to-edge** (obrigatório no Android 15+): conferir `env(safe-area-inset-*)` no WebView; se vier 0, usar as variáveis CSS injetadas pelo Capacitor (SystemBars) — cabeçalho, barra inferior e área do memorial.
- **Barra de status e splash** acompanhando o tema (escuro `#1c2029` / claro `#fafbfc`).
- **Ícone adaptativo** gerado a partir de `icon.svg` (`@capacitor/assets`): foreground + background + monocromático (Android 13).
- **Sem hover**: tudo que hoje depende de `hover:` para aparecer precisa de estado visível no toque.
- **Planta da rede e mapa**: pinça/zoom ou rolagem horizontal na planta em celular; mapa com altura proporcional à tela no tablet.
- **Offline**: aviso discreto ("sem internet — mapa, rota e clima indisponíveis; cálculo segue normal") usando `@capacitor/network`; os fallbacks que já existem (geodésica × 1,3) continuam valendo.
- **Orientação**: livre (retrato e paisagem) — tablet em paisagem é o caso principal de escritório.
- **Componentes do 21st pendentes** (Gauge, Stepper, Icon Card Radio — ver memória) podem entrar nesta fase, já pensados para toque.

### Fase 4 — Gerar o APK
- Scripts no `package.json`:
  - `android:build` → build estático Android + `npx cap sync android`
  - `android:abrir` → `npx cap open android`
  - `android:apk-debug` → `android/gradlew assembleDebug`
  - `android:apk` → `android/gradlew assembleRelease` (assinado)
  - `android:aab` → `android/gradlew bundleRelease` (para Play Store)
- **Assinatura**: keystore `.jks` criado uma única vez, guardado **fora do repositório** (e com backup!), senhas em `android/keystore.properties` (no `.gitignore`). Perder a keystore = não conseguir mais atualizar o app instalado.
- `versionCode`/`versionName` derivados de `SITE.versao`.
- Saída: `android/app/build/outputs/apk/release/app-release.apk`.

### Fase 5 — Validação
- `npx tsx scripts/validar.ts` continua passando (motor intocado).
- Mesmo projeto de teste (importado por `.json`) no site e no APK → memorial com **números idênticos**.
- Matriz: Pixel 8 (API 35), Pixel Tablet (paisagem e retrato), celular API 26–28, aparelho real.
- Checklist: GPS (permitir/negar), sem internet, girar a tela no meio do poste, teclado sobre a barra fixa, voltar do Android, salvar/compartilhar backup, importar backup, PDF do memorial, tema claro/escuro, fechar e reabrir (estado preservado).
- Depuração: `chrome://inspect` no PC com o aparelho conectado.

### Fase 6 — Distribuição e atualização
- **Sideload (APK direto)**: enviar o `.apk` por WhatsApp/Drive; o usuário habilita "instalar apps desconhecidos". Atualizar = instalar APK novo com a **mesma assinatura** e `versionCode` maior.
- **Play Store** (opcional, depois): conta de desenvolvedor (taxa única US$ 25), `.aab`, política de privacidade (o app usa localização), formulário "Segurança dos dados"; contas pessoais novas exigem teste fechado com testadores antes de publicar.

---

## 5. Limitações e riscos da migração

### Bloqueantes já resolvidos no plano
1. **Sem servidor no APK** → login/cookie/proxy não funcionam; o alvo Android sai sem portão.
2. **`window.print()` inerte no WebView** → plugin nativo de impressão.
3. **Download via `<a download>` inerte** → Filesystem + Share.

### Limitações que permanecem
4. **Controle de acesso**: qualquer senha ou allowlist embutida no APK pode ser extraída (APK é descompilável). No app, "quem tem o APK, usa". Se precisar restringir de verdade → login online contra um servidor (exige internet na 1ª abertura) ou licença por aparelho. Não dá para "esconder" segredo dentro do APK.
5. **Código-fonte exposto**: todo o motor de cálculo (fórmulas, catálogos, tabelas) vai legível dentro do APK. Minificação dificulta, não impede.
6. **Recursos online continuam online**: mapa (tiles OSM), rota (OSRM), cidades do corredor (Nominatim) e temperatura (Open-Meteo). Em campo sem sinal só o cálculo, a planta e a tabela Ng por município funcionam.
7. **Políticas de uso do OpenStreetMap**: o servidor público de tiles e o Nominatim **não são para uso pesado de apps** (Nominatim: máx. 1 req/s, exige identificação). Uso leve de poucos projetistas é tolerado; se o app crescer, migrar para provedor com chave (MapTiler, Stadia, LocationIQ) ou servidor próprio. O OSRM demo também não tem garantia de disponibilidade.
8. **Versão do WebView**: Tailwind v4 usa CSS moderno (`oklch`, `@property`, `color-mix`) que exige **Chrome/WebView ≥ 111**. O WebView se atualiza pela Play Store, mas aparelhos sem Google (Huawei recentes, alguns tablets genéricos baratos) ou muito antigos (Android ≤ 7) podem mostrar cores/layout quebrados. Definir `minSdk 26` e testar em emulador antigo.
9. **Dados só no aparelho**: sem sincronização entre celular, tablet e site. Desinstalar/"limpar dados" apaga projetos — por isso o backup `.json` compartilhável e o espelho em `Preferences`. Sincronizar exigiria backend (cenário B da memória: Postgres + login).
10. **Atualização manual**: sem Play Store, cada versão nova é reenvio de APK. "Atualização ao vivo" (Capgo / servidor próprio) é possível depois, mas adiciona infraestrutura.
11. **Avisos de instalação**: APK fora da loja dispara alerta do Play Protect / "fonte desconhecida"; alguns aparelhos corporativos (MDM) bloqueiam sideload.
12. **Desempenho em aparelho fraco**: `poste-atual.tsx` (2 083 linhas) + planta SVG + `backdrop-blur` podem engasgar em celulares de entrada. Medir e, se preciso, reduzir blur/animações sob `pointer: coarse`.
13. **PDF do memorial**: depende do PrintManager do Android; a paginação pode diferir levemente da do Chrome desktop (quebras de página, margens). Validar com memorial longo (20 postes).
14. **Somente Android**: iOS exigiria Mac + Xcode + conta Apple (US$ 99/ano); o Capacitor permite adicionar depois sem reescrever.
15. **Dois alvos para manter**: toda feature nova deve passar pela fachada `nativo/` e ser testada nos dois builds.
16. **Caminho com espaço** (`Novo validador`): Gradle às vezes falha com espaços/acentos no caminho no Windows. Se acontecer, mover o projeto para `C:\dev\projeto-certo`.

---

## 6. Decisões a confirmar antes de executar

| Pergunta | Padrão recomendado |
|---|---|
| O APK precisa de login? | **Não** (APK é distribuído só para quem deve usar) |
| Identificador do app (`appId`) | `br.com.projetocerto.app` (não muda nunca depois de publicado) |
| Distribuição | Sideload agora; Play Store depois |
| Versão mínima do Android | 8.0 (API 26) |
| Aplicar o visual do 21st junto? | Sim, na Fase 3 |

O prompt pronto para execução está em [`PROMPT-EXECUCAO.md`](PROMPT-EXECUCAO.md).

---

## 7. Registro de execução

### 2026-10-05 — Fase 0 (ambiente): **pendente do usuário**
- 2ª conferência: o instalador do Android Studio foi baixado pelo Chrome mas ficou como `Não confirmado …crdownload` (1,67 GB, em Downloads) — **não foi instalado**. Sem SDK/JBR/variáveis.
- Encontrado: Node 24.18, npm 11.16, Java **1.8** (insuficiente), sem `JAVA_HOME`, sem `ANDROID_HOME`, sem `adb`/`sdkmanager`, sem Android Studio.
- Fase 2 em diante aguardam a instalação do Android Studio (JDK 21 embutido) + SDK.

### 2026-10-05 — Fase 1 (export estático): **concluída**
- `next.config.ts` exporta `configWeb` ou `configApp` conforme `NEXT_PUBLIC_PLATAFORMA=android`. App: `output: "export"`, `trailingSlash`, `images.unoptimized`, `typescript.tsconfigPath: "tsconfig.app.json"` (exclui `*.web.*`), sem redirects/headers/serverActions.
- Mecanismo: `pageExtensions` condicional. Web = `web.tsx…` + padrão; app = `app.tsx…` + padrão.
  - `app/layout.web.tsx` (sessão via cookie + `UserMenu`) × `app/layout.app.tsx` (`USUARIO_LOCAL`). O miolo comum (fontes, metadata, viewport, casca HTML) está em `components/raiz-html.tsx`.
  - `app/login/page.web.tsx` (só no web). `SiteHeader` recebe o menu de conta por slot (`menuUsuario`) e não importa mais a Server Action.
- **Desvios do plano:**
  - `proxy.ts` **ficou com o nome puro**: o Turbopack identifica o proxy pelo nome exato do arquivo (`proxy.web.ts` é tratado como "middleware" legado e quebra o build web). No alvo app, o `output: "export"` já desliga o proxy sozinho (aviso no build) e nada dele vai para `out/`.
  - `PageProps<"/login">` virou um tipo explícito: o gerador de rotas tipadas não registra páginas com extensão composta.
  - `robots.ts` e `manifest.ts` ganharam `dynamic = "force-static"` (exigido pelo export; no web já eram estáticos).
  - **Bug do Next 16 no Windows**: os arquivos de prefetch de segmento saíam como pasta (`__next.projeto/__PAGE__.txt`) em vez de `__next.projeto.__PAGE__.txt`, gerando 404 no prefetch. `scripts/build-app.mjs` achata esses arquivos depois do build.
- Comandos: `npm run build:app` (gera `out/`) e `node scripts/servir-out.mjs` (servidor estático em :4173; também em `.claude/launch.json` como `app-estatico`).
- `src/lib/plataforma.ts`: `EH_APP`, `ehNativo()` (`Capacitor.isNativePlatform()`), `USUARIO_LOCAL`. Dependência `@capacitor/core` 8.5.2 instalada.
- Verificado: `out/` com 2,2 MB; `/`, `/projeto/` e `/ajuda/` navegam (SPA, prefetch 200); `/login/` dá 404 no app; projeto de 2 postes calculado no export com memória **idêntica bit a bit** à do motor (`dimensionarPoste`/`ventoNoPonto` via tsx); memorial abre após recarregar; zero ocorrências de `SESSION_SECRET`/`APP_USERS`/`senhaHash`/`bcrypt`/`jose` e dos valores do `.env.local` em `out/`; `npm run build` (web) gera as mesmas rotas de antes (ƒ dinâmicas, `/login`, Proxy); `validar.ts` passa antes e depois.

### 2026-10-05 — Fase 2 (Capacitor + ponte nativa): **parte JS/Android pronta; compilar e testar no aparelho aguardam a Fase 0**
- Capacitor 8.5.2 (`@capacitor/cli` dev) + plugins app, filesystem, geolocation, keyboard, network, preferences, share, splash-screen, status-bar (8.x).
- `capacitor.config.ts`: appId `br.com.projetocerto.app`, `webDir: "out"`, `appendUserAgent: "ProjetoCerto/<SITE.versao> (Android; br.com.projetocerto.app)"`, Keyboard `resize: body`, SystemBars `insetsHandling: "css"` (injeta `--safe-area-inset-*`, útil na Fase 3).
- **Rede**: Nominatim, OSRM, Open-Meteo e tiles OSM respondem `Access-Control-Allow-Origin: *` para a origem `https://localhost` (conferido com curl). Por isso o `fetch` atual foi mantido (com `AbortSignal`, que o CapacitorHttp não suporta); a identificação exigida pelo OSM vai no `appendUserAgent`, que vale para fetch e `<img>` dos tiles. `distancia.ts`, `ng.ts` e `temperatura.ts` ficaram intocados.
- Fachada `src/lib/nativo/`: `localizacao.ts` (`obterPosicao`, `ErroLocalizacao`), `arquivo.ts` (`salvarArquivo`: Blob no site; Documentos/Projeto Certo + Compartilhar no APK, com queda para o cache), `imprimir.ts` (plugin "Imprimir"), `rede.ts` (`estaOnline`, `observarRede`), `voltar.ts` (pilha `registrarVoltar` + `iniciarVoltar`; o encadeamento por etapa fica para a Fase 3), `espelho.ts` (copia a string persistida do zustand para Preferences com a mesma chave; restaura se o localStorage sumir). `components/ponte-nativa.tsx` liga voltar + espelho só em `layout.app.tsx`.
- Pontos trocados: `memorial-v2.tsx` → `imprimir()`, `projeto-arquivo.ts` → `salvarArquivo()` (agora assíncrono; o painel mostra erro em toast), `usar-localizacao.tsx` → `obterPosicao()`. Nenhum componente chama mais `window.print`, `navigator.geolocation`, `createObjectURL` ou `<a download>`.
- `android/` gerado: minSdk 26, target/compile 36 (padrão do template Capacitor 8). Manifest: INTERNET, ACCESS_NETWORK_STATE, ACCESS_FINE/COARSE_LOCATION, `uses-feature gps required=false`, READ/WRITE_EXTERNAL_STORAGE `maxSdkVersion=29` + `requestLegacyExternalStorage`. `ImprimirPlugin.java` (WebView.createPrintDocumentAdapter + PrintManager, A4) registrado no `MainActivity`. `.gitignore` (android/ e web/) barra `*.jks`, `*.keystore`, `keystore.properties`.
- Script: `npm run android:build` (build:app + `cap sync android`).
- Verificado (sem aparelho): os dois builds passam; `validar.ts` passa; no `out/` servido no navegador, o backup sai pela fachada com o mesmo formato/nome; GPS negar/permitir mostra a mensagem e preenche `-7,123457`; zero segredos em `out/` e `android/`.
- **Falta (precisa de JDK/SDK)**: compilar o Java (`gradlew assembleDebug`) e testar no emulador o plugin de impressão, a permissão de GPS, Documentos + Compartilhar, o espelho em Preferences e o botão voltar.

### 2026-10-05 — Fase 3 (visual celular e tablet): **feita no código; validação em aparelho aguarda a Fase 0**
- **Toque** (`globals.css`, bloco `@media (pointer: coarse)` fora das camadas do Tailwind): `min-height: 44px` em `[data-slot=button|input|select-trigger|select-item]`; botão só de ícone (com `aria-label`) também com `min-width` 44. A classe `.alvo-toque` amplia a área de toque por fora sem mudar o desenho (nós da linha compacta, lixeira). Nav do cabeçalho com `pointer-coarse:py-2.5`. No desktop nada muda (conferido: botões 32 px, lixeira só no hover).
- **Hover-only corrigido**: a lixeira da linha lateral (layout `lg`, que é o do tablet em paisagem) fica visível em toque.
- **Teclado**:
  - `Input` usa `enterKeyHint="next"` por padrão em `inputMode` decimal/numeric. Em toque, "Próximo" foca o campo seguinte; se o seguinte for um seletor ou não houver, fecha o teclado.
  - **Novo `CampoCoordenada`** (`campos.tsx`), porque o teclado decimal do Android não tem "−": o botão ± (44 px, só em toque) alterna o sinal. Está nos 6 campos de coordenada da abertura e da estimativa da linha. Na estimativa, em toque com tela < sm, lat e lon ficam um sob o outro.
- **Voltar do Android**: seletor/diálogo aberto fecha (Escape) → memorial volta aos postes (`reabrir`) → estrutura escolhida volta à escolha → histórico → na tela inicial, `confirm` + `App.exitApp()`. A abertura não é reaberta depois de iniciado o projeto (as amarras ficam travadas por design). Gancho `window.__testeVoltar` só no build app fora do Capacitor, para teste no navegador.
- **Safe areas**: as variáveis `--sa-top/right/bottom/left` = `max(env(), var(--safe-area-inset-*))` cobrem tanto o WebView novo (env) quanto o antigo (variáveis injetadas pelo Capacitor). Aplicadas no cabeçalho (padding-top), na barra inferior, na barra fixa da abertura, no padding lateral do body e no toaster (`mobileOffset`).
- **Barras do sistema**: `nativo/barras.ts` usa `SystemBars.setStyle` (core do Capacitor 8) + `StatusBar.setBackgroundColor` (para Android antigo), seguindo `resolvedTheme`, via `PonteNativa`.
- **Ícone e splash**: em vez do `@capacitor/assets` (PNG, sem camada monocromática), os paths do `icon.svg` viraram *vector drawables*:
  - `ic_launcher_foreground` (glifo 2× na zona segura), `ic_launcher_monochrome` (Android 13+) e fundo `@color/ic_launcher_background` `#B4642A`.
  - minSdk 26 ⇒ só o adaptativo `mipmap-anydpi-v26`; os PNGs e o splash do template foram removidos.
  - Splash pela API do Android 12 (androidx): `windowSplashScreenBackground` `@color/splash_fundo` (`#FAFBFC` / `values-night` `#1C2029`) e `windowSplashScreenAnimatedIcon` `@drawable/splash_icone` (ícone inteiro a 1,8×).
  - Prévia renderizada e conferida no navegador.
- **Planta da rede**: em toque com tela < md, o SVG mantém 600 px e rola na horizontal (`overscroll-x-contain`). **Mapa**: a altura vem do contêiner (`bounds.height`); 340 px por padrão e `clamp(340px, 42svh, 560px)` no tablet em toque.
- **Offline**: `AvisoOffline` (só no APK, slot `aviso` da `RaizHtml`, abaixo do cabeçalho) diz que mapa, rota, cidades e clima ficam indisponíveis e que o cálculo e o memorial seguem.
- **21st**: cota esgotada (0/2 retrievals no plano free) → Gauge/Stepper/Icon Card Radio não aplicados.
- **Blur/animações em aparelho fraco**: não alterado; precisa medir em aparelho (Fase 5).
- **Verificado no navegador** (375×812 com toque emulado e safe areas simuladas 32/24 px):
  - Alvos 44 px, sem rolagem horizontal na página.
  - Cadeia do voltar completa: memorial→postes, estrutura→escolha, seletor fecha sem perder o formulário, histórico.
  - "Próximo" avança de campo e fecha o teclado no último; ± alterna o sinal; a planta rola (600/343 px).
  - Desktop idêntico. Builds web e app ok, `validar.ts` ok, zero segredos.
