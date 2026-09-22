// Perfil e papel do usuário — a fonte única de verdade (AC-AUTH-06, AC-SEC-03).
//
// Antes desta task o papel vinha de `localStorage.getItem('tipoUsuario')`, um
// valor que o próprio navegador escreve. Aqui ele passa a sair só do Firestore,
// e este módulo é o único caminho até ele.
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

/** @typedef {'aluno'|'professor'} Papel */

export const PAPEL_ALUNO = 'aluno';
export const PAPEL_PROFESSOR = 'professor';

/**
 * Nome exibível do usuário.
 *
 * O GitHub só entrega `displayName` para quem preencheu o perfil por lá, e o
 * Google não entrega em conta sem nome. O trecho antes do `@` é o que sobra de
 * previsível — melhor do que gravar `null` e a tela dizer "Bem-vindo, !".
 */
function nomeDoUsuario(usuario) {
  if (usuario.displayName) return usuario.displayName;
  if (usuario.email) return usuario.email.split('@')[0];
  return 'Aluno';
}

/** Identificador do provedor que autenticou (`google.com`, `password`, ...). */
function provedorDoUsuario(usuario) {
  const primeiro = usuario.providerData && usuario.providerData[0];
  return (primeiro && primeiro.providerId) || 'desconhecido';
}

/** E-mail na forma usada como id em `autorizados`: sem espaços, em minúsculas. */
function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * A lista `autorizados` é mantida à mão no console do Firebase e é a única
 * autoridade sobre quem pode ser professor. O documento `usuarios/{uid}`
 * sozinho não serve: com as rules de hoje o próprio cliente escreve nele.
 */
async function estaAutorizadoComoProfessor(email) {
  const chave = normalizarEmail(email);
  if (!chave) return false;

  const documento = await getDoc(doc(db, 'autorizados', chave));
  if (!documento.exists()) return false;

  const tipo = documento.data().Tipo;
  return typeof tipo === 'string' && tipo.trim().toLowerCase() === PAPEL_PROFESSOR;
}

/**
 * Aplica a regra de resolução do papel a um documento que já existe.
 *
 * Conta legada: se o documento diz professor mas o e-mail sumiu de
 * `autorizados`, o acesso continua — rebaixado para aluno e registrado em log.
 * Travar a entrada de uma professora no meio da aula seria pior do que o
 * rebaixamento, e o log dá ao administrador o que reconciliar.
 */
async function resolverPapelDoPerfil(perfil, usuario) {
  if (perfil.tipo !== PAPEL_PROFESSOR) {
    return { papel: PAPEL_ALUNO, rebaixado: false };
  }

  const email = perfil.email || usuario.email;

  if (await estaAutorizadoComoProfessor(email)) {
    return { papel: PAPEL_PROFESSOR, rebaixado: false };
  }

  console.warn(
    '[auth] Documento diz professor, mas o e-mail não está em autorizados: ' +
      'acesso rebaixado para aluno.',
    { uid: usuario.uid }
  );

  return { papel: PAPEL_ALUNO, rebaixado: true };
}

/**
 * Lê `usuarios/{uid}` e, se não existir, cria com `tipo: "aluno"`.
 *
 * Um usuário recém-criado nunca nasce professor: a promoção só acontece pela
 * coleção `autorizados`, mantida à mão no console do Firebase.
 *
 * @param {{uid: string, email?: string, displayName?: string, providerData?: Array<{providerId: string}>}} usuario
 *   usuário do Firebase Auth.
 * @returns {Promise<{perfil: object, papel: Papel, criado: boolean, rebaixado: boolean}>}
 *   `rebaixado` marca a conta legada de professor que perdeu a autorização.
 * @throws {Error} se o usuário não tiver `uid`, ou se o Firestore falhar — o
 *   chamador precisa distinguir "não tem papel" de "não deu para saber".
 */
export async function garantirPerfil(usuario) {
  if (!usuario || !usuario.uid) {
    throw new Error('garantirPerfil exige um usuário autenticado com uid.');
  }

  const referencia = doc(db, 'usuarios', usuario.uid);
  const documento = await getDoc(referencia);

  if (documento.exists()) {
    const perfilExistente = documento.data();
    const { papel, rebaixado } = await resolverPapelDoPerfil(perfilExistente, usuario);

    return { perfil: perfilExistente, papel, criado: false, rebaixado };
  }

  const perfil = {
    uid: usuario.uid,
    nome: nomeDoUsuario(usuario),
    email: usuario.email || null,
    tipo: PAPEL_ALUNO,
    // Campos aditivos (compatibilidade futura): um leitor que os ignore
    // continua enxergando uid, nome, email e tipo exatamente como antes.
    criadoEm: serverTimestamp(),
    provedor: provedorDoUsuario(usuario),
  };

  await setDoc(referencia, perfil);

  return { perfil, papel: PAPEL_ALUNO, criado: true, rebaixado: false };
}

/**
 * ESBOÇO (task 07): as preferências de animação e som (AC-PERK-08).
 *
 * A implementação real entra no ciclo GREEN. Por ora devolve o que estiver
 * gravado, sem padrão nenhum — que é o que quebra a tela de quem nunca mexeu
 * nas preferências.
 */
export const PREFERENCIAS_PADRAO = { animacoes: true, som: false };

export function lerPreferencias(perfil) {
  return (perfil && perfil.preferencias) || {};
}

export async function salvarPreferencias(_uid, preferencias) {
  return preferencias;
}
