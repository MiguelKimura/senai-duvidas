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
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { FUSO_BRASILIA, carimboServidor } from './tempo';
import {
  ERRO_DE_LIMITE,
  ERRO_DE_PIN,
  ehPinValido,
  gerarPin,
  gerarSal,
  hashDePin,
  normalizarPin,
} from './pin';

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

/**
 * O ano letivo corrente, pelo calendário de Brasília (AC-SALA-05).
 *
 * `new Date().getFullYear()` usaria o fuso da máquina — e o problema que a
 * task 02 documentou é justamente que o fuso das máquinas de laboratório não é
 * confiável. Na virada do ano, um Windows configurado em Tóquio ofereceria
 * 2027 para uma sala criada em 31 de dezembro à noite no Brasil.
 *
 * @param {Date} [agora]
 * @returns {number}
 */
export function anoLetivoCorrente(agora = new Date()) {
  return Number(
    new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO_BRASILIA, year: 'numeric' }).format(agora)
  );
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

/** O contador de tentativas de PIN de uma pessoa (AC-SALA-12). */
export function referenciaDaTentativa(uid) {
  return doc(db, COLECAO_DE_TENTATIVAS, uid);
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


// --- entrada por PIN --------------------------------------------------------

/**
 * Conta mais uma tentativa de PIN desta pessoa (AC-SALA-12).
 *
 * Quem decide se a tentativa cabe é a **rule**, porque só o servidor tem um
 * relógio confiável e só ele vê todas as tentativas. O cliente propõe duas
 * escritas, nesta ordem:
 *
 *   1. somar 1 ao contador da janela corrente;
 *   2. se a primeira foi recusada, começar uma janela nova.
 *
 * A segunda é uma **pergunta ao servidor**, não um contorno: a rule só aceita
 * reiniciar a janela depois que ela venceu. Se as duas forem recusadas, o
 * limite está valendo de verdade. Perguntar em vez de calcular a janela aqui é
 * o que impede que o relógio errado de uma máquina de laboratório — o problema
 * que a task 02 documentou — bloqueie um aluno que não fez nada.
 *
 * O documento também guarda `pinTentado`: é ele que amarra cada consulta ao
 * índice a uma tentativa contada. Sem a amarra, o contador seria decoração e a
 * rule deixaria varrer o índice de PINs à vontade.
 *
 * @param {string} uid
 * @param {string} pin PIN digitado, já normalizado.
 * @throws {ErroDeSala} quando o limite está valendo.
 */
export async function registrarTentativa(uid, pin) {
  const referencia = referenciaDaTentativa(uid);
  const anterior = await getDoc(referencia);
  const comum = { pinTentado: pin, ultimaTentativaEm: carimboServidor() };

  if (!anterior.exists()) {
    await setDoc(referencia, { ...comum, tentativas: 1, janelaIniciadaEm: carimboServidor() });
    return;
  }

  try {
    await updateDoc(referencia, {
      ...comum,
      tentativas: (Number(anterior.data().tentativas) || 0) + 1,
    });
    return;
  } catch (erro) {
    if (!ehRecusaDoServidor(erro)) throw erro;
  }

  try {
    await updateDoc(referencia, {
      ...comum,
      tentativas: 1,
      janelaIniciadaEm: carimboServidor(),
    });
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) throw new ErroDeSala(ERRO_DE_LIMITE);
    throw erro;
  }
}

/**
 * Traduz a sala apontada por um PIN, ou `null`.
 *
 * A leitura é de um documento específico — `get`, nunca `list` —, e a rule
 * ainda exige a tentativa recém-contada. Recusa vira `null` pelo mesmo motivo
 * que "não existe": a tela não pode distinguir os dois casos (AC-SALA-04).
 */
async function salaDoPin(pin) {
  try {
    const indice = await getDoc(doc(db, COLECAO_DO_INDICE, pin));

    if (!indice.exists()) return null;

    const { salaId, ativo } = indice.data();

    return ativo === true && salaId ? salaId : null;
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) return null;
    throw erro;
  }
}

/**
 * O papel de uma pessoa dentro da sala, ou `null` se ela não é membro.
 *
 * Ser professor no SENAI não é ser professor **desta** sala: o papel global
 * vem do `AuthContext`, e este aqui vem do vínculo (AC-SEC-02).
 *
 * @param {string} salaId
 * @param {string} uid
 * @returns {Promise<'aluno'|'professor'|null>}
 */
export async function lerPapelNaSala(salaId, uid) {
  try {
    const membro = await getDoc(referenciaDoMembro(salaId, uid));

    return membro.exists() ? membro.data().papel || PAPEL_DE_ALUNO : null;
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) return null;
    throw erro;
  }
}

/**
 * Entra numa sala pelo PIN (AC-SALA-04, AC-SALA-06, AC-SALA-12).
 *
 * Quem confere o PIN é o servidor: a rule de `membros` refaz o resumo com o
 * sal da sala e compara com o segredo, que o aluno não lê. Por isso a recusa
 * chega aqui como `permission-denied` e sai como a mesma frase de "PIN
 * inválido" — o cliente não sabe, e não deve saber, se o PIN existe em outra
 * sala, se foi regerado ou se a sala foi arquivada.
 *
 * @param {string} pinDigitado o que o aluno digitou.
 * @param {{uid: string, nome: string, email?: string}} pessoa
 * @returns {Promise<{salaId: string, jaEraMembro: boolean}>}
 * @throws {ErroDeSala} sempre com mensagem pronta para a tela.
 */
export async function entrarComPin(pinDigitado, pessoa) {
  const pin = normalizarPin(pinDigitado);

  // Formato errado não chega a consultar nada, e por isso não gasta tentativa:
  // não há o que um PIN de cinco dígitos revelasse sobre as salas existentes.
  if (!ehPinValido(pin)) throw new ErroDeSala(ERRO_DE_PIN);

  await registrarTentativa(pessoa.uid, pin);

  const salaId = await salaDoPin(pin);
  if (!salaId) throw new ErroDeSala(ERRO_DE_PIN);

  // Quem já é membro não reescreve o vínculo: a rule de `membros` só permite
  // `create`, e reentrar não pode reiniciar a data de entrada de ninguém.
  if (await lerPapelNaSala(salaId, pessoa.uid)) {
    return { salaId, jaEraMembro: true };
  }

  try {
    await registrarVinculo(salaId, pessoa, PAPEL_DE_ALUNO);
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) throw new ErroDeSala(ERRO_DE_PIN);
    throw erro;
  }

  return { salaId, jaEraMembro: false };
}


// --- gestão da sala ---------------------------------------------------------

/**
 * Sorteia um PIN novo e invalida o anterior (AC-SALA-09).
 *
 * A invalidação não apaga nada: ela acontece porque o resumo gravado passa a
 * ser o do número novo, e a rule confere o PIN digitado contra esse resumo. O
 * documento de índice do PIN antigo continua existindo e continua apontando
 * para a sala — e não serve para entrar, porque o resumo não confere mais.
 *
 * Apagar o índice antigo seria o desenho ideal, e ele é impossível de propósito:
 * localizar aquele documento exigiria conhecer o número antigo, e o sistema
 * inteiro é construído para que ninguém — nem o servidor — o guarde em claro
 * (AC-SEC-05).
 *
 * @param {string} salaId
 * @returns {Promise<string>} o PIN novo, que o professor vê uma vez.
 */
export function regerarPin(salaId) {
  return definirPin(salaId);
}

/**
 * Tira um aluno da sala (AC-SALA-09).
 *
 * O espelho em `usuarios/{uid}/salas` fica: ninguém escreve no documento de
 * outra pessoa, nem o professor. Ele deixa de levar a lugar nenhum assim que o
 * vínculo some — a leitura da sala passa a ser negada —, e a lista de salas do
 * aluno o descarta por isso.
 *
 * @param {string} salaId
 * @param {string} uid
 */
export async function removerMembro(salaId, uid) {
  await deleteDoc(referenciaDoMembro(salaId, uid));
}

/**
 * Remove o aluno e regera o PIN na mesma operação (AC-SALA-09).
 *
 * As duas coisas andam juntas porque separadas não resolvem: o aluno removido
 * ainda tem o PIN anotado no caderno, e entraria de novo em dez segundos.
 *
 * @param {string} salaId
 * @param {string} uid
 * @returns {Promise<string>} o PIN novo, para o professor repassar à turma.
 */
export async function removerMembroERegerarPin(salaId, uid) {
  await removerMembro(salaId, uid);

  return regerarPin(salaId);
}

/**
 * Arquiva a sala ao fim do ano letivo (AC-SALA-10).
 *
 * Arquivada não é apagada: os chamados e a conversa continuam legíveis para
 * quem já era membro. O que as rules passam a negar é toda escrita nova e toda
 * entrada nova.
 *
 * @param {string} salaId
 */
export async function arquivarSala(salaId) {
  await updateDoc(referenciaDaSala(salaId), {
    ativa: false,
    arquivadaEm: carimboServidor(),
  });
}

// --- leitura ----------------------------------------------------------------

/**
 * Lê o documento da sala, ou `null` quando ele não existe ou é negado.
 *
 * Recusa vira `null` de propósito: para a tela, "fui removido da sala" e "a
 * sala não existe" são a mesma coisa — em nenhum dos dois casos há o que
 * mostrar, e distinguir os dois não ajudaria ninguém (AC-SEC-02).
 *
 * @param {string} salaId
 * @returns {Promise<object|null>}
 */
export async function lerSala(salaId) {
  try {
    const documento = await getDoc(referenciaDaSala(salaId));

    return documento.exists() ? { salaId, ...documento.data() } : null;
  } catch (erro) {
    if (ehRecusaDoServidor(erro)) return null;
    throw erro;
  }
}

/**
 * As pessoas da sala, com teto (AC-SALA-08, AC-PERF-03).
 *
 * Só quem já é membro consegue ler esta coleção — é a rule que garante isso,
 * não este código. O teto existe pela mesma razão do teto da fila: 40 alunos é
 * o alvo, 60 é a folga, e uma leitura sem corte é uma conta que ninguém fez.
 *
 * @param {string} salaId
 * @returns {Promise<Array<object>>}
 */
export async function listarMembros(salaId) {
  const consulta = query(colecaoDeMembros(salaId), limit(LIMITE_DE_MEMBROS));
  const snapshot = await getDocs(consulta);

  return snapshot.docs.map((documento) => ({ uid: documento.id, ...documento.data() }));
}

/** Quantas pessoas estão na sala, com teto (AC-SALA-08, AC-PERF-03). */
export async function contarMembros(salaId) {
  const consulta = query(colecaoDeMembros(salaId), limit(LIMITE_DE_MEMBROS + 1));

  return (await getDocs(consulta)).size;
}

/**
 * Quantos chamados da sala ainda não foram atendidos (AC-SALA-08).
 *
 * Conta documentos em vez de manter um contador desnormalizado na sala. O
 * contador seria mais barato e seria mentira: mantê-lo honesto exigiria que
 * cada aluno pudesse escrever no documento da sala ao abrir um chamado — e
 * quem pode somar 1 pode somar 500. Com 40 alunos e teto de 200 chamados, a
 * conta cabe folgada no plano gratuito (AC-PERF-06).
 */
export async function contarChamadosAbertos(salaId) {
  const consulta = query(
    colecaoDeChamados(salaId),
    where('atendido', '==', false),
    limit(LIMITE_DE_CHAMADOS + 1)
  );

  return (await getDocs(consulta)).size;
}

/**
 * Os dados de uma sala para o cartão da lista (AC-SALA-08).
 *
 * @param {string} salaId
 * @param {{comContagens?: boolean}} [opcoes] contagens custam duas consultas a
 *   mais, e só o dono da sala precisa delas.
 * @returns {Promise<object|null>} `null` quando a sala não é alcançável.
 */
export async function carregarDetalhesDaSala(salaId, { comContagens = false } = {}) {
  const sala = await lerSala(salaId);
  if (!sala) return null;
  if (!comContagens) return sala;

  const [totalMembros, chamadosAbertos] = await Promise.all([
    contarMembros(salaId),
    contarChamadosAbertos(salaId),
  ]);

  return { ...sala, totalMembros, chamadosAbertos };
}

/**
 * Escuta as salas de uma pessoa, pelo espelho (AC-SALA-06, AC-PERF-03).
 *
 * O espelho existe para que esta consulta seja possível: a autoridade sobre
 * quem é membro é `salas/{salaId}/membros/{uid}`, e perguntar "de quais salas
 * eu sou membro?" a partir dali exigiria varrer as salas de todo mundo.
 *
 * @param {string} uid
 * @param {(salas: Array<object>) => void} aoMudar
 * @returns {() => void} cancela a inscrição (AC-PERF-04).
 */
export function observarSalasDoUsuario(uid, aoMudar) {
  const consulta = query(
    collection(db, 'usuarios', uid, COLECAO_DE_SALAS),
    limit(LIMITE_DE_SALAS)
  );

  return onSnapshot(consulta, (snapshot) => {
    aoMudar(snapshot.docs.map((documento) => ({ salaId: documento.id, ...documento.data() })));
  });
}
