// Server-only: valida a senha do admin usando variável de ambiente.
// Nunca é importado pelo cliente (sufixo .server.ts).

export function assertAdminPassword(password: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("ADMIN_PASSWORD não configurada no servidor");
  if (password !== expected) throw new Error("Senha incorreta");
}
