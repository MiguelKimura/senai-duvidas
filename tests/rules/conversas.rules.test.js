// Security Rules das conversas diretas — AC-DM-04.
//
// Este é o arquivo mais importante da task 06. O AC-DM-04 não diz "a interface
// não mostra a conversa dos outros": diz que a privacidade é **garantida por
// Firestore Rules**. A diferença entre as duas coisas é a diferença entre uma
// conversa privada e uma conversa que parece privada — e quem abre o DevTools
// numa sala de informática de curso técnico é exatamente o público desta
// aplicação.
//
// A rule é uma linha:
//
//     allow read: if request.auth.uid in resource.data.participantes;
//
// E ela tem uma consequência que precisa estar sob teste: no Firestore, uma
// **consulta de coleção** não filtra pelo que a rule permite — ela é aceita ou
// negada inteira. O servidor só aceita a consulta quando consegue provar, pela
// forma dela, que todo resultado possível passa na rule. É por isso que o
// cliente precisa consultar com `where('participantes', 'array-contains', uid)`
// e por isso que a consulta sem filtro é negada, mesmo para quem tem conversas.
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
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} = require('firebase/firestore');
const { projetoDeTeste } = require('./projetoDeTeste');

let ambiente;

const CARLOS = 'uid-carlos';
const CARLOS_EMAIL = 'carlos@senai.br';
const ANA = 'uid-ana';
const BRUNO = 'uid-bruno';
const FORASTEIRO = 'uid-forasteiro';

const SALA = 'sala-a';

/** O id determinístico que `services/chat.js` calcula. */
function idDaConversa(a, b) {
  return [a, b].sort().join('_');
}

const CONVERSA = idDaConversa(CARLOS, ANA);

function como(uid, email) {
  return ambiente.authenticatedContext(uid, email ? { email } : undefined).firestore();
}

async function semear(caminho, dados) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), caminho), dados);
  });
}

async function semearSala({ ativa = true } = {}) {
  await semear(`salas/${SALA}`, {
    nome: 'Mecânica 2º ano',
    curso: 'Mecânica — Turma B',
    anoLetivo: 2026,
    professorUid: CARLOS,
    professorNome: 'Carlos Lima',
    ativa,
    arquivadaEm: ativa ? null : Timestamp.now(),
    criadaEm: Timestamp.now(),
  });
}

async function semearMembro(uid, papel = 'aluno') {
  await semear(`salas/${SALA}/membros/${uid}`, {
    nome: 'Alguém',
    email: `${uid}@senai.br`,
    papel,
    entrouEm: Timestamp.now(),
  });
}

/** A conversa entre o Carlos e a Ana, já criada. */
async function semearConversa() {
  await semear(`salas/${SALA}/conversas/${CONVERSA}`, {
    participantes: [ANA, CARLOS].sort(),
    participantesNomes: { [ANA]: 'Ana Souza', [CARLOS]: 'Carlos Lima' },
    naoLidas: { [ANA]: 0, [CARLOS]: 0 },
    ultimaMensagem: null,
    criadaEm: Timestamp.now(),
  });
}

/** O documento que o cliente escreve ao abrir a conversa. */
function conversaNova(a, b) {
  const [primeiro, segundo] = [a, b].sort();

  return {
    participantes: [primeiro, segundo],
    participantesNomes: { [primeiro]: 'Alguém', [segundo]: 'Outro alguém' },
    naoLidas: { [primeiro]: 0, [segundo]: 0 },
    ultimaMensagem: null,
    criadaEm: serverTimestamp(),
  };
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
  await semearSala();
  await semearMembro(CARLOS, 'professor');
  await semearMembro(ANA);
  await semearMembro(BRUNO);
});

describe('conversa direta — leitura do documento (AC-DM-04)', () => {
  beforeEach(semearConversa);

  it('a aluna participante lê a conversa', async () => {
    await assertSucceeds(getDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`)));
  });

  it('o professor participante lê a conversa', async () => {
    await assertSucceeds(
      getDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/conversas/${CONVERSA}`))
    );
  });

  it('um TERCEIRO da mesma sala recebe permission-denied no get', async () => {
    // O caso central do AC-DM-04. O Bruno é membro legítimo da sala, lê a
    // conversa da turma, lê a fila de chamados — e não lê isto.
    await assertFails(getDoc(doc(como(BRUNO), `salas/${SALA}/conversas/${CONVERSA}`)));
  });

  it('quem nem é da sala também não lê', async () => {
    await assertFails(getDoc(doc(como(FORASTEIRO), `salas/${SALA}/conversas/${CONVERSA}`)));
  });

  it('nem o professor DONO da sala lê a conversa de dois alunos', async () => {
    // Ser dono da sala dá poder sobre a conversa pública e sobre os vínculos.
    // Não dá sobre a conversa privada de outras duas pessoas — e o AC-DM-08,
    // que prevê exportação pedagógica, é escopo de outra versão e exige avisar
    // os participantes antes.
    const entreAlunos = idDaConversa(ANA, BRUNO);
    await semear(`salas/${SALA}/conversas/${entreAlunos}`, {
      participantes: [ANA, BRUNO].sort(),
      participantesNomes: { [ANA]: 'Ana', [BRUNO]: 'Bruno' },
      naoLidas: { [ANA]: 0, [BRUNO]: 0 },
      ultimaMensagem: null,
      criadaEm: Timestamp.now(),
    });

    await assertFails(
      getDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/conversas/${entreAlunos}`))
    );
  });
});

describe('conversa direta — a CONSULTA da coleção (AC-DM-04)', () => {
  beforeEach(semearConversa);

  it('a consulta com array-contains do próprio uid é aceita', async () => {
    await assertSucceeds(
      getDocs(
        query(
          collection(como(ANA), `salas/${SALA}/conversas`),
          where('participantes', 'array-contains', ANA)
        )
      )
    );
  });

  it('a consulta SEM filtro é negada, mesmo para quem tem conversa', async () => {
    // No Firestore a rule não filtra o resultado: ela aceita ou nega a consulta
    // inteira. Sem o `array-contains`, o servidor não consegue provar que todo
    // resultado passa na rule, e nega tudo.
    await assertFails(getDocs(collection(como(ANA), `salas/${SALA}/conversas`)));
  });

  it('um terceiro NÃO consulta as conversas de outra pessoa', async () => {
    await assertFails(
      getDocs(
        query(
          collection(como(BRUNO), `salas/${SALA}/conversas`),
          where('participantes', 'array-contains', ANA)
        )
      )
    );
  });

  it('a consulta do terceiro pelo PRÓPRIO uid é aceita e não traz nada', async () => {
    const resultado = await assertSucceeds(
      getDocs(
        query(
          collection(como(BRUNO), `salas/${SALA}/conversas`),
          where('participantes', 'array-contains', BRUNO)
        )
      )
    );

    expect(resultado.size).toBe(0);
  });
});

describe('conversa direta — criação', () => {
  it('o professor abre conversa com uma aluna da sala (AC-DM-02)', async () => {
    await assertSucceeds(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/conversas/${CONVERSA}`),
        conversaNova(CARLOS, ANA)
      )
    );
  });

  it('a aluna abre conversa com o professor da sala (AC-DM-03)', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`), conversaNova(ANA, CARLOS))
    );
  });

  it('ninguém cria conversa da qual não participa', async () => {
    const entreOutros = idDaConversa(ANA, CARLOS);

    await assertFails(
      setDoc(doc(como(BRUNO), `salas/${SALA}/conversas/${entreOutros}`), conversaNova(ANA, CARLOS))
    );
  });

  it('o id precisa ser o determinístico: outro id é recusado', async () => {
    // É a rule que garante que os dois lados caem no MESMO documento. Sem
    // isto, um cliente adulterado criaria `carlos_ana` e `ana_carlos` e cada
    // um ficaria com metade da conversa.
    await assertFails(
      setDoc(
        doc(como(ANA), `salas/${SALA}/conversas/conversa-inventada`),
        conversaNova(ANA, CARLOS)
      )
    );
  });

  it('participantes fora de ordem são recusados', async () => {
    const [primeiro, segundo] = [ANA, CARLOS].sort();

    await assertFails(
      setDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`), {
        ...conversaNova(ANA, CARLOS),
        participantes: [segundo, primeiro],
      })
    );
  });

  it('não se abre conversa com quem não é da sala', async () => {
    const comForasteiro = idDaConversa(ANA, FORASTEIRO);

    await assertFails(
      setDoc(
        doc(como(ANA), `salas/${SALA}/conversas/${comForasteiro}`),
        conversaNova(ANA, FORASTEIRO)
      )
    );
  });

  it('sala arquivada não recebe conversa nova (AC-SALA-10)', async () => {
    await semearSala({ ativa: false });

    await assertFails(
      setDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`), conversaNova(ANA, CARLOS))
    );
  });
});

describe('conversa direta — atualização do resumo', () => {
  beforeEach(semearConversa);

  it('a participante atualiza a última mensagem e o contador do outro', async () => {
    await assertSucceeds(
      updateDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`), {
        ultimaMensagem: { texto: 'oi', autorUid: ANA, horario: serverTimestamp() },
        [`naoLidas.${CARLOS}`]: 1,
      })
    );
  });

  it('a participante zera o próprio contador ao abrir', async () => {
    await assertSucceeds(
      updateDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`), {
        [`naoLidas.${ANA}`]: 0,
      })
    );
  });

  it('um terceiro NÃO atualiza a conversa dos outros', async () => {
    await assertFails(
      updateDoc(doc(como(BRUNO), `salas/${SALA}/conversas/${CONVERSA}`), {
        ultimaMensagem: { texto: 'entrei aqui', autorUid: BRUNO, horario: serverTimestamp() },
      })
    );
  });

  it('participante NÃO se acrescenta nem troca a lista de participantes', async () => {
    await assertFails(
      updateDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`), {
        participantes: [ANA, BRUNO, CARLOS].sort(),
      })
    );
  });

  it('ninguém apaga a conversa — nem os participantes', async () => {
    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}`)));
  });
});

describe('conversa direta — as mensagens (AC-DM-04)', () => {
  beforeEach(async () => {
    await semearConversa();
    await semear(`salas/${SALA}/conversas/${CONVERSA}/mensagens/m1`, {
      autorUid: CARLOS,
      autorNome: 'Carlos Lima',
      texto: 'Ana, me procure depois da aula',
      horario: Timestamp.now(),
      lidaEm: null,
    });
  });

  it('a participante lê as mensagens da conversa', async () => {
    await assertSucceeds(
      getDocs(collection(como(ANA), `salas/${SALA}/conversas/${CONVERSA}/mensagens`))
    );
  });

  it('um terceiro NÃO lê as mensagens, nem o documento individual', async () => {
    await assertFails(
      getDoc(doc(como(BRUNO), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m1`))
    );
    await assertFails(
      getDocs(collection(como(BRUNO), `salas/${SALA}/conversas/${CONVERSA}/mensagens`))
    );
  });

  it('a participante envia mensagem assinada por ela', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m2`), {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        texto: 'Pode ser às 15h?',
        horario: serverTimestamp(),
        lidaEm: null,
      })
    );
  });

  it('ninguém assina mensagem com o uid do outro', async () => {
    await assertFails(
      setDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m3`), {
        autorUid: CARLOS,
        autorNome: 'Carlos Lima',
        texto: 'não fui eu',
        horario: serverTimestamp(),
        lidaEm: null,
      })
    );
  });

  it('um terceiro NÃO escreve na conversa dos outros', async () => {
    await assertFails(
      setDoc(doc(como(BRUNO), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m4`), {
        autorUid: BRUNO,
        autorNome: 'Bruno Dias',
        texto: 'oi',
        horario: serverTimestamp(),
        lidaEm: null,
      })
    );
  });

  it('o horário da mensagem direta também é o do servidor (AC-TEMPO-01)', async () => {
    await assertFails(
      setDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m5`), {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        texto: 'quero furar a fila',
        horario: Timestamp.fromMillis(Date.now() - 86400000),
        lidaEm: null,
      })
    );
  });

  it('o limite de 500 caracteres vale na conversa direta (AC-CHAT-09)', async () => {
    await assertFails(
      setDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m6`), {
        autorUid: ANA,
        autorNome: 'Ana Souza',
        texto: 'a'.repeat(501),
        horario: serverTimestamp(),
        lidaEm: null,
      })
    );
  });

  it('a destinatária marca a mensagem como lida', async () => {
    await assertSucceeds(
      updateDoc(doc(como(ANA), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m1`), {
        lidaEm: serverTimestamp(),
      })
    );
  });

  it('ninguém apaga mensagem de conversa direta', async () => {
    await assertFails(
      deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/conversas/${CONVERSA}/mensagens/m1`))
    );
  });
});
