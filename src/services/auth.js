// Esqueleto do serviço de autenticação. Existe para que o teste do ciclo falhe
// na asserção, e não no import.

export async function entrarComEmailESenha() {}
export async function entrarComGoogle() {}
export async function entrarComGithub() {}
export async function sair() {}
export function observarAutenticacao() {
  return () => {};
}
