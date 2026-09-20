#!/usr/bin/env node
/*
 * Preenche `horarioIso` onde ele faltar — compatibilidade futura da v0.4.0.
 *
 * Uso:
 *   node scripts/migrar-horarios.js --dry-run            (não grava nada)
 *   node scripts/migrar-horarios.js --confirmar          (grava)
 *   node scripts/migrar-horarios.js --colecao chamados --confirmar
 *
 * POR QUE ESTE SCRIPT EXISTE
 *
 * A v0.4.0 passa a gravar `horario` como `Timestamp` do servidor, que é o
 * único jeito de a fila ter uma ordem que o relógio do aluno não decide. O
 * preço é que um cliente ainda não atualizado, ao fazer `new Date(horario)`
 * nesse valor, recebe `Invalid Date`. O campo aditivo `horarioIso` é a ponte:
 * a mesma data, em string, ao lado — e some só na 1.0.0, quando não houver
 * mais cliente antigo em sala.
 *
 * Em uso normal quem preenche esse campo é o cliente do próprio autor, na
 * confirmação do carimbo (`completarHorariosIso`, em `src/services/tempo.js`).
 * Este script é para o resto: documentos de quem não volta a entrar.
 *
 * REVERSÃO
 *
 * A migração só acrescenta campo. Para desfazê-la, apague `horarioIso` — nada
 * mais depende dele, porque `horario` continua intacto e é ele que ordena a
 * fila. Não há passo de ida sem volta e rodar duas vezes não faz diferença.
 *
 * DESENHO
 *
 * As funções puras abaixo decidem o que fazer e são testadas em
 * `scripts/__tests__/migrar-horarios.test.js`. A casca no fim do arquivo fala
 * com o Firestore e não tem regra nenhuma.
 */

/** O campo aditivo que esta migração preenche. Nunca se escreve em `horario`. */
const CAMPO_DESTINO = 'horarioIso';

/** As coleções que têm `horario` hoje. A task 03 vai mover isso para salas. */
const COLECOES_PADRAO = ['chamados', 'chat'];

/**
 * A mesma leitura dupla de `paraData`, em CommonJS e sem o SDK do navegador.
 *
 * A duplicação é deliberada e está presa por teste: o script roda em Node
 * contra o Admin SDK, e `src/services/tempo.js` é ESM e importa
 * `firebase/firestore`. Importar um do outro arrastaria o app inteiro para
 * dentro de uma ferramenta de operação. O teste
 * `paraDataDoDocumento — a mesma leitura dupla do app` compara os dois lado a
 * lado, formato por formato: se um aprender um caso novo e o outro não, a
 * suíte quebra.
 *
 * @param {object|string|Date|null|undefined} valor valor do campo `horario`.
 * @returns {Date|null} `null` quando não há data legível.
 */
function paraDataDoDocumento(valor) {
  if (valor === null || valor === undefined) return null;

  const valida = (data) => (data instanceof Date && !Number.isNaN(data.getTime()) ? data : null);

  if (valor instanceof Date) return valida(valor);
  if (typeof valor === 'string' || typeof valor === 'number') return valida(new Date(valor));
  if (typeof valor.toDate === 'function') return valida(valor.toDate());

  if (typeof valor.seconds === 'number') {
    return valida(new Date(valor.seconds * 1000 + Math.floor((valor.nanoseconds || 0) / 1e6)));
  }

  return null;
}

/**
 * Decide, sem gravar nada, o que cada documento precisa.
 *
 * Quem já tem `horarioIso` é deixado em paz mesmo que o valor divirja de
 * `horario`. É o que torna a migração idempotente, e é também a escolha
 * conservadora: um valor que já está lá pode ter vindo de uma correção manual,
 * e sobrescrevê-lo seria apagar trabalho de alguém sem avisar.
 *
 * @param {Array<{id: string, dados: object}>} documentos
 * @returns {{total: number, paraGravar: Array<{id: string, horarioIso: string}>,
 *   jaTinham: number, semHorarioLegivel: number}}
 */
function planejar(documentos) {
  const plano = {
    total: documentos.length,
    paraGravar: [],
    jaTinham: 0,
    semHorarioLegivel: 0,
  };

  documentos.forEach(({ id, dados }) => {
    if (dados && dados[CAMPO_DESTINO]) {
      plano.jaTinham += 1;
      return;
    }

    const data = paraDataDoDocumento(dados && dados.horario);

    // Carimbo em voo ou documento sem horário: não há o que derivar, e
    // inventar uma data aqui seria pior do que deixar o campo vazio.
    if (!data) {
      plano.semHorarioLegivel += 1;
      return;
    }

    plano.paraGravar.push({ id, [CAMPO_DESTINO]: data.toISOString() });
  });

  return plano;
}

/**
 * Executa o plano, um documento por vez.
 *
 * Sequencial de propósito: são poucos documentos (o alvo do projeto é 200
 * chamados e 1000 mensagens por sala) e uma rajada de escritas paralelas
 * contra o Firestore gastaria cota sem ganhar nada perceptível.
 *
 * Falha de um documento não interrompe os outros. Uma migração que para no
 * meio deixa o banco num estado que ninguém sabe descrever; esta vai até o
 * fim e devolve a lista do que não deu.
 *
 * @param {object} opcoes
 * @param {Array<{id: string, dados: object}>} opcoes.documentos
 * @param {(id: string, campos: object) => Promise<void>} opcoes.gravar
 * @param {boolean} [opcoes.simulacao] quando true, não grava nada.
 * @param {string} [opcoes.colecao] só para o relatório.
 * @returns {Promise<object>} relatório do que foi feito.
 */
async function migrar({ documentos, gravar, simulacao = false, colecao }) {
  const plano = planejar(documentos);
  const falhas = [];
  let atualizados = 0;

  for (const { id, ...campos } of plano.paraGravar) {
    if (simulacao) {
      atualizados += 1;
      continue;
    }

    try {
      await gravar(id, campos);
      atualizados += 1;
    } catch (erro) {
      falhas.push({ id, erro: erro.message });
    }
  }

  return {
    colecao,
    total: plano.total,
    atualizados,
    jaTinham: plano.jaTinham,
    semHorarioLegivel: plano.semHorarioLegivel,
    falhas,
    simulacao,
  };
}

/**
 * Lê os argumentos da linha de comando.
 *
 * `--confirmar` existe porque o padrão seguro de um script que escreve em
 * produção não pode ser escrever. Sem ele, o script explica o que faria e sai.
 *
 * @param {string[]} argumentos `process.argv.slice(2)`.
 * @returns {{simulacao: boolean, confirmado: boolean, colecoes: string[]}}
 */
function lerOpcoes(argumentos) {
  const posicaoDaColecao = argumentos.indexOf('--colecao');

  return {
    simulacao: argumentos.includes('--dry-run'),
    confirmado: argumentos.includes('--confirmar'),
    colecoes:
      posicaoDaColecao === -1
        ? [...COLECOES_PADRAO]
        : [argumentos[posicaoDaColecao + 1]].filter(Boolean),
  };
}

/**
 * O relatório que a pessoa que rodou o script lê.
 *
 * @param {object} relatorio saída de `migrar`.
 * @returns {string}
 */
function formatarRelatorio(relatorio) {
  const { colecao, total, atualizados, jaTinham, semHorarioLegivel, falhas, simulacao } = relatorio;

  const linhas = [
    `${colecao || 'documentos'}: ${total} lidos`,
    simulacao
      ? `  ${atualizados} receberiam ${CAMPO_DESTINO} (simulação: --dry-run, nada foi gravado)`
      : `  ${atualizados} receberam ${CAMPO_DESTINO}`,
    `  ${jaTinham} já tinham`,
    `  ${semHorarioLegivel} sem horário legível (carimbo em voo ou campo ausente)`,
  ];

  if (falhas.length > 0) {
    linhas.push(`  ${falhas.length} falharam:`);
    falhas.forEach(({ id, erro }) => linhas.push(`    ${id}: ${erro}`));
  }

  return linhas.join('\n');
}

/* c8 ignore start -- casca de I/O: sem regra, e sem como testar sem o Admin SDK */
async function principal(argumentos) {
  const { simulacao, confirmado, colecoes } = lerOpcoes(argumentos);

  if (!simulacao && !confirmado) {
    process.stdout.write(
      'Nada foi feito. Rode com --dry-run para ver o que mudaria, ' +
        'ou com --confirmar para gravar.\n'
    );
    return;
  }

  // Exigido só aqui, e não no topo: o módulo precisa ser carregável pelo teste
  // numa máquina que não tem credencial de administrador nenhuma.
  const admin = require('firebase-admin');

  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();

  for (const colecao of colecoes) {
    const snapshot = await db.collection(colecao).get();
    const documentos = snapshot.docs.map((documento) => ({
      id: documento.id,
      dados: documento.data(),
    }));

    const relatorio = await migrar({
      documentos,
      colecao,
      simulacao,
      gravar: (id, campos) => db.collection(colecao).doc(id).update(campos),
    });

    process.stdout.write(`${formatarRelatorio(relatorio)}\n`);

    if (relatorio.falhas.length > 0) process.exitCode = 1;
  }
}

if (require.main === module) {
  principal(process.argv.slice(2)).catch((erro) => {
    process.stderr.write(`${erro.stack}\n`);
    process.exitCode = 1;
  });
}
/* c8 ignore stop */

module.exports = {
  CAMPO_DESTINO,
  COLECOES_PADRAO,
  paraDataDoDocumento,
  planejar,
  migrar,
  lerOpcoes,
  formatarRelatorio,
};
