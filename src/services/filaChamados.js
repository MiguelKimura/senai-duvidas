// A ordem da fila de chamados — AC-PERK-09, AC-PERK-02, AC-CHAMADO-03.
//
// Função pura, sem Firestore e sem relógio. Tudo o que decide a ordem entra
// por parâmetro, inclusive o instante do servidor — e é por isso que cada
// regra abaixo pode ser verificada isoladamente.
//
// Até a v0.8.0 as duas telas faziam `problemasList.sort(criarComparadorPorHorario())`
// e a fila era uma coisa só: horário crescente. Com perks ela passa a ter
// faixas, e a ordem dentro de cada faixa continua sendo exatamente a de antes.
// Sala sem perk nenhum — que é toda sala da v0.8.0 — produz a mesma lista.
import { criarComparadorPorHorario, paraData } from './tempo';

/**
 * Os tipos de perk que o professor pode conceder.
 *
 * Só `prioridade` mexe na fila. Os outros três são reconhecimento, e é
 * deliberado que sejam: se toda premiação furasse a fila, o professor não
 * teria como elogiar quem ajudou um colega sem, de quebra, atrasar o
 * atendimento de outra pessoa.
 */
export const TIPO_PRIORIDADE = 'prioridade';
export const TIPO_DESTAQUE = 'destaque';
export const TIPO_COLABORADOR = 'colaborador';
export const TIPO_RESOLVEDOR = 'resolvedor';

export const TIPOS_DE_PERK = [
  TIPO_PRIORIDADE,
  TIPO_DESTAQUE,
  TIPO_COLABORADOR,
  TIPO_RESOLVEDOR,
];

/** A faixa de quem não tem perk de prioridade ativo. */
export const NIVEL_SEM_PERK = 0;

/** O teto de nível de um perk, igual ao da Security Rule. */
export const NIVEL_MAXIMO = 3;

/**
 * Lê uma entrada do índice de perks, aceitando `Map` e objeto puro.
 *
 * O `Map` é o que `indexarPerksPorUid` devolve; o objeto puro é o que um teste
 * — ou um cliente futuro — escreveria à mão. Aceitar os dois custa três linhas
 * e evita que a forma do índice vire um detalhe que o chamador precise saber.
 */
function perksDe(indice, uid) {
  if (!uid || !indice) return [];

  const encontrados = typeof indice.get === 'function' ? indice.get(uid) : indice[uid];

  if (!encontrados) return [];

  return Array.isArray(encontrados) ? encontrados : [encontrados];
}

/**
 * O perk vale agora, pelo relógio do **servidor** (AC-PERK-03).
 *
 * `agoraServidor` é parâmetro, e não `new Date()`, porque o relógio das
 * máquinas de laboratório é justamente o que a task 02 documentou não ser
 * confiável. Com `new Date()` aqui, atrasar o relógio do Windows manteria vivo
 * um perk de prioridade vencido — e a fila passaria a premiar quem mexe no
 * painel de controle.
 *
 * Sem instante de referência legível, o perk **com validade** não conta. A
 * escolha é conservadora de propósito: na dúvida, o sistema não concede
 * privilégio. Perk permanente (`expiraEm: null`) não depende de relógio nenhum
 * e continua valendo.
 *
 * @param {object} perk documento de `salas/{salaId}/perks`.
 * @param {Date|import('firebase/firestore').Timestamp|string|null} agoraServidor
 * @returns {boolean}
 */
export function perkEstaAtivo(perk, agoraServidor) {
  if (!perk) return false;
  if (perk.revogadoEm) return false;

  const expira = paraData(perk.expiraEm);
  if (!expira) return true;

  const agora = paraData(agoraServidor);
  if (!agora) return false;

  return expira.getTime() > agora.getTime();
}

/**
 * A faixa de prioridade de um aluno: o maior nível entre os perks ativos.
 *
 * Maior, e não soma: somar transformaria três perks de nível 1 num nível 3, e
 * o professor perderia o controle da escala que ele mesmo definiu.
 *
 * @param {Array<object>} perksDoAluno
 * @param {Date|import('firebase/firestore').Timestamp|string|null} agoraServidor
 * @returns {number} de 0 (sem perk) até `NIVEL_MAXIMO`.
 */
export function nivelDePrioridade(perksDoAluno = [], agoraServidor) {
  return perksDoAluno.reduce((maior, perk) => {
    if (perk.tipo !== TIPO_PRIORIDADE) return maior;
    if (!perkEstaAtivo(perk, agoraServidor)) return maior;

    const nivel = Number(perk.nivel);

    return Number.isFinite(nivel) && nivel > maior ? nivel : maior;
  }, NIVEL_SEM_PERK);
}

/**
 * Agrupa os perks de uma sala por aluno, para consulta em O(1) na ordenação.
 *
 * É o que cumpre o AC-PERF-03 do lado do cliente: a sala carrega os perks
 * **uma vez** e a fila os consulta em memória, em vez de uma leitura por card
 * renderizado — que, com 200 chamados na tela, seriam 200 leituras por
 * abertura do app.
 *
 * @param {Array<object>} perks
 * @returns {Map<string, Array<object>>}
 */
export function indexarPerksPorUid(perks = []) {
  const indice = new Map();

  perks.forEach((perk) => {
    if (!perk || !perk.alunoUid) return;

    const atuais = indice.get(perk.alunoUid);

    if (atuais) atuais.push(perk);
    else indice.set(perk.alunoUid, [perk]);
  });

  return indice;
}

/**
 * Compara dois ids de chamado de forma idêntica em todo dispositivo.
 *
 * `localeCompare` seria a escolha natural e está errada aqui: o resultado dele
 * depende da tabela do ICU embarcada no navegador, então o Chrome do
 * laboratório e o Firefox do professor podem discordar sobre dois ids. A
 * comparação crua por ponto de código não depende de nada e é a mesma em toda
 * máquina — que é exatamente o que o AC-PERK-09 pede.
 */
function compararIds(a, b) {
  const esquerda = String((a && a.id) || '');
  const direita = String((b && b.id) || '');

  if (esquerda === direita) return 0;

  return esquerda < direita ? -1 : 1;
}

/**
 * O chamado já foi atendido.
 *
 * Ausência do campo é "não atendido", e não "desconhecido": `atendido` nasceu
 * na v0.5.0, e nenhum chamado da v0.1.0 o tem. Tratá-lo como atendido jogaria
 * a fila inteira de antes da migração para o rodapé da tela.
 */
function estaAtendido(chamado) {
  return Boolean(chamado && chamado.atendido === true);
}

/**
 * Ordena a fila de chamados da sala (AC-PERK-09, AC-CHAMADO-03).
 *
 * A ordem, nesta sequência exata:
 *
 *   1. não atendidos antes dos atendidos;
 *   2. prioridade do autor, **decrescente** — sem perk ativo é a faixa 0;
 *   3. horário do **servidor**, crescente — o mais antigo primeiro, dentro da
 *      faixa. Quem ainda não tem carimbo confirmado vai para o fim da faixa,
 *      comportamento herdado de `criarComparadorPorHorario` (AC-TEMPO-06);
 *   4. id do chamado, crescente — o desempate que garante ordem idêntica em
 *      todos os dispositivos mesmo com carimbos iguais.
 *
 * Sobre o passo 3 e o pendente: ele vai para o fim da **faixa**, não para o fim
 * da lista. A faixa é decidida pelo perk, que já é conhecido no instante em que
 * o card aparece; o que ainda não se sabe é a posição dentro dela. Mandá-lo
 * para o rodapé da tela e trazê-lo de volta meio segundo depois faria o card
 * de quem acabou de enviar atravessar a fila duas vezes.
 *
 * O passo 3 é literalmente o comparador da task 02: ele já aceita um critério
 * anterior, e os passos 1 e 2 são esse critério. Reescrever a comparação de
 * horário aqui duplicaria a leitura dupla de `Timestamp`/string ISO que aquele
 * módulo resolve — e as duas cópias divergiriam na primeira correção.
 *
 * @param {Array<object>} chamados documentos de `salas/{salaId}/chamados`.
 * @param {Map<string, Array<object>>|object} [perksAtivosPorUid] índice de
 *   `indexarPerksPorUid`. Vazio = a fila da v0.8.0, sem perk nenhum.
 * @param {Date|import('firebase/firestore').Timestamp|string|null} [agoraServidor]
 *   instante do servidor para a checagem de expiração (AC-PERK-03).
 * @returns {Array<object>} lista nova, ordenada. A recebida não é tocada.
 */
export function ordenarFila(
  chamados = [],
  perksAtivosPorUid = new Map(),
  agoraServidor = null
) {
  const prioridadeDe = (chamado) =>
    nivelDePrioridade(perksDe(perksAtivosPorUid, chamado && chamado.autorUid), agoraServidor);

  // O perk não resgata chamado já atendido: mantê-lo no topo empurraria para
  // baixo quem ainda está esperando, que é o contrário do que o professor quis.
  const porAtendimento = (a, b) => Number(estaAtendido(a)) - Number(estaAtendido(b));
  const porPrioridadeDesc = (a, b) => prioridadeDe(b) - prioridadeDe(a);

  const porFaixa = (a, b) => porAtendimento(a, b) || porPrioridadeDesc(a, b);
  const porHorario = criarComparadorPorHorario(porFaixa);

  return [...chamados].sort((a, b) => porHorario(a, b) || compararIds(a, b));
}
