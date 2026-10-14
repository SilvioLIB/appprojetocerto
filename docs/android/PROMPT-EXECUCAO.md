# Prompt de execução — Projeto Certo para Android (APK)

Copie o bloco abaixo inteiro numa nova conversa do Claude Code aberta na pasta `Novo validador`.
Ajuste a seção **Decisões** se quiser algo diferente do padrão.

---

```text
Execute a portabilidade do Projeto Certo (web/, Next.js 16) para Android (celular e tablet),
gerando um APK instalável. O plano completo está em docs/android/PLANO.md — leia-o inteiro
antes de começar e siga as fases na ordem. Leia também web/AGENTS.md: este Next 16 tem
mudanças incompatíveis; consulte node_modules/next/dist/docs/ (static export, output: "export",
pageExtensions, metadata routes) antes de escrever qualquer configuração.

## Decisões (já tomadas)
- Tecnologia: Capacitor (versão estável atual) + Next com output: "export". Nada de TWA,
  server.url remoto ou reescrita nativa.
- appId: br.com.projetocerto.app · appName: "Projeto Certo" · minSdk 26 · targetSdk = o exigido
  hoje pela Play Store.
- O APK NÃO tem login: o portão (proxy.ts, actions/auth.ts, /login, user-menu, cookies) fica
  só no build web. No app, usuário local fixo.
- Distribuição inicial por sideload (APK assinado). Preparar também o .aab, sem publicar.
- O build web atual deve continuar idêntico (com login, redirects, headers). O Android é um
  segundo alvo ativado por NEXT_PUBLIC_PLATAFORMA=android. Sem fork de código.

## Regras invioláveis
1. NÃO alterar fórmulas, catálogos, tabelas ou IDs de campos: validador.ts, dimensionamento.ts,
   vento.ts, tracao-tabelada.ts, ng.ts, distancia.ts (lógica), projeto-v2-store.ts (formato
   persistido — o nome "projeto-v2-ged3648" e o shape do estado ficam iguais, para backups
   .json de um alvo abrirem no outro).
2. `npx tsx scripts/validar.ts` deve passar antes e depois de cada fase.
3. Componentes não chamam window.print, navigator.geolocation, URL.createObjectURL nem
   <a download> diretamente: tudo passa por src/lib/nativo/* (com implementação web e app).
4. Mudanças visuais para toque ficam sob @media (pointer: coarse) ou sob a classe/plataforma
   do app — o desktop não pode mudar de aparência.
5. Segredos fora do repositório: keystore .jks e android/keystore.properties no .gitignore.
   Nunca embutir APP_USERS, SESSION_SECRET ou qualquer senha no bundle do app — confira
   com grep em out/ ao final.

## Fase 0 — Ambiente
- Verifique: node, java -version (precisa JDK 21; hoje a máquina tem 1.8), ANDROID_HOME,
  adb, sdkmanager. Se faltar Android Studio/SDK/JDK, PARE e me passe o passo a passo exato
  de instalação no Windows (não baixe instaladores por conta própria). Retome quando eu
  confirmar.
- Se o Gradle falhar por causa do espaço no caminho "Novo validador", me avise e proponha
  mover para C:\dev\projeto-certo.

## Fase 1 — Export estático
- next.config.ts condicional por NEXT_PUBLIC_PLATAFORMA (output "export", trailingSlash,
  images.unoptimized; sem redirects/headers/serverActions no alvo app).
- Remover do alvo app o que depende de servidor: getUsuarioAtual() no layout.tsx, proxy.ts,
  actions/auth.ts, /login, user-menu. Escolha o mecanismo que o Next 16 suporta de forma limpa
  (pageExtensions condicional é a 1ª opção; build em cópia temporária só se a 1ª não servir).
  Crie src/lib/plataforma.ts (EH_APP + Capacitor.isNativePlatform()).
- Critério de pronto: `out/` gerado sem erros, servido por um servidor estático local,
  navegando /, /projeto/, /ajuda/ e com um projeto calculado igual ao site.

## Fase 2 — Capacitor e ponte nativa
- Instalar core/cli/android e os plugins: geolocation, filesystem, share, app, keyboard,
  status-bar, splash-screen, network, preferences. capacitor.config.ts com webDir "out".
- src/lib/nativo/: localizacao.ts, arquivo.ts, imprimir.ts, rede.ts, voltar.ts.
- Trocar os pontos de chamada: memorial-v2.tsx (window.print), projeto-arquivo.ts
  (Blob/download → salvar em Documentos + Compartilhar), usar-localizacao.tsx (GPS).
- Plugin local Android "Imprimir": WebView.createPrintDocumentAdapter + PrintManager,
  reaproveitando o @media print de globals.css (PDF em tema claro).
- Espelhar o estado do zustand em Preferences (proteção contra limpeza do WebView), sem
  mudar o formato.
- Permissões no AndroidManifest: INTERNET, ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION.
- Requisições a Nominatim/OSRM/Open-Meteo/tiles OSM: garantir que funcionam a partir da
  origem do Capacitor (CORS) e que se identificam conforme as políticas do OSM (User-Agent/
  Referer do app); usar CapacitorHttp se necessário.

## Fase 3 — Visual celular e tablet
Use a skill frontend-design. Faixas: <600dp (celular retrato), 600–839 (tablet retrato /
celular paisagem, md:), ≥840 (tablet paisagem, lg: mestre-detalhe que já existe).
- Alvos de toque ≥ 44–48px sob pointer: coarse (button.tsx, input.tsx, select.tsx, chips,
  itens da linha do projeto). Nada que só apareça em hover.
- inputMode="decimal" e enterKeyHint em todos os campos numéricos; teclado não cobre a barra
  fixa da abertura (@capacitor/keyboard).
- Botão voltar do Android: fecha diálogo → etapa anterior (memorial → postes → abertura) →
  confirma antes de sair.
- Edge-to-edge/safe areas no cabeçalho, NavegacaoInferior e memorial (testar se env() vem 0
  no WebView e usar as variáveis do Capacitor se vier).
- Status bar e splash seguindo o tema; ícone adaptativo (com monocromático) gerado de
  src/app/icon.svg via @capacitor/assets.
- Planta da rede com rolagem/zoom no celular; mapa proporcional no tablet.
- Aviso de offline (rede.ts) dizendo o que fica indisponível; cálculo segue normal.
- Se a cota do 21st estiver disponível, aplicar o pendente (Gauge em poste-atual.tsx,
  Stepper em projeto-v2.tsx, Icon Card Radio no seletor de estrutura) já pensado para toque,
  animações só em CSS. Só apresentação.
- Reduzir backdrop-blur/animações em aparelhos fracos se a fluidez cair.

## Fase 4 — APK
- Scripts no web/package.json: android:build, android:abrir, android:apk-debug,
  android:apk (assembleRelease assinado), android:aab.
- versionName/versionCode derivados de SITE.versao.
- Keystore: me peça para criar (eu digito as senhas no terminal; você não as vê nem as
  escreve em chat). Gere signingConfig lendo android/keystore.properties.
- Entregue o caminho do app-release.apk e o tamanho.

## Fase 5 — Validação (verifique e mostre prova, não me peça para testar)
- Emuladores: celular atual, Pixel Tablet (retrato e paisagem), celular API 26.
  Instale o APK com adb e teste: abrir projeto, calcular postes, girar a tela, teclado,
  GPS permitir/negar, modo avião, voltar do Android, backup salvar/compartilhar/importar,
  PDF do memorial (20 postes), tema claro/escuro, fechar e reabrir.
- Mesmo backup .json no site e no APK → memorial com números idênticos.
- Screenshots de celular e tablet como prova. grep em out/ e no APK por SESSION_SECRET,
  APP_USERS, senhaHash → zero ocorrências.
- `npm run build` (alvo web) continua funcionando com login.

## Ao final
- Atualize README.md (seção Android: requisitos, comandos, assinatura, distribuição) e
  docs/android/PLANO.md com o que mudou na execução.
- Salve na memória: decisão de alvo Android via Capacitor, onde fica a keystore (só o local,
  nunca a senha) e a fachada src/lib/nativo/.
- Liste as limitações que se confirmaram nos testes (seção 5 do plano) e qualquer nova.
```
