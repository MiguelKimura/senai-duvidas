// A conversa da sala.
//
// PASSO 1: o que `components/Chat.js` fazia, extraído sem mudar comportamento.
// É o incumbente contra o qual `__tests__/chat.test.js` está vermelho.
import { addDoc, deleteDoc, getDocs, limit, query } from 'firebase/firestore';
import { LIMITE_DE_MENSAGENS, colecaoDeChat } from './salas';
import { carimboServidor } from './tempo';

export const COMANDO_LIMPAR = '!clear';

export function ehComandoLimpar(texto) {
  return typeof texto === 'string' && texto.trim().toLowerCase() === COMANDO_LIMPAR;
}

export async function enviarMensagem(salaId, autor, texto) {
  return addDoc(colecaoDeChat(salaId), {
    texto,
    autorUid: autor.uid,
    autorNome: autor.nome,
    nome: autor.nome,
    email: autor.email,
    horario: carimboServidor(),
  });
}

export async function limparConversa(salaId) {
  const consulta = query(colecaoDeChat(salaId), limit(LIMITE_DE_MENSAGENS));
  const encontradas = await getDocs(consulta);

  encontradas.forEach(async (documento) => {
    await deleteDoc(documento.ref);
  });
}
