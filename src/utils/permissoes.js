import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * Diz se o e-mail está em `autorizados/{email}` com `Tipo: "professor"`.
 *
 * Checagem de cliente: serve para não oferecer o cadastro de professor a quem
 * não pode, não para garantir a segurança — quem garante é a Firestore Rule.
 *
 * Nada aqui vai para o console: a função recebe o e-mail de quem está entrando
 * e lê um documento com dados pessoais, e o console fica visível na projeção da
 * sala e em qualquer captura de tela de suporte.
 *
 * @param {string} email E-mail digitado, em qualquer caixa e com espaços.
 * @returns {Promise<boolean>} `true` somente para professor autorizado.
 */
export const verificarPermissao = async (email) => {
  if (!email) {
    return false;
  }

  try {
    const docRef = doc(db, 'autorizados', email.trim().toLowerCase());
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return false;
    }

    const tipo = docSnap.data().Tipo;
    return typeof tipo === 'string' && tipo.toLowerCase() === 'professor';
  } catch {
    // Falha de leitura nega o acesso. O erro não é registrado porque a mensagem
    // do Firestore carrega o caminho do documento — e o caminho é o e-mail.
    return false;
  }
};
