// A conversa da sala e as conversas diretas — AC-CHAT-06 a AC-CHAT-10, AC-DM-*.
//
// Única porta entre os componentes do chat e o Firestore. Nenhum componente
// monta consulta, e nenhum componente decide permissão: o que decide permissão
// de verdade é a Security Rule, e o que este módulo faz é falhar antes, em
// português, no caso comum.
//
// O `!clear` é o motivo desta separação existir. Na v0.7.0 ele era seis linhas
// dentro de `components/Chat.js`, sem checagem de papel, e o laço que apagava
// era assim:
//
//     querySnapshot.forEach(async (doc) => { await deleteDoc(doc.ref); });
//
// Duas falhas em uma linha. A primeira é que qualquer aluno podia chamá-lo — a
// conversa inteira da turma sumia com cinco letras. A segunda é mais silenciosa:
// `forEach` **descarta** as promessas do callback, então a função retornava
// antes de qualquer deleção terminar e nenhuma falha chegava a lugar nenhum. O
// professor via o campo limpar e supunha que a conversa tinha ido.
//
// Aqui a deleção é `writeBatch`: atômica por lote, aguardada, e com o número de
// mensagens apagadas no retorno.
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  COLECAO_DE_SALAS,
  LIMITE_DE_MENSAGENS,
  PAPEL_DE_PROFESSOR,
  colecaoDeChat,
} from './salas';
import { carimboServidor } from './tempo';

/** Quantas mensagens a conversa carrega de uma vez (AC-CHAT-06). */
export const MENSAGENS_POR_PAGINA = 50;

/** O teto de uma mensagem, igual ao da Security Rule (AC-CHAT-09). */
export const TAMANHO_MAXIMO_DA_MENSAGEM = 500;

/** Quantas conversas diretas a lista carrega (AC-PERF-03). */
export const LIMITE_DE_CONVERSAS = 40;

/**
 * O teto de um `writeBatch` no Firestore. Não é escolha nossa: é o limite do
 * serviço, e passar dele faz o lote inteiro ser recusado.
 */
export const TAMANHO_DO_LOTE = 500;

/** O comando que limpa a conversa. */
export const COMANDO_LIMPAR = '!clear';

/** Falha do chat já em português, pronta para a tela. */
export class ErroDeChat extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroDeChat';
  }
}

const RECUSA_DO_CLEAR =
  'O comando !clear é do professor da sala. Peça a ele para limpar a conversa.';

/**
 * O texto de uma mensagem, validado antes de qualquer escrita (AC-CHAT-09).
 *
 * A mesma regra existe na rule do Firestore, e as duas precisam existir: a
 * daqui dá a frase em português antes de a requisição sair; a de lá é a que
 * vale mesmo com o cliente adulterado.
 *
 * O corte é sobre o texto **aparado**. Contar os espaços das pontas recusaria
 * uma mensagem de 500 caracteres que o usuário colou com um `\n` no fim.
 *
 * @param {unknown} texto o que o usuário digitou.
 * @returns {string} o texto aparado, pronto para gravar.
 * @throws {ErroDeChat} com a mensagem que a tela exibe.
 */
export function validarTexto(texto) {
  if (typeof texto !== 'string') throw new ErroDeChat('Escreva a mensagem antes de enviar.');

  const limpo = texto.trim();

  if (limpo === '') throw new ErroDeChat('Escreva a mensagem antes de enviar.');

  if (limpo.length > TAMANHO_MAXIMO_DA_MENSAGEM) {
    throw new ErroDeChat(
      `A mensagem precisa ter até ${TAMANHO_MAXIMO_DA_MENSAGEM} caracteres.`
    );
  }

  return limpo;
}

/**
 * O texto é o comando de limpar a conversa.
 *
 * Compara o texto **inteiro**, não um prefixo: "use o !clear para limpar" é uma
 * mensagem sobre o comando, e precisa ser enviada como qualquer outra.
 *
 * @param {unknown} texto
 * @returns {boolean}
 */
export function ehComandoLimpar(texto) {
  return typeof texto === 'string' && texto.trim().toLowerCase() === COMANDO_LIMPAR;
}

/**
 * O corpo de uma mensagem, no formato desta versão.
 *
 * A escrita é **dupla** de propósito, como a dos chamados na task 03:
 * `autorNome`/`autorUid`/`autorPapel` são os campos novos, `nome` e `email` são
 * os que o cliente da v0.4.0 lê. Um aluno com a aba aberta desde antes do
 * deploy continua vendo quem falou (compatibilidade futura). Os dois saem com o
 * mesmo conteúdo até a 1.0.0.
 *
 * `editadaEm: null` nasce aqui porque campo que existe desde o primeiro
 * documento não precisa de leitura dupla depois.
 */
function corpoDaMensagem(autor, texto) {
  return {
    texto,
    autorUid: autor.uid,
    autorNome: autor.nome,
    autorPapel: autor.papel || null,
    nome: autor.nome,
    email: autor.email || null,
    horario: carimboServidor(),
    editadaEm: null,
  };
}

/**
 * Envia uma mensagem para a conversa da sala.
 *
 * @param {string|null} salaId `null` cai na coleção global da v0.4.0.
 * @param {{uid: string, nome: string, email?: string, papel?: string}} autor
 * @param {string} texto
 * @returns {Promise<object>} referência do documento criado.
 * @throws {ErroDeChat} quando o texto não passa na validação.
 */
export async function enviarMensagem(salaId, autor, texto) {
  const validado = validarTexto(texto);

  return addDoc(colecaoDeChat(salaId), corpoDaMensagem(autor, validado));
}

/**
 * A pessoa é o professor **desta** sala.
 *
 * O papel vem do vínculo `salas/{salaId}/membros/{uid}`, que é o mesmo
 * documento que a rule consulta. Ser professor no SENAI não basta (AC-SEC-02).
 */
function ehProfessorDaSala(pessoa) {
  return Boolean(pessoa) && pessoa.papel === PAPEL_DE_PROFESSOR;
}

/**
 * Apaga a conversa da sala em lotes aguardados (AC-CHAT-08).
 *
 * A checagem de papel aqui **não é a proteção** — a proteção é a rule, que só
 * deixa o professor dono da sala apagar mensagem. O que esta checagem faz é
 * recusar antes de tocar no banco, para que o aluno receba uma frase em
 * português em vez de um `permission-denied` cru pela metade da conversa.
 *
 * Cada lote é atômico: ou apaga as 500 mensagens dele, ou não apaga nenhuma. É
 * o que impede o `!clear` recusado de deixar a conversa pela metade.
 *
 * @param {string|null} salaId
 * @param {{uid: string, papel?: string}} pessoa quem digitou o comando.
 * @returns {Promise<{apagadas: number, lotes: number}>}
 * @throws {ErroDeChat} quando quem pediu não é o professor da sala.
 */
export async function limparConversa(salaId, pessoa) {
  if (!ehProfessorDaSala(pessoa)) throw new ErroDeChat(RECUSA_DO_CLEAR);

  const encontradas = await getDocs(query(colecaoDeChat(salaId), limit(LIMITE_DE_MENSAGENS)));
  const referencias = encontradas.docs.map((documento) => documento.ref);

  let lotes = 0;

  for (let inicio = 0; inicio < referencias.length; inicio += TAMANHO_DO_LOTE) {
    const lote = writeBatch(db);

    referencias.slice(inicio, inicio + TAMANHO_DO_LOTE).forEach((referencia) => {
      lote.delete(referencia);
    });

    // O `await` dentro do laço é o ponto inteiro desta função: sem ele, a
    // falha do terceiro lote não chegaria a ninguém.
    // eslint-disable-next-line no-await-in-loop
    await lote.commit();
    lotes += 1;
  }

  return { apagadas: referencias.length, lotes };
}

// --- conversas diretas ------------------------------------------------------

/**
 * O id determinístico de uma conversa entre duas pessoas (AC-DM-02).
 *
 * UIDs ordenados e unidos por `_`. Determinístico porque os dois lados
 * precisam chegar ao **mesmo** documento sem combinar nada: se o professor
 * abrisse `carlos_ana` e a aluna `ana_carlos`, cada um teria metade da
 * conversa e nenhum saberia disso.
 *
 * A mesma regra é cobrada pela Security Rule, que exige
 * `participantes[0] < participantes[1]` e o id igual à junção dos dois — assim
 * nem um cliente adulterado cria a conversa duplicada.
 *
 * @param {string} a
 * @param {string} b
 * @returns {string}
 */
export function idDaConversa(a, b) {
  return [a, b].sort().join('_');
}

/** A coleção de conversas diretas da sala. */
export function colecaoDeConversas(salaId) {
  return collection(db, COLECAO_DE_SALAS, salaId, 'conversas');
}

/** O documento de uma conversa direta. */
export function referenciaDaConversa(salaId, conversaId) {
  return doc(db, COLECAO_DE_SALAS, salaId, 'conversas', conversaId);
}

/** As mensagens de uma conversa direta. */
export function colecaoDeMensagensDiretas(salaId, conversaId) {
  return collection(db, COLECAO_DE_SALAS, salaId, 'conversas', conversaId, 'mensagens');
}

/**
 * Abre — ou reencontra — a conversa direta entre duas pessoas da sala.
 *
 * Idempotente: chamada duas vezes, devolve o mesmo `conversaId` e não zera
 * contador nem nome de ninguém. É por isso que ela **lê antes de escrever**, em
 * vez de um `setDoc` com `merge`: o merge reescreveria `naoLidas` com zeros e
 * apagaria as mensagens não lidas que o outro lado deixou.
 *
 * @param {string} salaId
 * @param {{uid: string, nome: string}} eu
 * @param {{uid: string, nome: string}} outro
 * @returns {Promise<string>} o `conversaId`.
 */
export async function abrirConversa(salaId, eu, outro) {
  const conversaId = idDaConversa(eu.uid, outro.uid);
  const referencia = referenciaDaConversa(salaId, conversaId);
  const existente = await getDoc(referencia);

  if (existente.exists()) return conversaId;

  const [primeiro, segundo] = [eu.uid, outro.uid].sort();
  const nomes = { [eu.uid]: eu.nome, [outro.uid]: outro.nome };

  await setDoc(referencia, {
    participantes: [primeiro, segundo],
    participantesNomes: { [primeiro]: nomes[primeiro], [segundo]: nomes[segundo] },
    naoLidas: { [primeiro]: 0, [segundo]: 0 },
    ultimaMensagem: null,
    criadaEm: carimboServidor(),
  });

  return conversaId;
}

/**
 * Envia uma mensagem direta e atualiza o resumo da conversa (AC-DM-05/06).
 *
 * São duas escritas por mensagem, e é de propósito. `ultimaMensagem` e
 * `naoLidas` são desnormalizados no documento da conversa para que a lista de
 * conversas seja **uma** consulta — sem eles, montar a lista exigiria abrir a
 * última mensagem de cada conversa, uma leitura por linha, toda vez que a tela
 * abrisse. Troca-se uma escrita a mais por mensagem por N leituras a menos por
 * abertura de tela, e abrir a tela é o que acontece o tempo todo.
 *
 * O contador do **outro** sobe com `increment`, não com `lido + 1`: duas
 * mensagens enviadas no mesmo segundo precisam somar duas.
 *
 * @param {string} salaId
 * @param {string} conversaId
 * @param {{uid: string, nome: string}} autor
 * @param {string} destinatarioUid
 * @param {string} texto
 * @throws {ErroDeChat} quando o texto não passa na validação.
 */
export async function enviarMensagemDireta(salaId, conversaId, autor, destinatarioUid, texto) {
  const validado = validarTexto(texto);

  const referencia = await addDoc(colecaoDeMensagensDiretas(salaId, conversaId), {
    texto: validado,
    autorUid: autor.uid,
    autorNome: autor.nome,
    horario: carimboServidor(),
    lidaEm: null,
  });

  await updateDoc(referenciaDaConversa(salaId, conversaId), {
    ultimaMensagem: { texto: validado, autorUid: autor.uid, horario: serverTimestamp() },
    [`naoLidas.${destinatarioUid}`]: increment(1),
  });

  return referencia;
}

/**
 * Zera o contador de não lidas de quem abriu a conversa (AC-DM-05).
 *
 * Zera só o campo da própria pessoa — `naoLidas.{uid}` com caminho de campo, e
 * não o mapa inteiro. Reescrever o mapa apagaria o contador do outro lado, que
 * é exatamente o dado que ele ainda não viu.
 *
 * @param {string} salaId
 * @param {string} conversaId
 * @param {string} uid
 */
export async function marcarConversaComoLida(salaId, conversaId, uid) {
  await updateDoc(referenciaDaConversa(salaId, conversaId), { [`naoLidas.${uid}`]: 0 });
}

/**
 * Escuta as conversas diretas de uma pessoa, da mais recente para a mais
 * antiga (AC-DM-04, AC-DM-06).
 *
 * O `where('participantes', 'array-contains', uid)` **não** é um filtro de
 * interface: é o que torna a consulta aceitável para a rule. A rule libera o
 * documento cujos `participantes` contêm quem está pedindo, e o Firestore só
 * aceita uma consulta de coleção quando consegue provar que todo resultado dela
 * passa na rule. Sem o `array-contains`, a listagem inteira é negada — não
 * filtrada, negada.
 *
 * @param {string} salaId
 * @param {string} uid
 * @param {(conversas: Array<object>) => void} aoMudar
 * @returns {() => void} cancela a inscrição (AC-PERF-04).
 */
export function observarConversas(salaId, uid, aoMudar) {
  const consulta = query(
    colecaoDeConversas(salaId),
    where('participantes', 'array-contains', uid),
    orderBy('ultimaMensagem.horario', 'desc'),
    limit(LIMITE_DE_CONVERSAS)
  );

  return onSnapshot(consulta, (snapshot) => {
    aoMudar(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
  });
}
