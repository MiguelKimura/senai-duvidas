// Quem é professor pelo e-mail institucional.
//
// Até a v1.0.0 a única porta para o papel de professor era a coleção
// `autorizados`, mantida à mão no console do Firebase: cada professor novo
// dependia de alguém com acesso ao console. A v1.1.0 abre uma segunda porta,
// automática: e-mail do domínio do SENAI-SP **confirmado**.
//
// A confirmação é o que faz a porta ser segura. Qualquer pessoa digita
// `fulano@sp.senai.br` no cadastro; só quem tem a caixa de entrada clica no
// link que o Firebase manda para lá. O link é o "PIN de verificação" do
// pedido do cliente — no plano Spark não há servidor para gerar e enviar um
// código numérico, e o e-mail de verificação do Firebase Auth é gratuito,
// assinado e já expira sozinho.
//
// A mesma regra está em `firestore.rules` (`ehProfessor()`), lendo o token.
// Esta cópia decide a tela; a da rule decide o que o banco aceita.

/** O domínio dos e-mails de professor do SENAI-SP. */
export const DOMINIO_DE_PROFESSOR = 'sp.senai.br';

/**
 * O e-mail é do domínio de professor.
 *
 * O `@` faz parte da comparação: sem ele, `aluno@naosp.senai.br` ou um
 * subdomínio como `@aluno.sp.senai.br` passariam.
 *
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function ehEmailDeProfessor(email) {
  if (typeof email !== 'string') return false;

  return email.trim().toLowerCase().endsWith(`@${DOMINIO_DE_PROFESSOR}`);
}

/**
 * O usuário do Firebase Auth é professor pelo domínio: e-mail institucional
 * e confirmado.
 *
 * @param {{email?: string|null, emailVerified?: boolean}|null} usuario
 * @returns {boolean}
 */
export function ehProfessorPorDominio(usuario) {
  return Boolean(
    usuario && usuario.emailVerified === true && ehEmailDeProfessor(usuario.email)
  );
}

/**
 * Falta só confirmar o e-mail para o usuário virar professor.
 *
 * @param {{email?: string|null, emailVerified?: boolean}|null} usuario
 * @returns {boolean}
 */
export function aguardaConfirmacaoDeProfessor(usuario) {
  return Boolean(
    usuario && usuario.emailVerified !== true && ehEmailDeProfessor(usuario.email)
  );
}
