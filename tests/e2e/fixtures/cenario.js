// O cenário determinístico dos testes end-to-end — AC-TEST-06, AC-TEST-09.
//
// Três pessoas, uma sala, e nenhum número sorteado. O determinismo é requisito
// do AC-TEST-09 e é o que separa uma suíte que se pode ler de uma que se
// aprende a ignorar: quando um teste falha, o banco em que ele falhou é o mesmo
// banco de sempre.
//
// A terceira pessoa — a Bia — existe por causa de um critério só, o AC-DM-04:
// uma conversa direta não pode ser visível a terceiros. Sem alguém de fora da
// conversa e dentro da sala, aquele critério não tem como ser exercitado.
const {
  ENDERECO_DO_APP,
  criarConta,
  gravar,
  gravarEmLote,
  gravarVarios,
} = require('./emulador');

/** A aluna. É ela quem abre chamado, manda mensagem e exclui o próprio card. */
const ANA = {
  uid: 'uid-ana',
  nome: 'Ana Souza',
  email: 'ana.souza@senai.br',
  senha: 'senha-de-teste-ana',
};

/** O professor. Dono da sala, o único que concede perk e usa `!clear`. */
const CARLOS = {
  uid: 'uid-carlos',
  nome: 'Carlos Lima',
  email: 'carlos.lima@senai.br',
  senha: 'senha-de-teste-carlos',
};

/** A terceira. Membro da sala, e de fora da conversa entre Ana e Carlos. */
const BIA = {
  uid: 'uid-bia',
  nome: 'Bia Nunes',
  email: 'bia.nunes@senai.br',
  senha: 'senha-de-teste-bia',
};

/** A sala de sempre. */
const SALA = {
  id: 'sala-mecanica',
  nome: 'Mecânica 2º ano',
  curso: 'Mecânica — Turma B',
  anoLetivo: 2026,
  pin: '314159',
};

/** O instante fixo de qualquer documento semeado. */
const INSTANTE = new Date('2026-03-10T13:45:00.000Z');

/**
 * Um instante **de hoje**, em Brasília, na hora pedida.
 *
 * O chat da sala mostra só a conversa do dia corrente (AC-TEMPO-07): uma
 * mensagem semeada em março de 2026 fica invisível atrás do botão "Ver dias
 * anteriores". Quem testa o envio, o horário e a paginação precisa de mensagens
 * de hoje, e "hoje" aqui é o dia de **Brasília**, não o do relógio da máquina —
 * é o mesmo dia que `services/tempo.js` calcula do outro lado.
 *
 * O deslocamento fixo de -03:00 é correto para o Brasil desde 2019, quando o
 * horário de verão foi extinto. Se ele voltar, este é o lugar de mudar.
 *
 * @param {number} [hora] hora de Brasília, 0 a 23.
 * @param {number} [minuto]
 */
function hojeEmBrasiliaAs(hora = 10, minuto = 45) {
  // `sv-SE` é o atalho para AAAA-MM-DD sem montar a data campo por campo.
  const dia = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const doisDigitos = (numero) => String(numero).padStart(2, '0');

  return new Date(`${dia}T${doisDigitos(hora)}:${doisDigitos(minuto)}:00-03:00`);
}

/**
 * O resumo do PIN, no mesmo formato que `services/pin.js` grava e que a rule
 * refaz: `SHA-256(sal + pin)` em hexadecimal minúsculo, **sem separador**.
 *
 * Calculado aqui e não copiado como constante: um resumo literal continuaria
 * parecendo válido se o algoritmo mudasse, e o teste de entrada por PIN passaria
 * a falhar dizendo "PIN inválido" — a mesma mensagem genérica que o aluno vê,
 * que é exatamente a que não aponta para a causa.
 *
 * @param {string} pin seis dígitos.
 * @param {string} sal o `sal` gravado no documento do segredo.
 */
async function resumoDoPin(pin, sal) {
  const { subtle } = require('node:crypto').webcrypto;
  const bytes = new TextEncoder().encode(`${sal}${pin}`);
  const resumo = await subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(resumo)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Cria as três contas no Auth do emulador. */
async function criarContas() {
  await criarConta(ANA);
  await criarConta(CARLOS);
  await criarConta(BIA);
}

/**
 * Os perfis em `usuarios/{uid}` e a autorização do professor.
 *
 * `autorizados/{email}` é a fonte de verdade do papel (AC-AUTH-06): sem a
 * entrada do Carlos ali, o app o trata como aluno, e é assim que deve ser.
 */
async function semearPerfis() {
  await gravarVarios('usuarios', [
    {
      id: ANA.uid,
      uid: ANA.uid,
      nome: ANA.nome,
      email: ANA.email,
      tipo: 'aluno',
      criadoEm: INSTANTE,
    },
    {
      id: CARLOS.uid,
      uid: CARLOS.uid,
      nome: CARLOS.nome,
      email: CARLOS.email,
      tipo: 'professor',
      criadoEm: INSTANTE,
    },
    {
      id: BIA.uid,
      uid: BIA.uid,
      nome: BIA.nome,
      email: BIA.email,
      tipo: 'aluno',
      criadoEm: INSTANTE,
    },
  ]);

  await gravar('autorizados', CARLOS.email, { Tipo: 'professor' });
}

/**
 * A sala pronta, com o PIN conferível e os membros que o cenário pede.
 *
 * @param {{membros?: Array<object>, ativa?: boolean}} opcoes
 *   `membros` vazio é o cenário de "o aluno ainda vai entrar com o PIN".
 */
async function semearSala({ membros = [ANA, BIA], ativa = true } = {}) {
  const sal = 'sal-fixo-do-cenario';
  const resumo = await resumoDoPin(SALA.pin, sal);

  await gravar('salas', SALA.id, {
    nome: SALA.nome,
    curso: SALA.curso,
    anoLetivo: SALA.anoLetivo,
    professorUid: CARLOS.uid,
    professorNome: CARLOS.nome,
    ativa,
    arquivadaEm: null,
    criadaEm: INSTANTE,
    pinAtualizadoEm: INSTANTE,
  });

  // `segredo` no singular, e os campos `hash`/`sal`: é o documento que a rule
  // lê para refazer o resumo, e o nome dele é contrato com `firestore.rules`.
  await gravar(`salas/${SALA.id}/segredo`, 'pin', {
    hash: resumo,
    sal,
    atualizadoEm: INSTANTE,
  });

  // `ativo`, e não `ativa`: é o campo que `salaDoPin` confere.
  await gravar('indicePins', SALA.pin, { salaId: SALA.id, ativo: ativa, criadoEm: INSTANTE });

  await vincular(CARLOS, 'professor');

  for (const pessoa of membros) {
    await vincular(pessoa, 'aluno');
  }
}

/** O vínculo nos dois lugares: a autoridade e o espelho. */
async function vincular(pessoa, papel) {
  await gravar(`salas/${SALA.id}/membros`, pessoa.uid, membro(pessoa, papel));
  await espelharVinculo(pessoa, papel);
}

/** O documento de `salas/{id}/membros/{uid}` — a autoridade do vínculo. */
function membro(pessoa, papel) {
  return {
    nome: pessoa.nome,
    email: pessoa.email,
    papel,
    entrouEm: INSTANTE,
  };
}

/**
 * O espelho em `usuarios/{uid}/salas` — o lado que a lista "Minhas salas" lê.
 *
 * Separado de `vincular` porque o cenário de carga grava os 40 membros em um
 * lote só e ainda precisa do espelho de quem faz login. Chamar `vincular` ali
 * tentaria criar o membro duas vezes, e o REST do emulador responde 409.
 */
async function espelharVinculo(pessoa, papel) {
  await gravar(`usuarios/${pessoa.uid}/salas`, SALA.id, {
    salaId: SALA.id,
    papel,
    entrouEm: INSTANTE,
  });
}

/**
 * Um chamado já aberto, do formato desta versão.
 *
 * @param {{id?: string, autor?: object, descricao?: string, atendido?: boolean}} opcoes
 */
async function semearChamado({
  id = 'chamado-existente',
  autor = ANA,
  descricao = 'O torno travou no meio do exercício.',
  atendido = false,
  cor = '#d8e5ff',
} = {}) {
  await gravar(`salas/${SALA.id}/chamados`, id, {
    autorUid: autor.uid,
    autorNome: autor.nome,
    // `nome` e `email` continuam ao lado dos campos novos: é a compatibilidade
    // futura da v0.5.0, e a 1.0.0 mantém os dois (ver docs/MIGRACOES.md).
    nome: autor.nome,
    email: autor.email,
    descricao,
    horario: INSTANTE,
    cor,
    formato: 'texto',
    imagem: null,
    anexo: null,
    atendido,
  });
}

/** Uma mensagem do chat da sala. */
async function semearMensagem({
  id = 'mensagem-1',
  autor = ANA,
  texto = 'Bom dia!',
  quando = hojeEmBrasiliaAs(),
} = {}) {
  await gravar(`salas/${SALA.id}/chat`, id, corpoDaMensagem({ autor, texto, quando }));
}

/**
 * Várias mensagens do chat, em minutos crescentes do mesmo dia.
 *
 * Minuto crescente, e não o mesmo instante repetido: a lista é ordenada por
 * `horario`, e com carimbos iguais a ordem passaria a ser a do id — o teste de
 * paginação afirmaria sobre uma ordem que a tela não promete.
 *
 * @param {{quantidade: number, autor?: object, primeiraHora?: number}} opcoes
 */
async function semearConversaDaSala({ quantidade, autor = ANA, primeiraHora = 8 }) {
  const documentos = [...Array(quantidade)].map((_valor, indice) => ({
    id: `mensagem-${String(indice + 1).padStart(3, '0')}`,
    ...corpoDaMensagem({
      autor,
      texto: `Mensagem número ${indice + 1}`,
      quando: hojeEmBrasiliaAs(primeiraHora + Math.floor(indice / 60), indice % 60),
    }),
  }));

  await gravarVarios(`salas/${SALA.id}/chat`, documentos);
}

/** Os campos de uma mensagem, no formato desta versão. */
function corpoDaMensagem({ autor, texto, quando }) {
  return {
    texto,
    autorUid: autor.uid,
    autorNome: autor.nome,
    autorPapel: autor === CARLOS ? 'professor' : 'aluno',
    // `nome` e `email` continuam ao lado dos campos novos: compatibilidade
    // futura da v0.7.0, mantida na 1.0.0 (ver docs/MIGRACOES.md).
    nome: autor.nome,
    email: autor.email,
    horario: quando,
  };
}

// ---------------------------------------------------------------------------
// O banco da v0.1.0 — compatibilidade retroativa de ponta a ponta
// ---------------------------------------------------------------------------
//
// O `tasks/_PROTOCOLO.md` § 4 exige que documentos gravados pela versão anterior
// continuem legíveis, e a task 09 pede a prova no formato mais antigo que existe:
// o da v0.1.0. Ele é diferente do atual em cinco pontos, e cada um deles é uma
// decisão que o app precisa continuar honrando:
//
//   1. `chamados` e `chat` são coleções **globais** — não há sala nenhuma;
//   2. `horario` é **string ISO**, não `Timestamp` do servidor;
//   3. `imagem` é **string de URL**, não o mapa `anexo`;
//   4. o autor é identificado por `email`, não por `autorUid`;
//   5. `usuarios` não tem `criadoEm`.
//
// Nada disso é hipótese: é o banco que estava em produção antes da 0.2.0, e é o
// que um professor com dois anos de histórico ainda tem.

/** A URL de imagem que a v0.1.0 gravava: uma string, sem mapa de anexo. */
const IMAGEM_LEGADA = `${ENDERECO_DO_APP}/favicon.ico`;

/** O `horario` da v0.1.0: string ISO, gravada pelo relógio do navegador. */
const HORARIO_LEGADO = '2026-03-10T13:45:00.000Z';

/**
 * O banco inteiro da v0.1.0, sem uma sala sequer.
 *
 * Os perfis vão sem `criadoEm` e sem `uid` de propósito: aquela versão gravava
 * só `nome`, `email` e `tipo`, e um perfil com os campos novos provaria a
 * compatibilidade de um documento que a v0.1.0 nunca escreveu.
 */
async function semearBancoDaV010() {
  await criarContas();

  await gravarVarios('usuarios', [
    { id: ANA.uid, nome: ANA.nome, email: ANA.email, tipo: 'aluno' },
    { id: CARLOS.uid, nome: CARLOS.nome, email: CARLOS.email, tipo: 'professor' },
  ]);

  await gravar('autorizados', CARLOS.email, { Tipo: 'professor' });

  // Dois chamados, um com anexo e um sem: o card com anexo é o que prova o
  // AC-IMG-13, e o sem anexo é o que prova que a ausência do campo não quebra
  // a mesma tela.
  await gravarVarios('chamados', [
    {
      id: 'legado-com-print',
      nome: ANA.nome,
      email: ANA.email,
      descricao: 'O torno travou — olha o print.',
      horario: HORARIO_LEGADO,
      cor: '#d8e5ff',
      imagem: IMAGEM_LEGADA,
    },
    {
      id: 'legado-sem-print',
      nome: ANA.nome,
      email: ANA.email,
      descricao: 'A furadeira não liga.',
      horario: '2026-03-10T14:10:00.000Z',
      cor: '#ffe0e0',
      imagem: '',
    },
  ]);

  await gravar('chat', 'legado-mensagem', {
    nome: CARLOS.nome,
    email: CARLOS.email,
    texto: 'Bom dia, turma. Hoje é torno.',
    horario: HORARIO_LEGADO,
  });
}

// ---------------------------------------------------------------------------
// O cenário de carga — AC-PERF-05
// ---------------------------------------------------------------------------
//
// O alvo declarado do projeto, em documentos de verdade no emulador: 40 pessoas
// na sala, 200 chamados na fila e 1000 mensagens no chat do dia. Não é o
// cenário confortável de sempre — é o pior dia do ano, a turma inteira em
// laboratório na semana de entrega.
//
// A escolha dos números não é livre: eles são exatamente os do AC-PERF-05 e os
// mesmos que `docs/ARQUITETURA.md` § 5 usa na conta de custo. Semear 41 ou 999
// tornaria o teste uma aproximação de um critério que é numérico.

/** Quantas pessoas a sala cheia tem, contando o professor. */
const TURMA_DE_CARGA = 40;

/** Quantos chamados a fila cheia tem. É o teto de leitura de `salas.js`. */
const CHAMADOS_DE_CARGA = 200;

/** Quantas mensagens o chat do dia tem. */
const MENSAGENS_DE_CARGA = 1000;

/**
 * Os 40 alunos da sala cheia: a Ana, a Bia e 38 colegas gerados.
 *
 * A Ana e a Bia entram na conta em vez de somar-se a ela porque são as duas que
 * fazem login — um cenário de 42 pessoas provaria um número que o critério não
 * pede, e deixaria de provar que **quem loga** é uma das 40.
 */
function turmaDeCarga() {
  const gerados = [...Array(TURMA_DE_CARGA - 2)].map((_valor, indice) => {
    const numero = String(indice + 1).padStart(2, '0');

    return {
      uid: `uid-colega-${numero}`,
      nome: `Colega ${numero}`,
      email: `colega${numero}@senai.br`,
    };
  });

  return [ANA, BIA, ...gerados];
}

/**
 * A sala do alvo do projeto, cheia.
 *
 * Semeia por lote (`gravarEmLote`) e não documento a documento: são 1240
 * documentos, e um `POST` para cada levava mais de um minuto — o navegador
 * abria depois de o Playwright já ter desistido.
 *
 * @returns {Promise<Array<object>>} a turma, para o spec afirmar sobre nomes.
 */
async function semearSalaCheia() {
  const turma = turmaDeCarga();

  await criarContas();
  await semearPerfis();
  await semearSala({ membros: [] });

  await gravarEmLote(
    `salas/${SALA.id}/membros`,
    turma.map((pessoa) => ({ id: pessoa.uid, ...membro(pessoa, 'aluno') }))
  );

  // O espelho em `usuarios/{uid}/salas` só importa para quem abre a lista de
  // salas, e nesta suíte isso é a Ana e a Bia. Semear os 38 colegas aqui seriam
  // 38 documentos que nenhuma asserção olha.
  await espelharVinculo(ANA, 'aluno');
  await espelharVinculo(BIA, 'aluno');

  await gravarEmLote(
    `salas/${SALA.id}/chamados`,
    [...Array(CHAMADOS_DE_CARGA)].map((_valor, indice) => {
      const autor = turma[indice % turma.length];
      const numero = String(indice + 1).padStart(3, '0');

      return {
        id: `chamado-${numero}`,
        autorUid: autor.uid,
        autorNome: autor.nome,
        nome: autor.nome,
        email: autor.email,
        descricao: `Dúvida número ${numero} — a peça não encaixa no gabarito.`,
        // Minuto crescente: com o mesmo carimbo em 200 documentos, a ordem da
        // fila passaria a ser a do id, e a asserção falaria de uma ordem que a
        // tela não promete.
        horario: new Date(INSTANTE.getTime() + indice * 60000),
        cor: '#d8e5ff',
        formato: 'texto',
        imagem: null,
        anexo: null,
        atendido: false,
      };
    })
  );

  await gravarEmLote(
    `salas/${SALA.id}/chat`,
    [...Array(MENSAGENS_DE_CARGA)].map((_valor, indice) => ({
      id: `carga-${String(indice + 1).padStart(4, '0')}`,
      ...corpoDaMensagem({
        autor: turma[indice % turma.length],
        texto: `Mensagem de carga ${indice + 1}`,
        // Mil minutos a partir das 6h cabem no mesmo dia de Brasília, que é o
        // que o chat mostra sem clique nenhum (AC-TEMPO-07).
        quando: hojeEmBrasiliaAs(6 + Math.floor(indice / 60), indice % 60),
      }),
    }))
  );

  return turma;
}

/** O cenário completo: contas, perfis e a sala com os dois alunos dentro. */
async function semearCenarioCompleto(opcoes = {}) {
  await criarContas();
  await semearPerfis();
  await semearSala(opcoes);
}

module.exports = {
  ANA,
  BIA,
  CARLOS,
  CHAMADOS_DE_CARGA,
  HORARIO_LEGADO,
  IMAGEM_LEGADA,
  INSTANTE,
  MENSAGENS_DE_CARGA,
  SALA,
  TURMA_DE_CARGA,
  criarContas,
  hojeEmBrasiliaAs,
  resumoDoPin,
  semearCenarioCompleto,
  semearChamado,
  semearConversaDaSala,
  semearMensagem,
  semearPerfis,
  semearBancoDaV010,
  semearSala,
  semearSalaCheia,
  vincular,
};
