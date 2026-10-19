// As premiações do professor — AC-PERK-01, AC-PERK-03, AC-PERK-06, AC-PERK-10.
//
// Única porta entre a interface e `salas/{salaId}/perks`. Nenhum componente
// monta consulta e nenhum componente decide permissão: quem decide permissão
// de verdade é a Security Rule, e o que este módulo faz é falhar antes, em
// português, no caso comum.
//
// Duas decisões moram aqui e não podem morar num componente.
//
// **A premiação e o registro dela são uma escrita só.** O AC-PERK-10 pede um
// log de auditoria, e um log escrito *depois* do perk pode não ser escrito
// nunca: a rede do laboratório cai no meio da aula, a aba fecha, o servidor
// recusa a segunda escrita. Um perk sem evento é um privilégio sem dono
// declarado — que é exatamente o que a auditoria existe para impedir. Por isso
// `writeBatch`: ou as duas escritas acontecem, ou nenhuma acontece.
//
// **A validade é calculada a partir do instante do servidor.** `expiraEm` sai
// de `agoraDoServidor()`, não de `new Date()`, pela mesma razão que o carimbo
// da fila: o relógio da máquina do professor não é mais confiável do que o do
// aluno (AC-TEMPO-01, AC-PERK-03).
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLECAO_DE_SALAS } from './salas';
import { carimboServidor, paraData } from './tempo';
import { NIVEL_MAXIMO, TIPOS_DE_PERK, perkEstaAtivo } from './filaChamados';

export const COLECAO_DE_PERKS = 'perks';
export const COLECAO_DE_AUDITORIA = 'auditoriaPerks';

/**
 * Quantos perks a sala carrega de uma vez (AC-PERF-03, AC-PERF-06).
 *
 * A consulta é **uma por sessão**, não uma por chamado renderizado: com 200
 * cards na tela, o segundo desenho custaria 200 leituras por abertura do app.
 * O índice fica em memória e a fila o consulta em O(1).
 *
 * 120 cobre o alvo declarado com folga — 40 alunos, alguns perks cada, um ano
 * letivo. Os mais novos vêm primeiro, então o que o corte descarta é sempre
 * premiação velha, que já não vale para a fila.
 */
export const LIMITE_DE_PERKS = 120;

/** O teto da justificativa, igual ao da Security Rule. */
export const TAMANHO_MAXIMO_DA_JUSTIFICATIVA = 280;

/** As validades que o painel do professor oferece. `null` = permanente. */
export const VALIDADES_EM_DIAS = [1, 7, 30];

/** As ações que a auditoria registra (AC-PERK-10). */
export const ACAO_CONCEDER = 'conceder';
export const ACAO_REVOGAR = 'revogar';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

/** Falha de perk já em português, pronta para a tela. */
export class ErroDePerk extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = 'ErroDePerk';
  }
}

/** Nome legível de cada tipo, para a insígnia e para a auditoria. */
export const ROTULO_DO_TIPO = {
  prioridade: 'Prioridade no Atendimento',
  destaque: 'Destaque da Aula',
  colaborador: 'Colaborador',
  resolvedor: 'Resolvedor',
};

/** O rótulo do tipo, ou o próprio tipo se ele for de uma versão mais nova. */
export function rotuloDoTipo(tipo) {
  return ROTULO_DO_TIPO[tipo] || tipo || 'Premiação';
}

// --- caminhos ---------------------------------------------------------------

/** A coleção de perks da sala. */
export function colecaoDePerks(salaId) {
  return collection(db, COLECAO_DE_SALAS, salaId, COLECAO_DE_PERKS);
}

/** A coleção de eventos de auditoria da sala (AC-PERK-10). */
export function colecaoDeAuditoria(salaId) {
  return collection(db, COLECAO_DE_SALAS, salaId, COLECAO_DE_AUDITORIA);
}

// --- validação --------------------------------------------------------------

function texto(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

/**
 * Valida o que o painel do professor enviou (AC-PERK-01).
 *
 * A mesma validação existe na rule, e as duas precisam existir: a daqui dá a
 * frase em português antes de a requisição sair; a de lá é a que vale mesmo
 * com o cliente adulterado.
 *
 * @param {{tipo: string, nivel: number, justificativa?: string|null,
 *   validadeEmDias?: number|null, anunciarParaSala?: boolean}} dados
 * @returns {{tipo: string, nivel: number, justificativa: string|null,
 *   validadeEmDias: number|null, anunciarParaSala: boolean}}
 * @throws {ErroDePerk} com a mensagem que a tela exibe.
 */
export function validarConcessao(dados = {}) {
  const { tipo, nivel, justificativa, validadeEmDias = null, anunciarParaSala = false } = dados;

  if (!TIPOS_DE_PERK.includes(tipo)) {
    throw new ErroDePerk('Escolha um tipo de premiação da lista.');
  }

  const nivelNumero = Number(nivel);

  if (!Number.isInteger(nivelNumero) || nivelNumero < 1 || nivelNumero > NIVEL_MAXIMO) {
    throw new ErroDePerk(`O nível da premiação precisa ser de 1 a ${NIVEL_MAXIMO}.`);
  }

  const justificativaLimpa = texto(justificativa);

  if (justificativaLimpa.length > TAMANHO_MAXIMO_DA_JUSTIFICATIVA) {
    throw new ErroDePerk(
      `A justificativa precisa ter até ${TAMANHO_MAXIMO_DA_JUSTIFICATIVA} caracteres.`
    );
  }

  if (validadeEmDias !== null && validadeEmDias !== undefined) {
    const dias = Number(validadeEmDias);

    if (!Number.isFinite(dias) || dias <= 0) {
      throw new ErroDePerk('A validade precisa ser um número de dias maior que zero.');
    }
  }

  return {
    tipo,
    nivel: nivelNumero,
    justificativa: justificativaLimpa === '' ? null : justificativaLimpa,
    validadeEmDias:
      validadeEmDias === null || validadeEmDias === undefined ? null : Number(validadeEmDias),
    anunciarParaSala: Boolean(anunciarParaSala),
  };
}

/**
 * A data de expiração, contada a partir do instante do **servidor**.
 *
 * `concedidoEm` é carimbado pelo servidor e `expiraEm` não pode ser — o
 * Firestore não resolve aritmética sobre o sentinela. O que sobra é o melhor
 * instante que o cliente consegue provar, que é o piso de `agoraDoServidor()`.
 * A conta erra no máximo pela latência da escrita, e o erro é de segundos numa
 * validade contada em dias.
 *
 * Devolve `Timestamp` e não `Date`: o SDK converteria de qualquer forma, mas a
 * rule cobra `expiraEm is timestamp`, e deixar a conversão implícita esconde
 * essa exigência de quem lê o código.
 */
function calcularExpiracao(validadeEmDias, agoraServidor) {
  if (validadeEmDias === null) return null;

  const agora = paraData(agoraServidor);

  if (!agora) {
    throw new ErroDePerk(
      'Não foi possível confirmar o horário do servidor. Recarregue a sala e tente de novo.'
    );
  }

  return Timestamp.fromDate(new Date(agora.getTime() + validadeEmDias * UM_DIA_EM_MS));
}

// --- escrita ----------------------------------------------------------------

/** O corpo de um evento de auditoria (AC-PERK-10). */
function eventoDeAuditoria(acao, { perkId, alunoUid, ator, detalhes }) {
  return {
    acao,
    perkId,
    alunoUid,
    atorUid: ator.uid,
    em: carimboServidor(),
    detalhes: detalhes || null,
  };
}

/**
 * Concede um perk a um aluno da sala e registra o evento (AC-PERK-01).
 *
 * As duas escritas vão no mesmo `writeBatch` de propósito: o lote é atômico no
 * servidor, então não existe estado intermediário em que a premiação existe e
 * o registro dela não. Ver o cabeçalho do arquivo.
 *
 * @param {string} salaId
 * @param {{uid: string, nome: string}} aluno o premiado.
 * @param {{uid: string, nome: string}} professor quem concede.
 * @param {object} dados o que o painel enviou, mais `agoraServidor`.
 * @returns {Promise<{perkId: string}>}
 * @throws {ErroDePerk} quando a concessão é inválida — sem tocar no banco.
 */
export async function concederPerk(salaId, aluno, professor, dados = {}) {
  const validados = validarConcessao(dados);
  const expiraEm = calcularExpiracao(validados.validadeEmDias, dados.agoraServidor);

  const referencia = doc(colecaoDePerks(salaId));
  const lote = writeBatch(db);

  lote.set(referencia, {
    alunoUid: aluno.uid,
    alunoNome: aluno.nome,
    tipo: validados.tipo,
    nivel: validados.nivel,
    justificativa: validados.justificativa,
    anunciarParaSala: validados.anunciarParaSala,
    concedidoPor: professor.uid,
    concedidoPorNome: professor.nome,
    concedidoEm: carimboServidor(),
    expiraEm,
    revogadoEm: null,
    visualizadoEm: null,
  });

  lote.set(
    doc(colecaoDeAuditoria(salaId)),
    eventoDeAuditoria(ACAO_CONCEDER, {
      perkId: referencia.id,
      alunoUid: aluno.uid,
      ator: professor,
      detalhes: `${rotuloDoTipo(validados.tipo)} nível ${validados.nivel}`,
    })
  );

  await lote.commit();

  return { perkId: referencia.id };
}

/**
 * Revoga um perk e registra o evento (AC-PERK-07, AC-PERK-10).
 *
 * Revogar é um campo, não uma deleção: o perk continua na vitrine do aluno,
 * na coluna do histórico. Apagá-lo reescreveria o passado da turma — e o
 * `delete` está negado na rule justamente por isso.
 *
 * Recebe o **documento** do perk, e não só o id: o evento de auditoria precisa
 * nomear o aluno, e a rule cobra isso (`alunoUid is string`). Com o id sozinho,
 * a revogação seria recusada pelo servidor — e só em produção, porque o fake
 * dos testes unitários não aplica rules.
 *
 * @param {string} salaId
 * @param {{id: string, alunoUid: string}} perk o perk como foi lido da sala.
 * @param {{uid: string, nome: string}} professor
 * @param {string} [motivo] vai para `detalhes` do evento.
 */
export async function revogarPerk(salaId, perk, professor, motivo) {
  const lote = writeBatch(db);

  lote.update(doc(colecaoDePerks(salaId), perk.id), { revogadoEm: carimboServidor() });

  lote.set(
    doc(colecaoDeAuditoria(salaId)),
    eventoDeAuditoria(ACAO_REVOGAR, {
      perkId: perk.id,
      alunoUid: perk.alunoUid,
      ator: professor,
      detalhes: motivo || null,
    })
  );

  await lote.commit();
}

/**
 * Grava o recibo que impede a animação de repetir (AC-PERK-04).
 *
 * A falha é engolida de propósito. A restrição da task é explícita: a animação
 * não pode bloquear o uso do app. Se a escrita do recibo for recusada, o preço
 * é a animação tocar de novo no próximo carregamento — muito mais barato do
 * que uma tela travada no meio da aula.
 *
 * @param {string} salaId
 * @param {string} perkId
 * @returns {Promise<boolean>} se o recibo foi gravado.
 */
export async function marcarPerkVisualizado(salaId, perkId) {
  const lote = writeBatch(db);

  lote.update(doc(colecaoDePerks(salaId), perkId), { visualizadoEm: carimboServidor() });

  try {
    await lote.commit();
    return true;
  } catch (erro) {
    console.warn('[perks] Não foi possível registrar a visualização da premiação.', erro);
    return false;
  }
}

// --- leitura ----------------------------------------------------------------

/**
 * Escuta os perks da sala, com teto (AC-PERF-03, AC-PERF-04).
 *
 * Os mais novos primeiro: o que o corte descarta é premiação velha, que já não
 * pesa na fila. A expiração **não** entra na consulta — `where('expiraEm', '>',
 * agora)` deixaria de fora justamente os perks permanentes, cujo `expiraEm` é
 * nulo, e ainda devolveria o filtro ao relógio do cliente. Quem julga validade
 * é `perkEstaAtivo`, contra o instante do servidor.
 *
 * @param {string|null} salaId sem sala não há perk: ele vive dentro da sala.
 * @param {(perks: Array<object>) => void} aoMudar
 * @returns {() => void} cancela a inscrição.
 */
export function observarPerksDaSala(salaId, aoMudar) {
  if (!salaId) return () => {};

  const consulta = query(
    colecaoDePerks(salaId),
    orderBy('concedidoEm', 'desc'),
    limit(LIMITE_DE_PERKS)
  );

  return onSnapshot(consulta, (snapshot) => {
    aoMudar(snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() })));
  });
}

/**
 * Os perks de uma pessoa, entre os da sala.
 *
 * @param {Array<object>} perks
 * @param {string|null} uid
 * @returns {Array<object>}
 */
export function perksDoAluno(perks = [], uid) {
  if (!uid) return [];

  return perks.filter((perk) => perk.alunoUid === uid);
}

/**
 * Separa a vitrine em "vale agora" e "já valeu" (AC-PERK-06).
 *
 * O vencido não some: a premiação de março continua tendo acontecido em
 * novembro. O que muda é a coluna.
 *
 * @param {Array<object>} perks
 * @param {Date|import('firebase/firestore').Timestamp|string|null} agoraServidor
 * @returns {{ativos: Array<object>, expirados: Array<object>}}
 */
export function separarConquistas(perks = [], agoraServidor) {
  return perks.reduce(
    (colunas, perk) => {
      colunas[perkEstaAtivo(perk, agoraServidor) ? 'ativos' : 'expirados'].push(perk);
      return colunas;
    },
    { ativos: [], expirados: [] }
  );
}

/**
 * Os carimbos que o app já viu do servidor, para o piso de `agoraDoServidor`.
 *
 * Junta o que chegou dos chamados e o que chegou dos perks: quanto mais
 * escritas recentes a sala tem, mais apertado fica o piso e menos espaço sobra
 * para um relógio atrasado esticar um perk vencido (ver `services/tempo.js`).
 *
 * @param {Array<object>} chamados
 * @param {Array<object>} perks
 * @returns {Array<unknown>}
 */
export function carimbosConhecidos(chamados = [], perks = []) {
  return [
    ...chamados.map((chamado) => chamado.horario),
    ...perks.map((perk) => perk.concedidoEm),
  ];
}
