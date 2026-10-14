/**
 * Gera a entrada de um usuário para a allowlist (APP_USERS), incluindo o
 * hash bcrypt da senha. Não há banco de dados: você cola a saída no APP_USERS
 * do seu .env.local (ou nas variáveis de ambiente do provedor de deploy).
 *
 * Uso:
 *   npm run criar-usuario -- <email> <senha> <papel>
 *
 * Exemplos:
 *   npm run criar-usuario -- voce@dominio.com "MinhaSenhaForte" dono
 *   npm run criar-usuario -- eng@dominio.com "OutraSenha123" editor
 *
 * Papéis: dono | editor | leitor
 */
import bcrypt from "bcryptjs";

const PAPEIS = ["dono", "editor", "leitor"];

async function main() {
  const [email, senha, papel] = process.argv.slice(2);

  if (!email || !senha || !papel) {
    console.error("Uso: npm run criar-usuario -- <email> <senha> <papel>");
    console.error("Papéis: dono | editor | leitor");
    process.exit(1);
  }
  if (!PAPEIS.includes(papel)) {
    console.error(`Papel inválido: ${papel}. Use um de: ${PAPEIS.join(", ")}`);
    process.exit(1);
  }
  if (senha.length < 8) {
    console.error("A senha deve ter pelo menos 8 caracteres.");
    process.exit(1);
  }

  // O hash é guardado em base64 porque o carregador de .env do Next expande
  // "$" (o bcrypt começa com "$2b$..."), o que corromperia o hash cru.
  const senhaHash = Buffer.from(await bcrypt.hash(senha, 12), "utf8").toString("base64");
  const entrada = { email: email.trim().toLowerCase(), papel, senhaHash };

  console.log("\nEntrada do usuário (adicione ao array APP_USERS):\n");
  console.log(JSON.stringify(entrada, null, 2));
  console.log("\nAPP_USERS deve ser um array JSON em UMA linha, por exemplo:\n");
  console.log(`APP_USERS=[${JSON.stringify(entrada)}]\n`);
}

main();
