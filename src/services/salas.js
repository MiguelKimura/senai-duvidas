// As salas do professor — AC-SALA-01 a AC-SALA-12, AC-SEC-02, AC-SEC-05.
//
// Até a v0.4.0 `chamados` e `chat` eram coleções globais: toda turma do SENAI
// dividia a mesma fila e a mesma conversa. A partir daqui cada turma tem a sua
// sala, e os dados vivem em `salas/{salaId}/...`. Este módulo é a única porta
// entre a interface e esse modelo.
//
// O PIN é o ponto delicado, e o desenho tem três peças:
//
//   1. `salas/{salaId}`            — sem segredo nenhum. Todo membro lê.
//   2. `salas/{salaId}/segredo/pin` — o resumo e o sal. SÓ o dono lê.
//   3. `indicePins/{pin}`           — o PIN aponta para a sala. A rule permite
//                                     `get` de um documento específico, nunca
//                                     `list`, e só depois de uma tentativa
//                                     contada (AC-SALA-12).
//
// O resumo ficar fora do documento da sala não é preciosismo: as rules do
// Firestore não escondem campo. Se o `pinHash` morasse em `salas/{salaId}`,
// todo aluno da turma o leria junto com o nome da sala — e seis dígitos com
// resumo em mãos caem por força bruta offline em segundos (AC-SEC-05).
//
// Quem confere o PIN na entrada é o **servidor**: a rule refaz
// `hashing.sha256(sal + pin)` e compara com o resumo. O cliente nunca precisa
// ler o segredo, e é por isso que regerar o PIN invalida o anterior sem que
// ninguém guarde o número antigo em lugar nenhum (AC-SALA-09).
import { addDoc, collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { carimboServidor } from './tempo';
import { gerarPin, gerarSal, hashDePin } from './pin';

export const COLECAO_DE_SALAS = 'salas';
export const COLECAO_DO_INDICE = 'indicePins';
export const COLECAO_DE_TENTATIVAS = 'tentativasPin';

/** Papéis **dentro** da sala. Ser professor no SENAI não é ser dono desta sala. */
export const PAPEL_DE_ALUNO = 'aluno';
export const PAPEL_DE_PROFESSOR = 'professor';

/** Quantos números o cliente sorteia antes de desistir de achar um PIN livre. */
export const TENTATIVAS_DE_PIN_UNICO = 8;

/**
 * Tetos dos listeners (AC-PERF-03, AC-PERF-06).
 *
 * O alvo declarado do projeto é 200 chamados e 1000 mensagens por sala, com 40
 * alunos. Os cortes abaixo cobrem esse alvo e transformam "a coleção inteira"
 * — que cresce o ano letivo todo — num custo de leitura que se pode calcular.
 */
export const LIMITE_DE_CHAMADOS = 200;
export const LIMITE_DE_MENSAGENS = 300;
export const LIMITE_DE_MEMBROS = 60;
export const LIMITE_DE_SALAS = 20;

const TAMANHO_MAXIMO_DO_NOME = 80;
const PRIMEIRO_ANO_LETIVO = 2000;
const ULTIMO_ANO_LETIVO = 2100;

/**
 * Falha de sala já traduzida para o português, pronta para a tela.
 *
 * Existe para separar "o sistema não deixou" de "o Firebase caiu": a primeira
 * o usuário resolve relendo a mensagem, a segunda não.
 */
export class ErroDeSala extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroDeSala';
  }
}

/** O servidor recusou a operação — em geral, uma rule. */
export function ehRecusaDoServidor(erro) {
  return Boolean(erro) && (erro.code === 'permission-denied' || erro.code === 'already-exists');
}

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Valida o que o professor digitou antes de qualquer escrita (AC-SALA-01).
 *
 * A mesma validação existe nas rules. As duas precisam existir: a do cliente
 * dá a mensagem em português, a do servidor é a que vale.
 *
 * @param {{nome: string, curso: string, anoLetivo: string|number}} dados
 * @returns {{nome: string, curso: string, anoLetivo: number}}
 * @throws {ErroDeSala} com a mensagem que a tela exibe.
 */
export function validarDadosDaSala({ nome, curso, anoLetivo } = {}) {
  const nomeLimpo = texto(nome);
  const cursoLimpo = texto(curso);
  const ano = Number(anoLetivo);

  if (!nomeLimpo) throw new ErroDeSala('Informe o nome da sala.');
  if (nomeLimpo.length > TAMANHO_MAXIMO_DO_NOME) {
    throw new ErroDeSala(`O nome da sala precisa ter até ${TAMANHO_MAXIMO_DO_NOME} caracteres.`);
  }

  if (!cursoLimpo) throw new ErroDeSala('Informe o curso ou a turma.');
  if (cursoLimpo.length > TAMANHO_MAXIMO_DO_NOME) {
    throw new ErroDeSala(`O curso precisa ter até ${TAMANHO_MAXIMO_DO_NOME} caracteres.`);
  }

  if (
    texto(String(anoLetivo ?? '')) === '' ||
    !Number.isInteger(ano) ||
    ano < PRIMEIRO_ANO_LETIVO ||
    ano > ULTIMO_ANO_LETIVO
  ) {
    throw new ErroDeSala(
      `Informe o ano letivo, entre ${PRIMEIRO_ANO_LETIVO} e ${ULTIMO_ANO_LETIVO}.`
    );
  }

  return { nome: nomeLimpo, curso: cursoLimpo, anoLetivo: ano };
}

// --- caminhos ---------------------------------------------------------------

/** Referência ao documento da sala. */
export function referenciaDaSala(salaId) {
  return doc(db, COLECAO_DE_SALAS, salaId);
}

/** O documento que guarda resumo e sal do PIN. Só o dono da sala o lê. */
export function referenciaDoSegredo(salaId) {
  return doc(db, COLECAO_DE_SALAS, salaId, 'segredo', 'pin');
}

/** Referência ao vínculo de uma pessoa com a sala. */
export function referenciaDoMembro(salaId, uid) {
  return doc(db, COLECAO_DE_SALAS, salaId, 'membros', uid);
}

/** O espelho que monta a lista de salas de cada pessoa. */
export function referenciaDoEspelho(uid, salaId) {
  return doc(db, 'usuarios', uid, COLECAO_DE_SALAS, salaId);
}

/**
 * A coleção de membros da sala.
 * @param {string} salaId
 */
export function colecaoDeMembros(salaId) {
  return collection(db, COLECAO_DE_SALAS, salaId, 'membros');
}

/**
 * A coleção de chamados da sala — ou a coleção global, sem sala.
 *
 * O `null` não é descuido: é o **fallback de leitura** desta versão. Um aluno
 * que ainda não entrou em sala nenhuma continua vendo a fila da v0.4.0, que é
 * onde os dados dele estão até a migração rodar. As coleções globais só somem
 * na 1.0.0.
 *
 * @param {string|null|undefined} salaId
 */
export function colecaoDeChamados(salaId) {
  return salaId
    ? collection(db, COLECAO_DE_SALAS, salaId, 'chamados')
    : collection(db, 'chamados');
}

/** A coleção de mensagens da sala — ou a global, pelo mesmo fallback. */
export function colecaoDeChat(salaId) {
  return salaId ? collection(db, COLECAO_DE_SALAS, salaId, 'chat') : collection(db, 'chat');
}

/**
 * Onde o anexo de um chamado mora no Storage.
 *
 * Já parametrizado por sala para a task 04: quando o upload de arquivo
 * existir, ele nasce escopado, e não em `imagens/{nome}`, onde dois alunos que
 * enviem `print.png` se sobrescrevem.
 *
 * @param {string|null} salaId
 * @param {string} chamadoId
 * @param {string} nomeDoArquivo
 */
export function caminhoDoAnexo(salaId, chamadoId, nomeDoArquivo) {
  return salaId
    ? `${COLECAO_DE_SALAS}/${salaId}/chamados/${chamadoId}/${nomeDoArquivo}`
    : `imagens/${nomeDoArquivo}`;
}

// --- criação ----------------------------------------------------------------

/**
 * Reserva um PIN livre criando o documento do índice.
 *
 * Quem garante a unicidade é o **servidor**: a rule de `indicePins` permite
 * apenas `create`, nunca `update` nem `delete`. Escrever num PIN já usado é
 * recusado — inclusive para o professor que é dono da outra sala —, e a recusa
 * é o sinal de colisão. Conferir antes com um `get` seria pior: daria a
 * qualquer cliente um jeito de descobrir quais PINs existem, um por um.
 *
 * @param {string} salaId
 * @returns {Promise<string>} o PIN reservado, em claro e só em memória.
 */
async function reservarPin(salaId) {
  for (let tentativa = 0; tentativa < TENTATIVAS_DE_PIN_UNICO; tentativa += 1) {
    const pin = gerarPin();

    try {
      await setDoc(doc(db, COLECAO_DO_INDICE, pin), {
        salaId,
        ativo: true,
        criadoEm: carimboServidor(),
      });

      return pin;
    } catch (erro) {
      // Falha que não é recusa — rede, cota, configuração — não é colisão, e
      // sortear outro número não a resolveria.
      if (!ehRecusaDoServidor(erro)) throw erro;
    }
  }

  throw new ErroDeSala(
    'Não foi possível sortear um PIN livre para a sala. Tente criar a sala de novo.'
  );
}

/**
 * Sorteia um PIN para a sala e grava o resumo dele.
 *
 * A ordem importa. Primeiro o índice, depois o segredo: entre as duas
 * escritas, o PIN novo ainda não abre a porta (o resumo antigo não confere) e
 * o antigo continua abrindo. O contrário deixaria a sala sem nenhum PIN válido
 * caso a reserva falhasse.
 *
 * @param {string} salaId
 * @returns {Promise<string>} o PIN em claro, que o professor vê uma vez.
 */
async function definirPin(salaId) {
  const pin = await reservarPin(salaId);
  const sal = gerarSal();

  await setDoc(referenciaDoSegredo(salaId), {
    hash: await hashDePin(pin, sal),
    sal,
    atualizadoEm: carimboServidor(),
  });

  await updateDoc(referenciaDaSala(salaId), { pinAtualizadoEm: carimboServidor() });

  return pin;
}

/**
 * Registra o vínculo de uma pessoa com a sala, nos dois lugares.
 *
 * `salas/{salaId}/membros/{uid}` é a autoridade — é ele que as rules
 * consultam. `usuarios/{uid}/salas/{salaId}` é o espelho que monta a lista de
 * salas da pessoa sem precisar varrer as salas de ninguém.
 */
async function registrarVinculo(salaId, pessoa, papel) {
  await setDoc(referenciaDoMembro(salaId, pessoa.uid), {
    nome: pessoa.nome,
    email: pessoa.email || null,
    papel,
    entrouEm: carimboServidor(),
  });

  await setDoc(referenciaDoEspelho(pessoa.uid, salaId), {
    salaId,
    papel,
    entrouEm: carimboServidor(),
  });
}

/**
 * Cria a sala do professor e devolve o PIN uma única vez (AC-SALA-01/02/03).
 *
 * O PIN volta no retorno e **não** é persistido em lugar nenhum em claro: a
 * tela o mantém em memória para o professor copiar, e some com a navegação.
 * Perdeu, regera (AC-SALA-09).
 *
 * @param {{nome: string, curso: string, anoLetivo: string|number}} dados
 * @param {{uid: string, nome: string, email?: string}} professor
 * @returns {Promise<{salaId: string, pin: string}>}
 */
export async function criarSala(dados, professor) {
  const validados = validarDadosDaSala(dados);

  const referencia = await addDoc(collection(db, COLECAO_DE_SALAS), {
    ...validados,
    professorUid: professor.uid,
    professorNome: professor.nome,
    ativa: true,
    arquivadaEm: null,
    criadaEm: carimboServidor(),
  });

  const salaId = referencia.id;
  const pin = await definirPin(salaId);

  await registrarVinculo(salaId, professor, PAPEL_DE_PROFESSOR);

  return { salaId, pin };
}
