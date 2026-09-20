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

/**
 * Lê `usuarios/{uid}` e, se não existir, cria com `tipo: "aluno"`.
 *
 * Um usuário recém-criado nunca nasce professor: a promoção só acontece pela
 * coleção `autorizados`, mantida à mão no console do Firebase.
 *
 * @param {{uid: string, email?: string, displayName?: string, providerData?: Array<{providerId: string}>}} usuario
 *   usuário do Firebase Auth.
 * @returns {Promise<{perfil: object, papel: Papel, criado: boolean}>}
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
    return { perfil: documento.data(), papel: PAPEL_ALUNO, criado: false };
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

  return { perfil, papel: PAPEL_ALUNO, criado: true };
}
