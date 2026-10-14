# Prompt de continuação — Projeto Certo → Android (APK)

> Cole o bloco abaixo numa sessão nova. Estado em **2026-10-05**: as Fases 1 a 3 estão prontas no código.
> **Nada foi compilado ainda**, porque o Android Studio não está instalado.

---

Continue a portabilidade do Projeto Certo (`web/`, Next.js 16.3 + Capacitor 8.5) para Android
(celular e tablet), com o objetivo de gerar um APK instalável. Antes de qualquer coisa, leia:
- `docs/android/PLANO.md`: o plano e, na **seção 7**, o registro detalhado de cada fase executada.
- `docs/android/PROMPT-EXECUCAO.md`: decisões, regras invioláveis e as fases 0 a 5.
- `web/AGENTS.md`: este Next 16 tem mudanças incompatíveis. Consulte `node_modules/next/dist/docs/` antes de mexer em configuração.

## Situação das fases

| Fase | Estado |
|---|---|
| 0 — Ambiente | **BLOQUEADA**: Android Studio/SDK/JDK 21 não instalados |
| 1 — Export estático | Concluída e verificada |
| 2 — Capacitor + ponte nativa | Código pronto; **falta compilar e testar no emulador** |
| 3 — Visual celular/tablet | Código pronto e testado no navegador (toque emulado); **falta validar no emulador** |
| 4 — APK assinado / AAB | Não iniciada (só existe o `android:build`) |
| 5 — Validação em emuladores | Não iniciada |

## Primeira ação: conferir a Fase 0
Na última conferência havia Node 24.18, npm 11.16 e Java **1.8**. Não havia Android Studio (`studio64.exe` não existe no C:), SDK, `adb`, `ANDROID_HOME` nem `JAVA_HOME`. Os arquivos `Não confirmado …crdownload` em Downloads **não são o Android Studio**: são o *SEL QuickSet Installer 7.7* (conferido pela assinatura digital).

Verifique:
- O JBR em `C:\Program Files\Android\Android Studio\jbr`; use esse `java -version`. O Java 1.8 do PATH não serve.
- O SDK em `%LOCALAPPDATA%\Android\Sdk`: platforms 36/35/26, build-tools, platform-tools, cmdline-tools e emulator.
- As variáveis de usuário `ANDROID_HOME` e `JAVA_HOME`. Leia pelo registro (`[Environment]::GetEnvironmentVariable(…, "User")`), porque o processo atual pode não tê-las.
- Os AVDs em `%USERPROFILE%\.android\avd`: Pixel 8 (API 36), Pixel Tablet (API 36) e um celular API 26.

Se faltar algo, PARE e passe ao usuário o passo a passo de instalação. Não baixe nem execute instaladores. Se o usuário apontar um instalador, você pode conferir a assinatura (`Get-AuthenticodeSignature` numa cópia) antes de ele executar.

Se o Gradle falhar por causa do espaço no caminho `Novo validador`, proponha mover o projeto para `C:\dev\projeto-certo`.

## O que existe hoje

### Dois alvos do mesmo código
- **`next.config.ts`** exporta `configWeb` (login, proxy, redirects, headers) ou `configApp` (`output: "export"`, `trailingSlash`, `images.unoptimized`, `tsconfig.app.json`), conforme `NEXT_PUBLIC_PLATAFORMA=android`.
- **`pageExtensions` condicional**: arquivos `*.web.tsx` só entram no site e `*.app.tsx` só no app.
  - `app/layout.web.tsx`: lê a sessão do cookie e passa o `UserMenu` pelo slot `menuUsuario`.
  - `app/layout.app.tsx`: usa `USUARIO_LOCAL`, `<PonteNativa />` e o slot `aviso={<AvisoOffline />}`.
  - O miolo comum (fontes, metadata, viewport, casca HTML, toaster) está em `components/raiz-html.tsx`.
  - `app/login/page.web.tsx` só existe no site.
- **`src/lib/plataforma.ts`**: `EH_APP`, `ehNativo()` e `USUARIO_LOCAL`.
- **Comandos**:
  - `npm run build:app`: gera `out/`.
  - `npm run android:build`: `build:app` + `cap sync android`.
  - `node scripts/servir-out.mjs`: serve `out/` em :4173; está no `.claude/launch.json` como `app-estatico`.
  - `npm run build`: o site, que continua igual (rotas ƒ, `/login`, Proxy).

### Armadilhas já resolvidas (NÃO reverter)
- **`src/proxy.ts` fica com o nome puro.** O Turbopack identifica o proxy pelo nome exato; com `proxy.web.ts`, ele vira middleware legado e quebra o build web. No app, o export já desliga o proxy (só gera um aviso).
- **O login tipa o `searchParams` à mão.** O gerador de rotas tipadas ignora páginas com extensão composta, então não use `PageProps<"/login">`.
- **`robots.ts` e `manifest.ts` têm `dynamic = "force-static"`**, exigido pelo export.
- **Bug do Next 16 no Windows**: o export grava os arquivos de prefetch de segmento como pasta, o que gera 404. O `scripts/build-app.mjs` achata esses arquivos depois do build.

### Ponte nativa — `web/src/lib/nativo/` (os componentes só falam com isto)
- **`localizacao.ts`**: `obterPosicao()` e `ErroLocalizacao`, com a mensagem já adequada ao alvo.
- **`arquivo.ts`**: `salvarArquivo()`. No site é Blob + download; no APK grava em Documentos/Projeto Certo, abre o Compartilhar e cai para o cache se der erro.
- **`imprimir.ts`**: no APK chama o plugin local `ImprimirPlugin.java` (PrintManager, A4, `@media print` em tema claro).
- **`rede.ts`**: `estaOnline()` e `observarRede()`. São usados pelo `components/aviso-offline.tsx`.
- **`voltar.ts`**: a cadeia do voltar.
  1. Seletor ou diálogo aberto fecha (Escape).
  2. Pilha de `registrarVoltar`: memorial → postes (`reabrir`, em `projeto-v2.tsx`); estrutura escolhida → escolha da estrutura (em `poste-atual.tsx`).
  3. Volta no histórico.
  4. Na tela inicial, `confirm` + `App.exitApp()`.

  Depois de iniciado o projeto, a abertura não é reaberta (as amarras ficam travadas). Existe um gancho de teste, `window.__testeVoltar()`, só no build app fora do Capacitor.
- **`espelho.ts`**: copia a string persistida do zustand para Preferences, com a mesma chave `projeto-v2-ged3648` e o mesmo formato, e restaura se o localStorage sumir.
- **`barras.ts`**: `SystemBars.setStyle` (core) + `StatusBar.setBackgroundColor` (Android antigo), seguindo o tema.
- **`components/ponte-nativa.tsx`**: liga o voltar, o espelho e as barras.
- **Pontos de chamada trocados**:
  - `memorial-v2.tsx` → `imprimir()`.
  - `projeto-arquivo.ts` → `salvarArquivo()`, agora assíncrono, com toast de erro no painel.
  - `usar-localizacao.tsx` → `obterPosicao()`.
- **Rede**: Nominatim, OSRM, Open-Meteo e os tiles OSM respondem CORS `*` para `https://localhost`. Por isso fica o `fetch` comum (com `AbortSignal`) e **não** se usa o CapacitorHttp. A identificação do OSM vai no `appendUserAgent` do `capacitor.config.ts`. `distancia.ts`, `ng.ts` e `temperatura.ts` não foram alterados.

### Projeto Android — `web/android/`
- **`capacitor.config.ts`**:
  - appId `br.com.projetocerto.app`, `webDir: "out"`.
  - `appendUserAgent: "ProjetoCerto/<SITE.versao> (Android; br.com.projetocerto.app)"`.
  - `Keyboard.resize = Body` e `SystemBars.insetsHandling = "css"`.
- **SDK**: minSdk 26, target/compile 36.
- **Manifest**: INTERNET, ACCESS_NETWORK_STATE, FINE/COARSE_LOCATION, `uses-feature gps required=false`, READ/WRITE_EXTERNAL_STORAGE com `maxSdkVersion=29` e `requestLegacyExternalStorage`.
- **`MainActivity`** registra o `ImprimirPlugin` antes do `super.onCreate`.
- **Ícone e splash**: *vector drawables* feitos a partir dos paths do `src/app/icon.svg`. Não foi usado o `@capacitor/assets`, porque gera PNGs e não gera a camada monocromática.
  - `ic_launcher_foreground` (glifo 2× na zona segura), `ic_launcher_monochrome` (Android 13+) e fundo `#B4642A`, só em `mipmap-anydpi-v26`. Os PNGs do template foram removidos.
  - Splash pela API do Android 12 (androidx): fundo `@color/splash_fundo` (`#FAFBFC`; em `values-night`, `#1C2029`) e `@drawable/splash_icone`.
- **`.gitignore`** (em `web/` e em `android/`): bloqueia `*.jks`, `*.keystore` e `keystore.properties`.

### Visual de toque (Fase 3) — tudo sob `@media (pointer: coarse)` ou só no app
- **`globals.css`**:
  - `min-height: 44px` em `[data-slot=button|input|select-trigger|select-item]`; botão só de ícone (com `aria-label`) também com `min-width` 44.
  - `.alvo-toque` amplia a área de toque por fora, sem mudar o desenho.
  - Variáveis `--sa-top/right/bottom/left` = `max(env(safe-area-inset-*), var(--safe-area-inset-*))`, aplicadas no cabeçalho, na barra inferior, na barra fixa da abertura, no padding lateral do body e no toaster.
- **`ui/input.tsx`**: `enterKeyHint="next"` por padrão em campos decimal/numeric. Em toque, "Próximo" foca o campo seguinte ou fecha o teclado.
- **`v2/campos.tsx` → `CampoCoordenada`**: botão ± (44 px, só em toque), porque o teclado decimal do Android não tem "−". Está nos 6 campos de lat/lon da abertura e da estimativa.
- **Hover-only corrigido**: a lixeira da linha lateral fica visível em toque.
- **Planta da rede**: em toque com tela < md, o SVG mantém 600 px e rola na horizontal.
- **Mapa**: altura medida do contêiner; `clamp(340px, 42svh, 560px)` no tablet em toque, 340 px no resto.
- **Verificado no navegador** (375×812, toque emulado, safe areas simuladas): tudo acima funciona e o desktop ficou idêntico (botões 32 px, lixeira só no hover).

## Próximos passos
1. **Fase 0**: conferir o ambiente (acima) e os emuladores.
2. **Compilar**:
   - Rodar `npm run android:build` e depois `android\gradlew.bat assembleDebug`. Corrigir o que o Java, o Gradle ou o AAPT acusarem: `ImprimirPlugin.java`, os vector drawables e `styles.xml` (`postSplashScreenTheme`) nunca foram compilados.
3. **Testar no emulador** (Fases 2 e 3), com screenshots como prova:
   - PDF do memorial com 20 postes.
   - GPS: permitir, negar e localização desligada.
   - Backup: Documentos + Compartilhar, e importar.
   - Espelho em Preferences: limpar o storage do WebView e reabrir.
   - Botão voltar físico e gesto.
   - Safe areas reais: conferir se o `env()` vem 0 no WebView antigo, e então as `--safe-area-inset-*`.
   - Teclado sobre a barra fixa da abertura.
   - Ícone, ícone temático, splash e barras do sistema nos temas claro e escuro.
   - Girar a tela; modo avião (o `AvisoOffline` deve aparecer).
4. **Pendências da Fase 3**:
   - Visual do 21st (Gauge em `poste-atual.tsx`, Stepper em `projeto-v2.tsx`, Icon Card Radio no seletor de estrutura): só se `get_usage` mostrar cota. Em 2026-10-05 estava 0/2.
   - Reduzir `backdrop-blur`/animações só se a fluidez cair num aparelho fraco.
5. **Fase 4**:
   - Scripts `android:abrir`, `android:apk-debug`, `android:apk` (assembleRelease assinado) e `android:aab`.
   - versionName/versionCode derivados de `SITE.versao` (hoje "2.0").
   - Keystore criada pelo usuário no terminal (você nunca vê nem escreve as senhas); `signingConfig` lendo `android/keystore.properties`.
   - Entregar o caminho e o tamanho do `app-release.apk`.
6. **Fase 5**:
   - Matriz Pixel 8, Pixel Tablet (retrato e paisagem) e API 26.
   - O mesmo backup `.json` no site e no APK deve dar o memorial com os mesmos números.
   - grep por `SESSION_SECRET`, `APP_USERS` e `senhaHash` (e pelos valores do `.env.local`, sem imprimi-los) em `out/` e no APK: zero ocorrências.
   - `npm run build` (web) com login funcionando.
   - Atualizar o README (seção Android), o PLANO (seção 7) e a memória; listar as limitações confirmadas.

## Regras que continuam valendo
- NÃO alterar fórmulas, catálogos, tabelas ou IDs de campos (`validador.ts`, `dimensionamento.ts`, `vento.ts`, `tracao-tabelada.ts`, `ng.ts`, `distancia.ts`), nem o formato persistido em `projeto-v2-store.ts` (nome `projeto-v2-ged3648` e shape do estado).
- `npx tsx scripts/validar.ts` deve passar antes e depois de cada fase.
- `npm run build` (web, com login, redirects e headers) deve continuar idêntico.
- Componentes não chamam `window.print`, `navigator.geolocation`, `URL.createObjectURL` nem `<a download>`: tudo passa por `src/lib/nativo/*`.
- Mudanças visuais para toque ficam sob `pointer: coarse` ou atrás do alvo app; o desktop não muda de aparência.
- Nenhum segredo (`APP_USERS`, `SESSION_SECRET`, senhas) no bundle do app; keystore e `keystore.properties` fora do repositório.
