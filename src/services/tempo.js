// A única fonte de horário do app — AC-TEMPO-01 a AC-TEMPO-09.
//
// Todo horário que entra ou sai deste sistema passa por aqui. Nenhum
// componente formata data por conta própria e nenhum componente lê o relógio
// para gravar: quem carimba a escrita é o servidor do Firestore.

/** @typedef {import('firebase/firestore').Timestamp} Timestamp */

/**
 * O fuso oficial da aplicação, pelo identificador IANA.
 *
 * Não é offset fixo de propósito. O horário de verão brasileiro está suspenso
 * desde 2019, mas a suspensão é um decreto, não uma lei da física: se voltar,
 * um `-03:00` escrito à mão passa a errar em silêncio durante quatro meses por
 * ano. `Intl` resolve a conversão pela base IANA, que é atualizada junto com o
 * navegador.
 */
export const FUSO_BRASILIA = 'America/Sao_Paulo';

/** O que a tela mostra enquanto o `serverTimestamp()` não voltou do servidor. */
export const ROTULO_PENDENTE = 'enviando…';

/** O que a tela mostra quando o documento simplesmente não tem horário. */
export const ROTULO_SEM_HORARIO = '—';

/** Um `Date` que o motor conseguiu construir de verdade. */
function ehDataValida(data) {
  return data instanceof Date && !Number.isNaN(data.getTime());
}

/**
 * Converte qualquer formato de `horario` já gravado no banco em `Date`.
 *
 * É a leitura dupla exigida pelo AC-TEMPO-08: convivem no banco documentos da
 * v0.1.0, com `horario` em string ISO, e documentos novos, com `Timestamp` do
 * servidor. Nenhum dos dois é convertido no banco — os dois são entendidos
 * aqui, permanentemente nesta versão.
 *
 * A checagem do `Timestamp` é por `toDate`, não por `instanceof`: o SDK do
 * Firebase é carregado em mais de um lugar (app, mock de teste, cache), e
 * `instanceof` falha em silêncio quando as classes vêm de módulos diferentes.
 *
 * @param {Timestamp|string|Date|null|undefined} valor valor lido do documento.
 * @returns {Date|null} `null` quando não há data legível — inclusive para o
 *   sentinela de `serverTimestamp()` que o servidor ainda não resolveu.
 */
export function paraData(valor) {
  if (valor === null || valor === undefined) return null;

  if (valor instanceof Date) return ehDataValida(valor) ? valor : null;

  if (typeof valor === 'string' || typeof valor === 'number') {
    const data = new Date(valor);
    return ehDataValida(data) ? data : null;
  }

  if (typeof valor.toDate === 'function') {
    const data = valor.toDate();
    return ehDataValida(data) ? data : null;
  }

  // Um `Timestamp` que passou por JSON — cache do navegador, export, REST —
  // chega como objeto puro, sem método nenhum.
  if (typeof valor.seconds === 'number') {
    return new Date(valor.seconds * 1000 + Math.floor((valor.nanoseconds || 0) / 1e6));
  }

  return null;
}

/**
 * Monta um formatador fixo no fuso de Brasília.
 *
 * `hourCycle: 'h23'` em vez de `hour12: false`: em parte das versões do ICU a
 * segunda forma escreve a meia-noite como `24:00`.
 */
function formatadorEmBrasilia(opcoes) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_BRASILIA,
    hourCycle: 'h23',
    ...opcoes,
  });
}

const FORMATADOR_DATA_HORA = formatadorEmBrasilia({
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const FORMATADOR_HORA = formatadorEmBrasilia({ hour: '2-digit', minute: '2-digit' });

/**
 * Lê as partes de uma data já convertidas para o fuso de Brasília.
 *
 * Montar a string a partir das partes, em vez de usar `format()` direto, é o
 * que garante exatamente `dd/mm/aaaa HH:mm`: o separador entre data e hora
 * varia entre versões do ICU (vírgula, "às", espaço estreito), e o AC-TEMPO-04
 * pede um formato, não uma aproximação dele.
 */
function partesEmBrasilia(formatador, data) {
  return formatador.formatToParts(data).reduce((partes, { type, value }) => {
    partes[type] = value;
    return partes;
  }, {});
}

/**
 * Escolhe o rótulo de um `horario` que não vira data.
 *
 * `null` é escrita em voo: o Firestore entrega o documento local antes de o
 * servidor carimbar, e o campo chega vazio. Campo ausente é outra coisa — é
 * documento antigo —, e chamá-lo de "enviando…" seria mentir para sempre.
 */
function rotuloSemData(valor) {
  return estaPendente(valor) ? ROTULO_PENDENTE : ROTULO_SEM_HORARIO;
}

/**
 * O `horario` é uma escrita que o servidor ainda não confirmou (AC-TEMPO-06).
 *
 * Vale para os dois lados da escrita otimista: o sentinela que acabou de sair
 * de `carimboServidor()` e o `null` que o Firestore devolve no documento local
 * enquanto o carimbo não volta. Campo ausente não conta — não há escrita em voo
 * atrás dele.
 *
 * @param {unknown} valor valor do campo `horario`.
 * @returns {boolean}
 */
export function estaPendente(valor) {
  if (valor === null) return true;
  if (valor === undefined) return false;

  return typeof valor === 'object' && paraData(valor) === null;
}

/**
 * Data e hora em `dd/mm/aaaa HH:mm`, no fuso de Brasília (AC-TEMPO-03/04).
 *
 * @param {Timestamp|string|Date|null|undefined} valor valor lido do documento.
 * @returns {string} o horário formatado, `"enviando…"` enquanto o servidor não
 *   confirmou, ou `"—"` quando não há horário nenhum.
 */
export function formatarDataHora(valor) {
  const data = paraData(valor);
  if (!data) return rotuloSemData(valor);

  const { day, month, year, hour, minute } = partesEmBrasilia(FORMATADOR_DATA_HORA, data);

  return `${day}/${month}/${year} ${hour}:${minute}`;
}

/**
 * Só a hora, em `HH:mm`, no fuso de Brasília — o horário de cada mensagem.
 *
 * @param {Timestamp|string|Date|null|undefined} valor valor lido do documento.
 * @returns {string} a hora formatada, ou o mesmo rótulo de `formatarDataHora`.
 */
export function formatarHora(valor) {
  const data = paraData(valor);
  if (!data) return rotuloSemData(valor);

  const { hour, minute } = partesEmBrasilia(FORMATADOR_HORA, data);

  return `${hour}:${minute}`;
}

/** Um minuto e uma hora em milissegundos, para as contas de `formatarRelativo`. */
const UM_MINUTO = 60 * 1000;
const UMA_HORA = 60 * UM_MINUTO;

/**
 * Rótulo relativo para evento recente, absoluto para o resto (AC-TEMPO-04).
 *
 * O corte de uma hora não é arbitrário: acima disso o relativo para de
 * informar. "Há 47 minutos" e "há 3 horas" ocupam a mesma gaveta na cabeça de
 * quem lê de relance, e o horário absoluto diz mais.
 *
 * Diferença negativa vira "agora mesmo" em vez de "há -2 minutos". Desde que o
 * carimbo passou a vir do servidor e o leitor continua com o relógio da
 * própria máquina, o documento chegar do "futuro" é o caso comum em
 * laboratório, não a exceção.
 *
 * @param {Timestamp|string|Date|null|undefined} valor valor lido do documento.
 * @param {Date} [agora] instante de referência; por padrão, o relógio do leitor
 *   — é leitura de tela, não gravação de dado (ver AC-TEMPO-05).
 * @returns {string}
 */
export function formatarRelativo(valor, agora = new Date()) {
  const data = paraData(valor);
  if (!data) return rotuloSemData(valor);

  const decorrido = agora.getTime() - data.getTime();

  if (decorrido >= UMA_HORA) return formatarDataHora(data);
  if (decorrido < UM_MINUTO) return 'agora mesmo';

  const minutos = Math.floor(decorrido / UM_MINUTO);

  return `há ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`;
}

/**
 * Comparador de dois valores de `horario`, para ordenação crescente.
 *
 * Quem ainda não tem horário legível — pendente de carimbo ou documento sem o
 * campo — vai para o **fim**, e empata com os outros iguais a si. O empate é
 * deliberado: `Array.prototype.sort` é estável, então a ordem de chegada
 * desempata e o card de quem acabou de enviar não fica pulando de posição
 * enquanto o servidor não responde.
 *
 * Subtrair `a.horario - b.horario` direto, como as telas faziam, dá `NaN`
 * quando um dos lados não é número — e um comparador que devolve `NaN` deixa a
 * ordem indefinida, sem erro nenhum na tela.
 *
 * @param {Timestamp|string|Date|null|undefined} a
 * @param {Timestamp|string|Date|null|undefined} b
 * @returns {number} negativo, zero ou positivo, como manda `sort`.
 */
export function comparar(a, b) {
  const esquerda = paraData(a);
  const direita = paraData(b);

  if (esquerda && direita) return esquerda.getTime() - direita.getTime();
  if (esquerda) return -1;
  if (direita) return 1;

  return 0;
}

/**
 * Comparador de documentos pelo campo `horario`, componível.
 *
 * O campo continua se chamando `horario` porque a task 03 vai mover chamados
 * para dentro de `salas/{salaId}`, e migrar nome de campo e forma de dado no
 * mesmo release seria migrar duas coisas de uma vez.
 *
 * @param {(a: object, b: object) => number} [criterioAnterior] ordenação que
 *   vem antes, ex.: prioridade decrescente na task 09. Sem ela, só o horário.
 * @returns {(a: object, b: object) => number} comparador para `sort`.
 */
export function criarComparadorPorHorario(criterioAnterior) {
  return (a, b) => {
    const anterior = criterioAnterior ? criterioAnterior(a, b) : 0;
    if (anterior !== 0) return anterior;

    return comparar(a && a.horario, b && b.horario);
  };
}
