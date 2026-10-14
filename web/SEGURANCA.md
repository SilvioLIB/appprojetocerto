# Segurança e controle de acesso

Este app usa um **portão de acesso** (padrão "gate"): ninguém abre o validador sem
estar autenticado, e cada usuário tem um **papel**. Não há banco de dados — a lista
de usuários vive em uma variável de ambiente. É o cenário adequado para rodar em
localhost e subir para a nuvem por um tempo, com evolução para multiusuário depois.

## Como funciona (visão geral)

| Peça | Arquivo | Papel |
|------|---------|-------|
| Portão (barra quem vem de fora) | [`src/proxy.ts`](src/proxy.ts) | Roda antes de toda rota; sem sessão válida → `/login` |
| Sessão (JWT em cookie) | [`src/lib/auth/crypto.ts`](src/lib/auth/crypto.ts) | Assina/valida o cookie com `jose` (HS256), edge-safe |
| DAL de sessão | [`src/lib/auth/session.ts`](src/lib/auth/session.ts) | `getUsuarioAtual()`, `temPapel()`, criar/apagar sessão |
| Usuários (allowlist) | [`src/lib/auth/users.ts`](src/lib/auth/users.ts) | Verifica e-mail+senha contra `APP_USERS` |
| Login/logout | [`src/app/actions/auth.ts`](src/app/actions/auth.ts) | Server Actions |
| Tela de login | [`src/app/login/page.tsx`](src/app/login/page.tsx) | Formulário |

**Papéis:** `dono` (admin, gerencia tudo) › `editor` (usa o validador, salva laudos) › `leitor` (só visualiza).

## Configuração (primeira vez)

1. Copie o template de ambiente:

   ```bash
   cp .env.local.example .env.local
   ```

2. Gere um segredo de sessão e cole em `SESSION_SECRET`:

   ```bash
   npm run gerar-segredo
   ```

3. Crie cada usuário (a saída já vem no formato pronto de `APP_USERS`):

   ```bash
   npm run criar-usuario -- voce@dominio.com "SuaSenhaForte" dono
   ```

   Copie a linha `APP_USERS=[...]` da saída para o `.env.local`. Para vários
   usuários, junte as entradas no mesmo array: `APP_USERS=[{...},{...}]`.

4. Rode `npm run dev` e acesse — você cairá na tela de login.

> A senha é guardada apenas como **hash bcrypt em base64** (nunca em texto puro).
> O base64 é necessário porque o Next expande `$` em valores de `.env`, o que
> corromperia o hash bcrypt cru.

## Deploy na nuvem (ex.: Vercel)

- **Nunca** suba `.env.local` (já está no `.gitignore`).
- No painel do provedor, defina as variáveis `SESSION_SECRET` e `APP_USERS` com os
  mesmos valores. Use um `SESSION_SECRET` **diferente** do de desenvolvimento.
- Em produção o cookie de sessão é automaticamente `Secure` (só HTTPS).
- Para adicionar/remover usuário: edite `APP_USERS` e faça um novo deploy.

## Camadas de defesa

1. **Portão (`proxy.ts`)** — nenhuma página renderiza sem sessão válida.
2. **Cookie httpOnly + SameSite=lax + assinado** — não é lido por JavaScript nem
   forjável sem o `SESSION_SECRET`.
3. **Autorização por papel** — use `temPapel(usuario, "dono")` em Server Components
   ou Actions para liberar recursos só a certos papéis.

Exemplo de checagem por papel em um Server Component:

```tsx
import { getUsuarioAtual, temPapel } from "@/lib/auth/session";

export default async function Pagina() {
  const usuario = await getUsuarioAtual();
  if (!temPapel(usuario, "dono")) return <p>Acesso restrito ao dono.</p>;
  // ...conteúdo de admin
}
```

## Limitações atuais (por design, cenário "portão")

- **Laudos continuam no `localStorage`** do navegador (não migraram para a nuvem).
  Cada usuário vê apenas o que salvou naquele navegador. Isolamento real por dono
  exige banco de dados (próximo passo).
- **Rotas de API/route handlers** (`/api/...`) são ignoradas pelo portão. Hoje não
  existem; ao criar qualquer uma, faça a checagem dentro dela com `getUsuarioAtual()`.
- **Sem auto-cadastro nem reset de senha** — usuários são adicionados por você via
  `APP_USERS`. É o esperado para um conjunto pequeno e controlado.

## Evolução para multiusuário real (cenário B)

Quando quiser que cada usuário tenha os laudos salvos e isolados na nuvem:

1. Adicione um Postgres gerenciado (Neon ou Supabase).
2. Mova a allowlist para uma tabela `usuarios` e os laudos para uma tabela por dono.
3. Aplique **RLS** (Row-Level Security) — controle de acesso na camada de dados,
   defesa em profundidade mesmo se o front for burlado.
4. A DAL (`getUsuarioAtual`) e o portão continuam iguais; só muda a origem dos dados.
