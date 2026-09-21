// Security Rules das salas — AC-SEC-01, AC-SEC-02, AC-SEC-05, AC-SALA-04,
// AC-SALA-09, AC-SALA-10, AC-SALA-12.
//
// Este arquivo é a metade do servidor. A outra metade, o cliente, está em
// `src/services/__tests__/salas.test.js`. As duas precisam existir: uma regra
// que só o cliente respeita não é regra, e um servidor que o cliente não sabe
// usar não vira tela.
//
// Cada caminho tem o par: uma permissão **concedida** e uma **negada**. Sem o
// par, um `allow ... if false` acidental passaria despercebido — a suíte
// ficaria verde com o app quebrado.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} = require('firebase/firestore');
const { projetoDeTeste } = require('./projetoDeTeste');

let ambiente;

const CARLOS = 'uid-carlos';
const CARLOS_EMAIL = 'carlos@senai.br';
const ANA = 'uid-ana';
const ANA_EMAIL = 'ana@senai.br';
const BRUNO = 'uid-bruno';
const BRUNO_EMAIL = 'bruno@senai.br';

const SALA_A = 'sala-a';
const SALA_B = 'sala-b';
const PIN_A = '123456';
const PIN_B = '654321';
const SAL_A = 'a1b2c3d4e5f60718';
const SAL_B = '0f1e2d3c4b5a6978';

/** O mesmo resumo que `services/pin.js` calcula no navegador. */
function resumo(pin, sal) {
  return crypto.createHash('sha256').update(`${sal}${pin}`).digest('hex');
}

function como(uid, email) {
  return ambiente.authenticatedContext(uid, email ? { email } : undefined).firestore();
}

function comoVisitante() {
  return ambiente.unauthenticatedContext().firestore();
}

/** Grava contornando as rules, para montar o cenário. */
async function semear(caminho, dados) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), caminho), dados);
  });
}

async function semearSala(salaId, { dono = CARLOS, ativa = true } = {}) {
  await semear(`salas/${salaId}`, {
    nome: 'Mecânica 2º ano',
    curso: 'Mecânica — Turma B',
    anoLetivo: 2026,
    professorUid: dono,
    professorNome: 'Carlos Lima',
    ativa,
    arquivadaEm: ativa ? null : Timestamp.now(),
    criadaEm: Timestamp.now(),
  });
}

async function semearSegredo(salaId, pin, sal) {
  await semear(`salas/${salaId}/segredo/pin`, {
    hash: resumo(pin, sal),
    sal,
    atualizadoEm: Timestamp.now(),
  });
}

async function semearMembro(salaId, uid, papel = 'aluno') {
  await semear(`salas/${salaId}/membros/${uid}`, {
    nome: 'Alguém',
    email: `${uid}@senai.br`,
    papel,
    entrouEm: Timestamp.now(),
  });
}

/**
 * Registra a tentativa de PIN como o cliente registraria.
 * `segundosAtras` envelhece a tentativa para provar o frescor exigido.
 */
async function semearTentativa(uid, pin, { tentativas = 1, segundosAtras = 0 } = {}) {
  const agora = Date.now();

  await semear(`tentativasPin/${uid}`, {
    pinTentado: pin,
    tentativas,
    janelaIniciadaEm: Timestamp.fromMillis(agora - segundosAtras * 1000),
    ultimaTentativaEm: Timestamp.fromMillis(agora - segundosAtras * 1000),
  });
}

/** O documento de vínculo que o cliente escreve ao entrar com PIN. */
function vinculoDeAluno() {
  return { nome: 'Ana Souza', email: ANA_EMAIL, papel: 'aluno', entrouEm: serverTimestamp() };
}

beforeAll(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: projetoDeTeste(),
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  if (ambiente) await ambiente.cleanup();
});

beforeEach(async () => {
  await ambiente.clearFirestore();
  await semear(`autorizados/${CARLOS_EMAIL}`, { Tipo: 'professor' });
});

describe('salas/{salaId} — quem lê e quem cria', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semearMembro(SALA_A, CARLOS, 'professor');
    await semearMembro(SALA_A, ANA);
  });

  it('o aluno membro lê a sala', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), `salas/${SALA_A}`)));
  });

  it('o professor dono lê a sala', async () => {
    await assertSucceeds(getDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}`)));
  });

  it('quem não é membro NÃO lê a sala (AC-SEC-02)', async () => {
    await assertFails(getDoc(doc(como(BRUNO), `salas/${SALA_A}`)));
  });

  it('quem não tem sessão não lê nada', async () => {
    await assertFails(getDoc(doc(comoVisitante(), `salas/${SALA_A}`)));
  });

  it('ninguém varre a coleção de salas, nem sendo professor', async () => {
    await assertFails(getDocs(collection(como(CARLOS, CARLOS_EMAIL), 'salas')));
    await assertFails(getDocs(collection(como(ANA), 'salas')));
  });

  it('o professor autorizado cria a própria sala', async () => {
    await assertSucceeds(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), 'salas/nova'), {
        nome: 'Elétrica 1',
        curso: 'Elétrica — Turma A',
        anoLetivo: 2026,
        professorUid: CARLOS,
        professorNome: 'Carlos Lima',
        ativa: true,
        arquivadaEm: null,
        criadaEm: serverTimestamp(),
      })
    );
  });

  it('o aluno NÃO cria sala, nem se declarando dono', async () => {
    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), 'salas/da-ana'), {
        nome: 'Sala da Ana',
        curso: 'Curso qualquer',
        anoLetivo: 2026,
        professorUid: ANA,
        professorNome: 'Ana Souza',
        ativa: true,
        arquivadaEm: null,
        criadaEm: serverTimestamp(),
      })
    );
  });

  it('o professor NÃO cria sala no nome de outro professor', async () => {
    await assertFails(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), 'salas/forjada'), {
        nome: 'Sala alheia',
        curso: 'Curso',
        anoLetivo: 2026,
        professorUid: 'uid-outro-professor',
        professorNome: 'Outro',
        ativa: true,
        arquivadaEm: null,
        criadaEm: serverTimestamp(),
      })
    );
  });

  it('recusa data de criação escolhida pelo cliente', async () => {
    await assertFails(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), 'salas/antiga'), {
        nome: 'Sala com data forjada',
        curso: 'Curso',
        anoLetivo: 2026,
        professorUid: CARLOS,
        professorNome: 'Carlos Lima',
        ativa: true,
        arquivadaEm: null,
        criadaEm: Timestamp.fromDate(new Date('2000-01-01T00:00:00.000Z')),
      })
    );
  });

  it.each([
    ['nome vazio', { nome: '' }],
    ['ano letivo absurdo', { anoLetivo: 1899 }],
    ['ano letivo como texto', { anoLetivo: '2026' }],
    ['curso vazio', { curso: '' }],
  ])('recusa sala com %s', async (_rotulo, sobrescritas) => {
    await assertFails(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), 'salas/invalida'), {
        nome: 'Nome',
        curso: 'Curso',
        anoLetivo: 2026,
        professorUid: CARLOS,
        professorNome: 'Carlos Lima',
        ativa: true,
        arquivadaEm: null,
        criadaEm: serverTimestamp(),
        ...sobrescritas,
      })
    );
  });
});

describe('salas/{salaId} — quem altera (AC-SALA-10)', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semearMembro(SALA_A, CARLOS, 'professor');
    await semearMembro(SALA_A, ANA);
  });

  it('o dono renomeia a sala', async () => {
    await assertSucceeds(
      updateDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}`), { nome: 'Mecânica 3º ano' })
    );
  });

  it('o aluno membro NÃO renomeia a sala', async () => {
    await assertFails(updateDoc(doc(como(ANA), `salas/${SALA_A}`), { nome: 'Sala da Ana' }));
  });

  it('o dono arquiva a sala', async () => {
    await assertSucceeds(
      updateDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}`), {
        ativa: false,
        arquivadaEm: serverTimestamp(),
      })
    );
  });

  it('o aluno NÃO arquiva nem reabre a sala', async () => {
    await assertFails(updateDoc(doc(como(ANA), `salas/${SALA_A}`), { ativa: false }));
  });

  it('nem o dono troca o dono da sala', async () => {
    await assertFails(
      updateDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}`), { professorUid: ANA })
    );
  });

  it('ninguém apaga a sala, nem o dono', async () => {
    await assertFails(deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}`)));
    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA_A}`)));
  });
});

describe('salas/{salaId}/segredo — o resumo do PIN (AC-SEC-05)', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semearSegredo(SALA_A, PIN_A, SAL_A);
    await semearMembro(SALA_A, CARLOS, 'professor');
    await semearMembro(SALA_A, ANA);
  });

  it('o professor dono lê o resumo', async () => {
    await assertSucceeds(getDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/segredo/pin`)));
  });

  it('o aluno da própria sala NÃO lê o resumo do PIN', async () => {
    await assertFails(getDoc(doc(como(ANA), `salas/${SALA_A}/segredo/pin`)));
  });

  it('um professor de outra sala NÃO lê o resumo', async () => {
    await semear(`autorizados/${BRUNO_EMAIL}`, { Tipo: 'professor' });

    await assertFails(getDoc(doc(como(BRUNO, BRUNO_EMAIL), `salas/${SALA_A}/segredo/pin`)));
  });

  it('o dono regrava o resumo ao regerar o PIN', async () => {
    await assertSucceeds(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/segredo/pin`), {
        hash: resumo('999999', SAL_A),
        sal: SAL_A,
        atualizadoEm: serverTimestamp(),
      })
    );
  });

  it('o aluno NÃO grava resumo nenhum', async () => {
    await assertFails(
      setDoc(doc(como(ANA), `salas/${SALA_A}/segredo/pin`), {
        hash: resumo('000000', SAL_A),
        sal: SAL_A,
        atualizadoEm: serverTimestamp(),
      })
    );
  });

  it('ninguém apaga o resumo para deixar a sala sem PIN', async () => {
    await assertFails(deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/segredo/pin`)));
  });
});

describe('entrar na sala pelo PIN — o que o servidor confere (AC-SALA-04)', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semearSegredo(SALA_A, PIN_A, SAL_A);
    await semearMembro(SALA_A, CARLOS, 'professor');
  });

  it('com o PIN certo e a tentativa registrada, o aluno entra', async () => {
    await semearTentativa(ANA, PIN_A);

    await assertSucceeds(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), vinculoDeAluno())
    );
  });

  it('com o PIN errado, não entra — é a mesma tentativa, outro número', async () => {
    await semearTentativa(ANA, '000000');

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), vinculoDeAluno())
    );
  });

  it('sem tentativa registrada, não entra nem com o PIN certo no bolso', async () => {
    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), vinculoDeAluno())
    );
  });

  it('com a tentativa envelhecida, não entra: a prova tem prazo', async () => {
    await semearTentativa(ANA, PIN_A, { segundosAtras: 120 });

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), vinculoDeAluno())
    );
  });

  it('a tentativa do PIN da sala A não abre a sala B (AC-SEC-02)', async () => {
    await semearSala(SALA_B, { dono: BRUNO });
    await semearSegredo(SALA_B, PIN_B, SAL_B);
    await semearTentativa(ANA, PIN_A);

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_B}/membros/${ANA}`), vinculoDeAluno())
    );
  });

  it('o PIN anterior deixa de valer depois de regerado (AC-SALA-09)', async () => {
    await semearTentativa(ANA, PIN_A);
    // Regerar é exatamente isto: o resumo passa a ser o de outro número.
    await semearSegredo(SALA_A, '999999', SAL_A);

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), vinculoDeAluno())
    );
  });

  it('a sala arquivada não aceita entrada nova (AC-SALA-10)', async () => {
    await semearSala(SALA_A, { ativa: false });
    await semearTentativa(ANA, PIN_A);

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), vinculoDeAluno())
    );
  });

  it('o aluno NÃO entra como professor da sala', async () => {
    await semearTentativa(ANA, PIN_A);

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), {
        ...vinculoDeAluno(),
        papel: 'professor',
      })
    );
  });

  it('o aluno NÃO cria o vínculo no lugar de outra pessoa', async () => {
    await semearTentativa(ANA, PIN_A);

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${BRUNO}`), vinculoDeAluno())
    );
  });

  it('recusa a data de entrada escolhida pelo cliente', async () => {
    await semearTentativa(ANA, PIN_A);

    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/membros/${ANA}`), {
        ...vinculoDeAluno(),
        entrouEm: Timestamp.fromDate(new Date('2000-01-01T00:00:00.000Z')),
      })
    );
  });

  it('o dono entra na própria sala sem PIN nenhum', async () => {
    await semearSala(SALA_B, { dono: CARLOS });

    await assertSucceeds(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_B}/membros/${CARLOS}`), {
        nome: 'Carlos Lima',
        email: CARLOS_EMAIL,
        papel: 'professor',
        entrouEm: serverTimestamp(),
      })
    );
  });

  it('um professor qualquer NÃO se declara professor da sala alheia', async () => {
    await semear(`autorizados/${BRUNO_EMAIL}`, { Tipo: 'professor' });

    await assertFails(
      setDoc(doc(como(BRUNO, BRUNO_EMAIL), `salas/${SALA_A}/membros/${BRUNO}`), {
        nome: 'Bruno Alves',
        email: BRUNO_EMAIL,
        papel: 'professor',
        entrouEm: serverTimestamp(),
      })
    );
  });
});

describe('membros — sair e remover (AC-SALA-09)', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semearMembro(SALA_A, CARLOS, 'professor');
    await semearMembro(SALA_A, ANA);
    await semearMembro(SALA_A, BRUNO);
  });

  it('o professor dono remove um aluno', async () => {
    await assertSucceeds(
      deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/membros/${ANA}`))
    );
  });

  it('o aluno sai da sala por conta própria', async () => {
    await assertSucceeds(deleteDoc(doc(como(ANA), `salas/${SALA_A}/membros/${ANA}`)));
  });

  it('um aluno NÃO remove o colega', async () => {
    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA_A}/membros/${BRUNO}`)));
  });

  it('ninguém se promove a professor depois de entrar', async () => {
    await assertFails(
      updateDoc(doc(como(ANA), `salas/${SALA_A}/membros/${ANA}`), { papel: 'professor' })
    );
  });

  it('o professor lista os membros da própria sala', async () => {
    await assertSucceeds(
      getDocs(collection(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/membros`))
    );
  });

  it('quem não é da sala NÃO lista os membros dela', async () => {
    await assertFails(getDocs(collection(como('uid-estranho'), `salas/${SALA_A}/membros`)));
  });
});

describe('chamados da sala — escopo por turma (AC-SALA-07, AC-SEC-02)', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semearMembro(SALA_A, CARLOS, 'professor');
    await semearMembro(SALA_A, ANA);
    await semearSala(SALA_B, { dono: BRUNO });
    await semearMembro(SALA_B, BRUNO, 'professor');
    await semear(`salas/${SALA_B}/chamados/da-turma-b`, {
      autorUid: BRUNO,
      autorNome: 'Bruno Alves',
      descricao: 'chamado da outra turma',
      atendido: false,
      horario: Timestamp.now(),
    });
  });

  it('o aluno da sala A lê os chamados da sala A', async () => {
    await assertSucceeds(getDocs(collection(como(ANA), `salas/${SALA_A}/chamados`)));
  });

  it('o aluno da sala A recebe permission-denied na sala B', async () => {
    await assertFails(getDocs(collection(como(ANA), `salas/${SALA_B}/chamados`)));
    await assertFails(getDoc(doc(como(ANA), `salas/${SALA_B}/chamados/da-turma-b`)));
  });

  it('o aluno abre o próprio chamado, com o carimbo do servidor', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/chamados/c1`), {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        nome: 'Ana Souza',
        email: ANA_EMAIL,
        descricao: 'O Visual Studio não abre.',
        cor: 'hsl(210, 70%, 80%)',
        imagem: null,
        atendido: false,
        horario: serverTimestamp(),
      })
    );
  });

  it('o aluno NÃO abre chamado em nome de outro', async () => {
    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/chamados/c2`), {
        autorUid: BRUNO,
        autorNome: 'Bruno Alves',
        descricao: 'chamado forjado',
        atendido: false,
        horario: serverTimestamp(),
      })
    );
  });

  it('quem não é da sala NÃO abre chamado nela', async () => {
    await assertFails(
      setDoc(doc(como(BRUNO, BRUNO_EMAIL), `salas/${SALA_A}/chamados/c3`), {
        autorUid: BRUNO,
        autorNome: 'Bruno Alves',
        descricao: 'invasão',
        atendido: false,
        horario: serverTimestamp(),
      })
    );
  });

  it.each([
    ['descrição vazia', { descricao: '' }],
    ['descrição acima de 1000 caracteres', { descricao: 'x'.repeat(1001) }],
    ['horário escolhido pelo cliente', { horario: Timestamp.fromMillis(0) }],
  ])('recusa chamado com %s', async (_rotulo, sobrescritas) => {
    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/chamados/invalido`), {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        descricao: 'válida',
        atendido: false,
        horario: serverTimestamp(),
        ...sobrescritas,
      })
    );
  });

  describe('exclusão (AC-CHAMADO-05)', () => {
    beforeEach(async () => {
      await semearMembro(SALA_A, BRUNO);
      await semear(`salas/${SALA_A}/chamados/da-ana`, {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        descricao: 'chamado da Ana',
        atendido: false,
        horario: Timestamp.now(),
      });
    });

    it('a autora apaga o próprio chamado', async () => {
      await assertSucceeds(deleteDoc(doc(como(ANA), `salas/${SALA_A}/chamados/da-ana`)));
    });

    it('o professor da sala apaga qualquer chamado dela', async () => {
      await assertSucceeds(
        deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/chamados/da-ana`))
      );
    });

    it('um colega NÃO apaga o chamado da Ana — era o buraco da v0.1.0', async () => {
      await assertFails(deleteDoc(doc(como(BRUNO), `salas/${SALA_A}/chamados/da-ana`)));
    });

    it('o professor de outra sala NÃO apaga chamado desta', async () => {
      await semear(`autorizados/outro@senai.br`, { Tipo: 'professor' });

      await assertFails(
        deleteDoc(doc(como('uid-outro', 'outro@senai.br'), `salas/${SALA_A}/chamados/da-ana`))
      );
    });
  });

  describe('sala arquivada é somente-leitura (AC-SALA-10)', () => {
    beforeEach(async () => {
      await semear(`salas/${SALA_A}/chamados/antigo`, {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        descricao: 'do ano passado',
        atendido: false,
        horario: Timestamp.now(),
      });
      await semearSala(SALA_A, { ativa: false });
    });

    it('a turma continua lendo o que já estava lá', async () => {
      await assertSucceeds(getDocs(collection(como(ANA), `salas/${SALA_A}/chamados`)));
    });

    it('ninguém abre chamado novo', async () => {
      await assertFails(
        setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/chamados/novo`), {
          autorUid: ANA,
          autorNome: 'Ana Souza',
          descricao: 'tarde demais',
          atendido: false,
          horario: serverTimestamp(),
        })
      );
    });

    it('nem o professor apaga chamado de sala arquivada', async () => {
      await assertFails(
        deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/chamados/antigo`))
      );
    });
  });
});

describe('chat da sala — escopo por turma (AC-CHAT-10, AC-SEC-02)', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semearMembro(SALA_A, CARLOS, 'professor');
    await semearMembro(SALA_A, ANA);
    await semearMembro(SALA_A, BRUNO);
    await semearSala(SALA_B, { dono: 'uid-outro' });
    await semear(`salas/${SALA_B}/chat/da-turma-b`, {
      autorUid: 'uid-outro',
      autorNome: 'Outro',
      texto: 'conversa da outra turma',
      horario: Timestamp.now(),
    });
  });

  it('o membro envia mensagem na própria sala', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/chat/m1`), {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        nome: 'Ana Souza',
        email: ANA_EMAIL,
        texto: 'Alguém conseguiu rodar?',
        horario: serverTimestamp(),
      })
    );
  });

  it('o aluno da sala A NÃO lê a conversa da sala B', async () => {
    await assertFails(getDocs(collection(como(ANA), `salas/${SALA_B}/chat`)));
  });

  it('o aluno NÃO envia mensagem assinada por outro', async () => {
    await assertFails(
      setDoc(doc(como(ANA, ANA_EMAIL), `salas/${SALA_A}/chat/m2`), {
        autorUid: BRUNO,
        autorNome: 'Bruno Alves',
        texto: 'não fui eu',
        horario: serverTimestamp(),
      })
    );
  });

  // INVERTIDO pela task 06 (AC-CHAT-08). O caso nasceu na task 03 provando que
  // cada aluno apagava a própria mensagem, e isso parecia inofensivo — até se
  // juntar ao `!clear`. Enquanto o aluno pudesse apagar qualquer documento do
  // chat, o `!clear` dele apagaria tudo o que fosse dele: a conversa da turma
  // ficaria pela metade, com a metade que sumiu sendo escolhida por quem
  // digitou o comando. A autorização de apagar mensagem passa a ser inteira do
  // professor dono da sala, e é a rule que a garante.
  //
  // O caso continua aqui, com a asserção virada: é essa inversão que comprova
  // a correção, e é ela que vai reprovar o CI se a permissão voltar por
  // descuido.
  it('o aluno NÃO apaga nem a própria mensagem — só o professor apaga (AC-CHAT-08)', async () => {
    await semear(`salas/${SALA_A}/chat/da-ana`, {
      autorUid: ANA,
      autorNome: 'Ana Souza',
      texto: 'minha',
      horario: Timestamp.now(),
    });

    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA_A}/chat/da-ana`)));
  });

  it('o !clear de um aluno não apaga NENHUMA mensagem da turma (AC-CHAT-08)', async () => {
    // O comando em si é do cliente; o que o impede de funcionar é isto. Um
    // aluno com o cliente adulterado, chamando `deleteDoc` direto pelo
    // DevTools, recebe a mesma recusa.
    await semear(`salas/${SALA_A}/chat/da-ana`, {
      autorUid: ANA,
      autorNome: 'Ana Souza',
      texto: 'minha',
      horario: Timestamp.now(),
    });
    await semear(`salas/${SALA_A}/chat/do-bruno`, {
      autorUid: BRUNO,
      autorNome: 'Bruno Alves',
      texto: 'do Bruno',
      horario: Timestamp.now(),
    });

    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA_A}/chat/da-ana`)));
    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA_A}/chat/do-bruno`)));
  });

  it('um aluno NÃO apaga a mensagem do colega — era o !clear da turma inteira', async () => {
    await semear(`salas/${SALA_A}/chat/do-bruno`, {
      autorUid: BRUNO,
      autorNome: 'Bruno Alves',
      texto: 'do Bruno',
      horario: Timestamp.now(),
    });

    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA_A}/chat/do-bruno`)));
  });

  it('o professor da sala apaga qualquer mensagem dela', async () => {
    await semear(`salas/${SALA_A}/chat/do-bruno`, {
      autorUid: BRUNO,
      autorNome: 'Bruno Alves',
      texto: 'do Bruno',
      horario: Timestamp.now(),
    });

    await assertSucceeds(
      deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA_A}/chat/do-bruno`))
    );
  });
});

describe('indicePins — o PIN aponta para a sala, e só isso (AC-SEC-05)', () => {
  beforeEach(async () => {
    await semearSala(SALA_A);
    await semear(`indicePins/${PIN_A}`, {
      salaId: SALA_A,
      ativo: true,
      criadoEm: Timestamp.now(),
    });
  });

  it('com a tentativa do mesmo PIN, o aluno resolve a sala', async () => {
    await semearTentativa(ANA, PIN_A);

    await assertSucceeds(getDoc(doc(como(ANA), `indicePins/${PIN_A}`)));
  });

  it('sem tentativa registrada, a consulta é negada', async () => {
    await assertFails(getDoc(doc(como(ANA), `indicePins/${PIN_A}`)));
  });

  it('a tentativa de um PIN não serve para consultar outro', async () => {
    await semearTentativa(ANA, '000000');

    await assertFails(getDoc(doc(como(ANA), `indicePins/${PIN_A}`)));
  });

  it('a tentativa envelhecida não serve mais', async () => {
    await semearTentativa(ANA, PIN_A, { segundosAtras: 120 });

    await assertFails(getDoc(doc(como(ANA), `indicePins/${PIN_A}`)));
  });

  it('depois do limite de tentativas, nem com o PIN certo', async () => {
    await semearTentativa(ANA, PIN_A, { tentativas: 6 });

    await assertFails(getDoc(doc(como(ANA), `indicePins/${PIN_A}`)));
  });

  it('NINGUÉM varre o índice — seria o mapa de todos os PINs do SENAI', async () => {
    await semearTentativa(ANA, PIN_A);

    await assertFails(getDocs(collection(como(ANA), 'indicePins')));
    await assertFails(getDocs(collection(como(CARLOS, CARLOS_EMAIL), 'indicePins')));
  });

  it('o dono da sala indexa um PIN para ela', async () => {
    await assertSucceeds(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), 'indicePins/222222'), {
        salaId: SALA_A,
        ativo: true,
        criadoEm: serverTimestamp(),
      })
    );
  });

  it('ninguém indexa PIN para a sala de outro professor', async () => {
    await semear(`autorizados/${BRUNO_EMAIL}`, { Tipo: 'professor' });

    await assertFails(
      setDoc(doc(como(BRUNO, BRUNO_EMAIL), 'indicePins/333333'), {
        salaId: SALA_A,
        ativo: true,
        criadoEm: serverTimestamp(),
      })
    );
  });

  it('o índice é imutável: é assim que o PIN fica único entre salas', async () => {
    await semearSala(SALA_B, { dono: CARLOS });

    await assertFails(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), `indicePins/${PIN_A}`), {
        salaId: SALA_B,
        ativo: true,
        criadoEm: serverTimestamp(),
      })
    );
    await assertFails(deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `indicePins/${PIN_A}`)));
  });

  it('recusa id que não é um PIN de seis dígitos', async () => {
    await assertFails(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), 'indicePins/abcdef'), {
        salaId: SALA_A,
        ativo: true,
        criadoEm: serverTimestamp(),
      })
    );
  });
});

describe('tentativasPin — o limite de força bruta (AC-SALA-12)', () => {
  /** A escrita que o cliente faz a cada tentativa. */
  function tentativa(pin, tentativas) {
    return {
      pinTentado: pin,
      tentativas,
      janelaIniciadaEm: serverTimestamp(),
      ultimaTentativaEm: serverTimestamp(),
    };
  }

  it('a primeira tentativa da janela é registrada', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), `tentativasPin/${ANA}`), tentativa(PIN_A, 1))
    );
  });

  it('a primeira tentativa não começa valendo cinco', async () => {
    await assertFails(setDoc(doc(como(ANA), `tentativasPin/${ANA}`), tentativa(PIN_A, 5)));
  });

  it('incrementa de um em um até o teto', async () => {
    await semearTentativa(ANA, PIN_A, { tentativas: 4 });

    await assertSucceeds(
      updateDoc(doc(como(ANA), `tentativasPin/${ANA}`), {
        pinTentado: '111111',
        tentativas: 5,
        ultimaTentativaEm: serverTimestamp(),
      })
    );
  });

  it('a sexta tentativa da janela é recusada — é o bloqueio', async () => {
    await semearTentativa(ANA, PIN_A, { tentativas: 5 });

    await assertFails(
      updateDoc(doc(como(ANA), `tentativasPin/${ANA}`), {
        pinTentado: '111111',
        tentativas: 6,
        ultimaTentativaEm: serverTimestamp(),
      })
    );
  });

  it('não dá para pular o contador direto para um número baixo', async () => {
    await semearTentativa(ANA, PIN_A, { tentativas: 5 });

    await assertFails(
      updateDoc(doc(como(ANA), `tentativasPin/${ANA}`), {
        pinTentado: '111111',
        tentativas: 1,
        ultimaTentativaEm: serverTimestamp(),
      })
    );
  });

  it('reiniciar a janela antes dos cinco minutos é recusado', async () => {
    await semearTentativa(ANA, PIN_A, { tentativas: 5, segundosAtras: 60 });

    await assertFails(
      updateDoc(doc(como(ANA), `tentativasPin/${ANA}`), {
        pinTentado: '111111',
        tentativas: 1,
        janelaIniciadaEm: serverTimestamp(),
        ultimaTentativaEm: serverTimestamp(),
      })
    );
  });

  it('depois dos cinco minutos, a janela recomeça', async () => {
    await semearTentativa(ANA, PIN_A, { tentativas: 5, segundosAtras: 400 });

    await assertSucceeds(
      updateDoc(doc(como(ANA), `tentativasPin/${ANA}`), {
        pinTentado: '111111',
        tentativas: 1,
        janelaIniciadaEm: serverTimestamp(),
        ultimaTentativaEm: serverTimestamp(),
      })
    );
  });

  it('apagar o próprio contador seria zerar o limite: negado', async () => {
    await semearTentativa(ANA, PIN_A, { tentativas: 5 });

    await assertFails(deleteDoc(doc(como(ANA), `tentativasPin/${ANA}`)));
  });

  it('ninguém escreve nem lê o contador de outra pessoa', async () => {
    await semearTentativa(ANA, PIN_A);

    await assertFails(getDoc(doc(como(BRUNO), `tentativasPin/${ANA}`)));
    await assertFails(setDoc(doc(como(BRUNO), `tentativasPin/${ANA}`), tentativa(PIN_A, 1)));
  });

  it('recusa carimbo de tentativa escolhido pelo cliente', async () => {
    await assertFails(
      setDoc(doc(como(ANA), `tentativasPin/${ANA}`), {
        pinTentado: PIN_A,
        tentativas: 1,
        janelaIniciadaEm: serverTimestamp(),
        ultimaTentativaEm: Timestamp.fromMillis(0),
      })
    );
  });
});

describe('usuarios/{uid}/salas — o espelho da lista (AC-SALA-06)', () => {
  it('cada um lê e escreve o próprio espelho', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), `usuarios/${ANA}/salas/${SALA_A}`), {
        salaId: SALA_A,
        papel: 'aluno',
        entrouEm: serverTimestamp(),
      })
    );
    await assertSucceeds(getDocs(collection(como(ANA), `usuarios/${ANA}/salas`)));
  });

  it('ninguém lê nem escreve o espelho de outra pessoa', async () => {
    await semear(`usuarios/${ANA}/salas/${SALA_A}`, { salaId: SALA_A, papel: 'aluno' });

    await assertFails(getDocs(collection(como(BRUNO), `usuarios/${ANA}/salas`)));
    await assertFails(
      setDoc(doc(como(BRUNO), `usuarios/${ANA}/salas/${SALA_B}`), { salaId: SALA_B })
    );
  });

  it('o espelho sozinho não dá acesso à sala (AC-SEC-02)', async () => {
    await semearSala(SALA_A);
    await semear(`usuarios/${BRUNO}/salas/${SALA_A}`, { salaId: SALA_A, papel: 'aluno' });

    await assertFails(getDoc(doc(como(BRUNO), `salas/${SALA_A}`)));
  });
});

describe('usuarios — leitura restrita (AC-SEC-01)', () => {
  beforeEach(async () => {
    await semear(`usuarios/${ANA}`, { nome: 'Ana Souza', email: ANA_EMAIL, tipo: 'aluno' });
  });

  it('cada um lê o próprio documento', async () => {
    await assertSucceeds(getDoc(doc(como(ANA, ANA_EMAIL), `usuarios/${ANA}`)));
  });

  it('um aluno NÃO lê o documento de outro aluno', async () => {
    await assertFails(getDoc(doc(como(BRUNO, BRUNO_EMAIL), `usuarios/${ANA}`)));
  });

  it('o professor lê, porque precisa saber quem está na sala', async () => {
    await assertSucceeds(getDoc(doc(como(CARLOS, CARLOS_EMAIL), `usuarios/${ANA}`)));
  });
});
