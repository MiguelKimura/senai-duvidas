#!/usr/bin/env node
/*
 * Move os dados globais da v0.4.0 para dentro de uma sala — task 03.
 *
 * Uso:
 *   node scripts/migrar-para-salas.js --dry-run
 *   node scripts/migrar-para-salas.js --confirmar
 *   node scripts/migrar-para-salas.js --confirmar --professor <uid> --ano 2026
 *   node scripts/migrar-para-salas.js --reverter --confirmar
 *
 * POR QUE ESTE SCRIPT EXISTE
 *
 * Até a v0.4.0, `chamados` e `chat` eram coleções globais: toda turma do SENAI
 * dividia a mesma fila e a mesma conversa. A v0.5.0 escopa tudo por sala. Os
 * documentos que já existem precisam de uma sala para morar, senão o app novo
 * abre vazio para quem tem dois anos de histórico ali dentro.
 *
 * O QUE ELE FAZ
 *
 *   1. Cria a sala `Turma Geral {ano}`, do professor mais ativo (ou do UID
 *      passado em `--professor`).
 *   2. Copia todos os `chamados` e `chat` para as subcoleções dessa sala,
 *      **preservando os IDs** dos documentos.
 *   3. Cria `membros/{uid}` para cada autor distinto que tenha cadastro.
 *   4. **Não apaga** as coleções globais. Elas continuam sendo lidas pelo
 *      fallback do app e são o backup vivo até a 1.0.0.
 *
 * O QUE ELE NÃO FAZ
 *
 * Não gera PIN. Um PIN em claro num log de operação é exatamente o que o
 * AC-SEC-05 proíbe, e o log de um script fica no histórico do terminal, no
 * CI e no print que alguém manda no grupo. A sala nasce sem PIN; o professor
 * entra no app e clica em "Gerar novo PIN", que é o único lugar onde o número
 * aparece — uma vez, para quem é dono.
 *
 * IDEMPOTÊNCIA
 *
 * Os IDs são preservados, então "já copiei este documento?" é a pergunta
 * "existe um documento com este ID na sala?". A segunda rodada não tem o que
 * fazer, e uma rodada interrompida no meio termina na seguinte.
 *
 * REVERSÃO
 *
 * Cada documento copiado carrega a marca `migradoDe`. `--reverter` apaga da
 * sala exatamente os documentos marcados — o que a turma escreveu depois da
 * migração fica, e as coleções globais não são tocadas em nenhum momento.
 *
 * DESENHO
 *
 * As funções puras decidem o que fazer e são testadas em
 * `scripts/__tests__/migrar-para-salas.test.js`. A casca no fim do arquivo
 * fala com o Firestore e não tem regra nenhuma.
 */

/** A marca que distingue o documento copiado do que nasceu na sala. */
const CAMPO_DE_ORIGEM = 'migradoDe';

/** As coleções globais da v0.4.0. Nenhuma delas é apagada por este script. */
const COLECAO_DE_CHAMADOS = 'chamados';
const COLECAO_DE_CHAT = 'chat';

const PAPEL_DE_ALUNO = 'aluno';
const PAPEL_DE_PROFESSOR = 'professor';

/** O nome da sala que recebe o acervo global. */
function nomeDaSalaGeral(ano) {
  return `Turma Geral ${ano}`;
}

/** O e-mail de um documento antigo, que é a única identidade que ele tem. */
function emailDo(dados) {
  return (dados && dados.email) || null;
}

/**
 * Um índice de e-mail para `{uid, nome, tipo}`, a partir de `usuarios`.
 *
 * É o que permite transformar um chamado da v0.4.0 — que só tem `nome` e
 * `email` — num membro, que precisa de UID. Quem não estiver em `usuarios`
 * fica de fora e é listado no relatório: inventar um UID seria criar um
 * fantasma com permissão de leitura na sala.
 */
function indicePorEmail(usuarios) {
  const indice = new Map();

  usuarios.forEach(({ id, dados }) => {
    if (dados && dados.email) {
      indice.set(dados.email, { uid: id, nome: dados.nome || dados.email, tipo: dados.tipo });
    }
  });

  return indice;
}

/**
 * Escolhe o dono da Turma Geral (AC-SALA-01).
 *
 * Com `--professor`, nada é adivinhado — mas o UID precisa ser de um
 * professor: uma sala cujo dono é aluno não pode ser arquivada nem ter o PIN
 * regerado por ninguém.
 *
 * Sem o parâmetro, ganha o professor que mais escreveu no acervo global. É uma
 * heurística, e é por isso que `--dry-run` imprime quem foi escolhido antes de
 * qualquer escrita.
 *
 * @returns {{uid: string, nome: string, email: string}|null}
 */
function escolherDono({ usuarios, chamados = [], chat = [], professorUid = null }) {
  const professores = usuarios.filter(({ dados }) => dados && dados.tipo === PAPEL_DE_PROFESSOR);

  if (professorUid) {
    const escolhido = professores.find(({ id }) => id === professorUid);

    if (!escolhido) {
      throw new Error(
        `O UID ${professorUid} não é de um professor em 'usuarios'. ` +
          'A sala precisa de um dono que possa arquivá-la e gerar PIN novo.'
      );
    }

    return { uid: escolhido.id, nome: escolhido.dados.nome, email: escolhido.dados.email };
  }

  if (professores.length === 0) return null;

  const porEmail = new Map();
  [...chamados, ...chat].forEach(({ dados }) => {
    const email = emailDo(dados);
    if (email) porEmail.set(email, (porEmail.get(email) || 0) + 1);
  });

  const ordenados = [...professores].sort((a, b) => {
    const diferenca = (porEmail.get(b.dados.email) || 0) - (porEmail.get(a.dados.email) || 0);

    // Empate resolvido pelo UID, para que duas execuções escolham o mesmo
    // dono: uma migração que sorteia não é idempotente.
    return diferenca !== 0 ? diferenca : a.id.localeCompare(b.id);
  });

  const [escolhido] = ordenados;

  return { uid: escolhido.id, nome: escolhido.dados.nome, email: escolhido.dados.email };
}

/**
 * Monta o documento que vai para a subcoleção da sala.
 *
 * Nenhum campo antigo é renomeado nem removido: `nome` continua lá, ao lado de
 * `autorNome`. É a escrita dupla da seção 4 do protocolo — um cliente da
 * v0.4.0 que leia este documento continua encontrando o que procura.
 */
function documentoCopiado(dados, origem, indice) {
  const email = emailDo(dados);
  const cadastro = email ? indice.get(email) : null;
  const nome = dados.autorNome || dados.nome || (cadastro && cadastro.nome) || null;

  return {
    ...dados,
    ...(nome ? { nome, autorNome: nome } : {}),
    ...(cadastro ? { autorUid: cadastro.uid } : {}),
    [CAMPO_DE_ORIGEM]: origem,
  };
}

/**
 * Decide, sem gravar nada, o que a migração precisa fazer.
 *
 * `destino` é o retrato do que já existe na sala. É ele que torna a função
 * idempotente: o que já está lá não entra no plano.
 *
 * @param {object} entrada
 * @param {Array<{id: string, dados: object}>} entrada.chamados coleção global.
 * @param {Array<{id: string, dados: object}>} entrada.chat coleção global.
 * @param {Array<{id: string, dados: object}>} entrada.usuarios cadastro.
 * @param {{salaId: string|null, chamados: string[], chat: string[], membros: string[]}} entrada.destino
 * @param {{uid: string, nome: string, email: string}} entrada.dono
 * @param {number} entrada.ano ano letivo da sala.
 */
function planejarMigracao({ chamados, chat, usuarios, destino, dono, ano }) {
  const indice = indicePorEmail(usuarios);
  const jaTemChamado = new Set(destino.chamados);
  const jaTemMensagem = new Set(destino.chat);
  const jaTemMembro = new Set(destino.membros);

  const copiar = (documentos, jaTem, origem) =>
    documentos
      .filter(({ id }) => !jaTem.has(id))
      .map(({ id, dados }) => ({ id, dados: documentoCopiado(dados, origem, indice) }));

  const chamadosParaCopiar = copiar(chamados, jaTemChamado, COLECAO_DE_CHAMADOS);
  const chatParaCopiar = copiar(chat, jaTemMensagem, COLECAO_DE_CHAT);

  // Os membros: o dono primeiro, depois cada autor distinto com cadastro.
  const membros = new Map();
  const autoresSemUid = new Set();

  membros.set(dono.uid, {
    nome: dono.nome,
    email: dono.email,
    papel: PAPEL_DE_PROFESSOR,
    [CAMPO_DE_ORIGEM]: COLECAO_DE_CHAMADOS,
  });

  [
    ...chamados.map(({ dados }) => [dados, COLECAO_DE_CHAMADOS]),
    ...chat.map(({ dados }) => [dados, COLECAO_DE_CHAT]),
  ].forEach(([dados, origem]) => {
    const email = emailDo(dados);
    if (!email) return;

    const cadastro = indice.get(email);

    if (!cadastro) {
      autoresSemUid.add(email);
      return;
    }

    if (membros.has(cadastro.uid)) return;

    membros.set(cadastro.uid, {
      nome: cadastro.nome,
      email,
      papel: cadastro.tipo === PAPEL_DE_PROFESSOR ? PAPEL_DE_PROFESSOR : PAPEL_DE_ALUNO,
      [CAMPO_DE_ORIGEM]: origem,
    });
  });

  return {
    sala: {
      criar: !destino.salaId,
      salaId: destino.salaId,
      dados: {
        nome: nomeDaSalaGeral(ano),
        curso: nomeDaSalaGeral(ano),
        anoLetivo: ano,
        professorUid: dono.uid,
        professorNome: dono.nome,
        ativa: true,
        arquivadaEm: null,
        [CAMPO_DE_ORIGEM]: COLECAO_DE_CHAMADOS,
      },
    },
    chamados: chamadosParaCopiar,
    chat: chatParaCopiar,
    membros: [...membros.entries()]
      .filter(([uid]) => !jaTemMembro.has(uid))
      .map(([uid, dados]) => ({ uid, dados })),
    jaCopiados: {
      chamados: chamados.length - chamadosParaCopiar.length,
      chat: chat.length - chatParaCopiar.length,
      membros: [...membros.keys()].filter((uid) => jaTemMembro.has(uid)).length,
    },
    autoresSemUid: [...autoresSemUid],
    // Explicitamente vazio: esta migração não apaga nada. O campo existe para
    // que a ausência de remoções seja uma afirmação verificável, e não um
    // silêncio.
    apagar: [],
  };
}

/**
 * Decide o que a reversão precisa apagar (`--reverter`).
 *
 * Só sai o que tem a marca `migradoDe`. O que a turma escreveu depois da
 * migração fica onde está — apagá-lo seria destruir dado que nunca esteve na
 * coleção global e não tem backup em lugar nenhum.
 *
 * @param {object} entrada retrato do que existe **dentro** da sala.
 */
function planejarReversao({ salaId, chamados = [], chat = [], membros = [] }) {
  const marcados = (documentos, subcolecao) =>
    documentos
      .filter(({ dados }) => dados && dados[CAMPO_DE_ORIGEM])
      .map(({ id }) => ({ colecao: `salas/${salaId}/${subcolecao}`, id }));

  return {
    apagar: [
      ...marcados(chamados, 'chamados'),
      ...marcados(chat, 'chat'),
      ...marcados(membros, 'membros'),
    ],
    // A sala em si fica: ela pode já ter PIN gerado e alunos que entraram por
    // ele. Apagá-la expulsaria gente que não veio da migração.
    escrever: [],
  };
}

/**
 * Executa o plano, um documento por vez.
 *
 * Sequencial de propósito, como em `migrar-horarios.js`: o volume é pequeno e
 * uma rajada paralela contra o Firestore gasta cota sem ganhar nada.
 *
 * Falha de um documento não interrompe os outros. Uma migração que para no
 * meio deixa o banco num estado que ninguém sabe descrever; esta vai até o fim
 * e devolve a lista do que não deu — e a rodada seguinte pega o que faltou.
 */
async function executarPlano({ plano, escrever, apagar, salaId, simulacao = false }) {
  const falhas = [];
  let escritos = 0;
  let apagados = 0;

  const registros = [
    ...(plano.sala && plano.sala.criar
      ? [{ colecao: 'salas', id: salaId, dados: plano.sala.dados }]
      : []),
    ...(plano.chamados || []).map(({ id, dados }) => ({
      colecao: `salas/${salaId}/chamados`,
      id,
      dados,
    })),
    ...(plano.chat || []).map(({ id, dados }) => ({
      colecao: `salas/${salaId}/chat`,
      id,
      dados,
    })),
    ...(plano.membros || []).map(({ uid, dados }) => ({
      colecao: `salas/${salaId}/membros`,
      id: uid,
      dados,
    })),
  ];

  for (const registro of registros) {
    if (simulacao) {
      escritos += 1;
      continue;
    }

    try {
      await escrever(registro);
      escritos += 1;
    } catch (erro) {
      falhas.push({ id: registro.id, colecao: registro.colecao, erro: erro.message });
    }
  }

  for (const registro of plano.apagar || []) {
    if (simulacao) {
      apagados += 1;
      continue;
    }

    try {
      await apagar(registro);
      apagados += 1;
    } catch (erro) {
      falhas.push({ id: registro.id, colecao: registro.colecao, erro: erro.message });
    }
  }

  return {
    salaId,
    escritos,
    apagados,
    jaCopiados: plano.jaCopiados || { chamados: 0, chat: 0, membros: 0 },
    autoresSemUid: plano.autoresSemUid || [],
    falhas,
    simulacao,
  };
}

/**
 * Lê os argumentos da linha de comando.
 *
 * `--confirmar` existe porque o padrão seguro de um script que escreve em
 * produção não pode ser escrever.
 */
function lerOpcoes(argumentos) {
  const valorDe = (bandeira) => {
    const posicao = argumentos.indexOf(bandeira);
    return posicao === -1 ? null : argumentos[posicao + 1] || null;
  };

  const ano = valorDe('--ano');

  return {
    simulacao: argumentos.includes('--dry-run'),
    confirmado: argumentos.includes('--confirmar'),
    reverter: argumentos.includes('--reverter'),
    professorUid: valorDe('--professor'),
    ano: ano ? Number(ano) : new Date().getFullYear(),
  };
}

/** O relatório que a pessoa que rodou o script lê. */
function formatarRelatorio(relatorio) {
  const { salaId, escritos, apagados, jaCopiados, autoresSemUid, falhas, simulacao } = relatorio;

  const linhas = [
    `Sala de destino: ${salaId}`,
    simulacao
      ? `  ${escritos} documentos seriam gravados (simulação: --dry-run, nada foi gravado)`
      : `  ${escritos} documentos gravados`,
  ];

  if (apagados > 0 || simulacao) {
    linhas.push(
      simulacao
        ? `  ${apagados} documentos seriam apagados DENTRO da sala`
        : `  ${apagados} documentos apagados dentro da sala`
    );
  }

  linhas.push(
    `  já estavam na sala: ${jaCopiados.chamados} chamados, ${jaCopiados.chat} mensagens, ` +
      `${jaCopiados.membros} membros`,
    '  As coleções globais NÃO foram apagadas: elas continuam sendo o backup até a 1.0.0.',
    '  A sala não tem PIN. Entre no app como dono da sala e clique em "Gerar novo PIN" —',
    '  é o único lugar onde o número aparece, e ele aparece uma vez só.'
  );

  if (autoresSemUid.length > 0) {
    linhas.push('  Autores sem cadastro em `usuarios`, que NÃO viraram membros:');
    autoresSemUid.forEach((email) => linhas.push(`    ${email}`));
  }

  if (falhas.length > 0) {
    linhas.push(`  ${falhas.length} falharam:`);
    falhas.forEach(({ colecao, id, erro }) => linhas.push(`    ${colecao}/${id}: ${erro}`));
  }

  return linhas.join('\n');
}

/* c8 ignore start -- casca de I/O: sem regra, e sem como testar sem o Admin SDK */
async function lerColecao(db, caminho) {
  const snapshot = await db.collection(caminho).get();

  return snapshot.docs.map((documento) => ({ id: documento.id, dados: documento.data() }));
}

/** A sala de destino, se a migração já criou uma para este ano. */
async function acharSalaGeral(db, ano) {
  const snapshot = await db
    .collection('salas')
    .where('nome', '==', nomeDaSalaGeral(ano))
    .limit(1)
    .get();

  return snapshot.empty ? null : snapshot.docs[0].id;
}

async function principal(argumentos) {
  const { simulacao, confirmado, reverter, professorUid, ano } = lerOpcoes(argumentos);

  if (!simulacao && !confirmado) {
    process.stdout.write(
      'Nada foi feito. Rode com --dry-run para ver o que mudaria, ' +
        'ou com --confirmar para gravar.\n'
    );
    return;
  }

  const admin = require('firebase-admin');

  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();

  const salaExistente = await acharSalaGeral(db, ano);

  if (reverter) {
    if (!salaExistente) {
      process.stdout.write(`Não há sala "${nomeDaSalaGeral(ano)}" para reverter.\n`);
      return;
    }

    const plano = planejarReversao({
      salaId: salaExistente,
      chamados: await lerColecao(db, `salas/${salaExistente}/chamados`),
      chat: await lerColecao(db, `salas/${salaExistente}/chat`),
      membros: await lerColecao(db, `salas/${salaExistente}/membros`),
    });

    const relatorio = await executarPlano({
      plano: { ...plano, sala: null, chamados: [], chat: [], membros: [] },
      escrever: async () => {},
      apagar: ({ colecao, id }) => db.doc(`${colecao}/${id}`).delete(),
      salaId: salaExistente,
      simulacao,
    });

    process.stdout.write(`${formatarRelatorio(relatorio)}\n`);
    if (relatorio.falhas.length > 0) process.exitCode = 1;
    return;
  }

  const [chamados, chat, usuarios] = await Promise.all([
    lerColecao(db, COLECAO_DE_CHAMADOS),
    lerColecao(db, COLECAO_DE_CHAT),
    lerColecao(db, 'usuarios'),
  ]);

  const dono = escolherDono({ usuarios, chamados, chat, professorUid });

  if (!dono) {
    process.stderr.write(
      'Nenhum professor encontrado em `usuarios`. Passe um UID com --professor.\n'
    );
    process.exitCode = 1;
    return;
  }

  const destino = salaExistente
    ? {
        salaId: salaExistente,
        chamados: (await lerColecao(db, `salas/${salaExistente}/chamados`)).map(({ id }) => id),
        chat: (await lerColecao(db, `salas/${salaExistente}/chat`)).map(({ id }) => id),
        membros: (await lerColecao(db, `salas/${salaExistente}/membros`)).map(({ id }) => id),
      }
    : { salaId: null, chamados: [], chat: [], membros: [] };

  const plano = planejarMigracao({ chamados, chat, usuarios, destino, dono, ano });
  const salaId = destino.salaId || db.collection('salas').doc().id;

  process.stdout.write(`Dono da sala: ${dono.nome} <${dono.email}>\n`);

  const relatorio = await executarPlano({
    plano,
    escrever: ({ colecao, id, dados }) => db.collection(colecao).doc(id).set(dados, { merge: true }),
    apagar: async () => {},
    salaId,
    simulacao,
  });

  process.stdout.write(`${formatarRelatorio(relatorio)}\n`);
  if (relatorio.falhas.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  principal(process.argv.slice(2)).catch((erro) => {
    process.stderr.write(`${erro.stack}\n`);
    process.exitCode = 1;
  });
}
/* c8 ignore stop */

module.exports = {
  CAMPO_DE_ORIGEM,
  escolherDono,
  executarPlano,
  formatarRelatorio,
  lerOpcoes,
  nomeDaSalaGeral,
  planejarMigracao,
  planejarReversao,
};
