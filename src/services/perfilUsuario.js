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
 * As preferências de interface do usuário (AC-PERK-08).
 *
 * `animacoes: true` porque a animação de premiação **é** o requisito do
 * cliente, não um enfeite — quem não a quiser desliga. `som: false` por
 * decisão de produto: são 40 pessoas numa sala com projetor, e um áudio que
 * toca sozinho no primeiro carregamento é uma aula interrompida. Quem quiser
 * som liga, uma vez, e o navegador já terá recebido o gesto do usuário que ele
 * exige para tocar áudio.
 */
export const PREFERENCIAS_PADRAO = Object.freeze({ animacoes: true, som: false });

/**
 * Lê `preferencias` de um perfil, completando o que faltar (AC-PERK-08).
 *
 * O campo é **aditivo**: ele nasce na v0.9.0 e nenhum documento gravado até a
 * v0.8.0 o tem. É esta função que torna isso verdade — sem padrão na leitura,
 * o primeiro aluno a abrir a sala depois do deploy encontraria
 * `undefined.animacoes` e a tela quebraria por causa de um campo que ele nunca
 * pediu.
 *
 * Valor que não é booleano cai no padrão em vez de ser usado como veio: um
 * `animacoes: "não"` vindo de uma edição manual no console é `truthy`, e
 * ligaria justamente o que quem digitou queria desligar.
 *
 * @param {object|null|undefined} perfil documento de `usuarios/{uid}`.
 * @returns {{animacoes: boolean, som: boolean}}
 */
export function lerPreferencias(perfil) {
  const gravadas = (perfil && perfil.preferencias) || {};

  return Object.keys(PREFERENCIAS_PADRAO).reduce((completas, chave) => {
    completas[chave] =
      typeof gravadas[chave] === 'boolean' ? gravadas[chave] : PREFERENCIAS_PADRAO[chave];

    return completas;
  }, {});
}

/**
 * Grava as preferências do próprio usuário, e só elas (AC-PERK-08).
 *
 * `merge: true` e um mapa completo: o resto do documento — `tipo`, sobretudo —
 * não é tocado. Esta função não pode virar um caminho para mexer no papel de
 * quem quer que seja, e a rule também não deixaria (AC-SEC-03).
 *
 * O que vai para o banco passa por `lerPreferencias` antes, então só chaves
 * conhecidas e valores booleanos são gravados.
 *
 * @param {string} uid
 * @param {{animacoes?: boolean, som?: boolean}} preferencias
 * @returns {Promise<{animacoes: boolean, som: boolean}>} o que ficou gravado.
 */
export async function salvarPreferencias(uid, preferencias) {
  const normalizadas = lerPreferencias({ preferencias });

  await setDoc(doc(db, 'usuarios', uid), { preferencias: normalizadas }, { merge: true });

  return normalizadas;
}
