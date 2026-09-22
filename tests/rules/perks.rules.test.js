// Security Rules dos perks — AC-PERK-07, AC-PERK-10, AC-SEC-03.
//
// O AC-PERK-07 não diz "a interface só mostra o botão para o professor": diz
// que a concessão é garantida por **Firestore Rules**. A diferença entre as
// duas coisas é a diferença entre uma premiação e um campo que qualquer aluno
// escreve pelo DevTools — e um perk de prioridade escrito pelo próprio
// premiado é, literalmente, furar a fila da turma.
//
// A auditoria (AC-PERK-10) tem o mesmo problema pelo avesso: um log que o
// autor do evento possa reescrever depois não é log. Aqui ela é append-only no
// servidor: `create` do dono da sala, `update` e `delete` negados a todos.
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
const DENISE = 'uid-denise';
const DENISE_EMAIL = 'denise@senai.br';
const ANA = 'uid-ana';
const BRUNO = 'uid-bruno';
const FORASTEIRO = 'uid-forasteiro';

const SALA = 'sala-a';
const OUTRA_SALA = 'sala-b';
const PERK = 'perk-1';

function como(uid, email) {
  return ambiente.authenticatedContext(uid, email ? { email } : undefined).firestore();
}

async function semear(caminho, dados) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), caminho), dados);
  });
}

async function semearSala(salaId, professorUid, { ativa = true } = {}) {
  await semear(`salas/${salaId}`, {
    nome: 'Mecânica 2º ano',
    curso: 'Mecânica — Turma B',
    anoLetivo: 2026,
    professorUid,
    professorNome: 'Quem criou',
    ativa,
    arquivadaEm: ativa ? null : Timestamp.now(),
    criadaEm: Timestamp.now(),
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

/** O perk como o cliente do professor o escreve. */
function perkNovo(sobrescritas = {}) {
  return {
    alunoUid: ANA,
    alunoNome: 'Ana Souza',
    tipo: 'prioridade',
    nivel: 2,
    justificativa: 'Ajudou o colega a achar o erro de compilação.',
    anunciarParaSala: false,
    concedidoPor: CARLOS,
    concedidoPorNome: 'Carlos Lima',
    concedidoEm: serverTimestamp(),
    expiraEm: Timestamp.fromDate(new Date('2026-10-01T12:00:00.000Z')),
    revogadoEm: null,
    visualizadoEm: null,
    ...sobrescritas,
  };
}

/** Um perk já gravado, para os testes de update. */
async function semearPerk(sobrescritas = {}) {
  await semear(`salas/${SALA}/perks/${PERK}`, {
    ...perkNovo(),
    concedidoEm: Timestamp.now(),
    ...sobrescritas,
  });
}

/** O evento de auditoria como o cliente do professor o escreve. */
function eventoNovo(sobrescritas = {}) {
  return {
    acao: 'conceder',
    perkId: PERK,
    alunoUid: ANA,
    atorUid: CARLOS,
    em: serverTimestamp(),
    detalhes: 'prioridade nível 2',
    ...sobrescritas,
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

  await semear(`autorizados/${CARLOS_EMAIL}`, { Tipo: 'professor' });
  await semear(`autorizados/${DENISE_EMAIL}`, { Tipo: 'professor' });

  await semearSala(SALA, CARLOS);
  await semearSala(OUTRA_SALA, DENISE);

  await semearMembro(SALA, CARLOS, 'professor');
  await semearMembro(SALA, ANA);
  await semearMembro(SALA, BRUNO);
  await semearMembro(OUTRA_SALA, DENISE, 'professor');
});

describe('perks — quem concede (AC-PERK-07)', () => {
  it('o professor dono da sala concede um perk a um aluno dela', async () => {
    await assertSucceeds(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/perks/${PERK}`), perkNovo())
    );
  });

  // O ataque mais direto e mais provável: a própria aluna abre o console e
  // escreve o documento que a colocaria no topo da fila.
  it('o aluno NÃO concede um perk a si mesmo', async () => {
    await assertFails(
      setDoc(
        doc(como(ANA), `salas/${SALA}/perks/${PERK}`),
        perkNovo({ concedidoPor: ANA, concedidoPorNome: 'Ana Souza' })
      )
    );
  });

  it('o aluno NÃO concede um perk a um colega', async () => {
    await assertFails(
      setDoc(
        doc(como(BRUNO), `salas/${SALA}/perks/${PERK}`),
        perkNovo({ concedidoPor: BRUNO, concedidoPorNome: 'Bruno Alves' })
      )
    );
  });

  // Ser professor no SENAI não é ser professor DESTA sala — a mesma regra que
  // vale para o chamado e para o vínculo (AC-SEC-02).
  it('o professor de outra sala NÃO concede perk nesta sala', async () => {
    await assertFails(
      setDoc(
        doc(como(DENISE, DENISE_EMAIL), `salas/${SALA}/perks/${PERK}`),
        perkNovo({ concedidoPor: DENISE, concedidoPorNome: 'Denise Rocha' })
      )
    );
  });

  it('o professor NÃO concede perk a quem não é membro da sala', async () => {
    await assertFails(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/perks/${PERK}`),
        perkNovo({ alunoUid: FORASTEIRO })
      )
    );
  });

  it('o professor NÃO concede perk assinando em nome de outra pessoa', async () => {
    await assertFails(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/perks/${PERK}`),
        perkNovo({ concedidoPor: DENISE })
      )
    );
  });

  it('a sala arquivada não recebe perk novo', async () => {
    await semearSala(SALA, CARLOS, { ativa: false });

    await assertFails(
      setDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/perks/${PERK}`), perkNovo())
    );
  });
});

describe('perks — a forma do documento', () => {
  async function concederCom(sobrescritas) {
    return setDoc(
      doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/perks/${PERK}`),
      perkNovo(sobrescritas)
    );
  }

  it('aceita perk permanente, com expiraEm nulo', async () => {
    await assertSucceeds(concederCom({ expiraEm: null }));
  });

  it('aceita perk sem justificativa', async () => {
    await assertSucceeds(concederCom({ justificativa: null }));
  });

  it('recusa nível fora da faixa de 1 a 3', async () => {
    await assertFails(concederCom({ nivel: 0 }));
    await assertFails(concederCom({ nivel: 9 }));
  });

  it('recusa tipo que não está na lista', async () => {
    await assertFails(concederCom({ tipo: 'administrador' }));
  });

  it('recusa concedidoEm escolhido pelo cliente', async () => {
    await assertFails(
      concederCom({ concedidoEm: Timestamp.fromDate(new Date('2020-01-01T00:00:00.000Z')) })
    );
  });

  it('recusa perk que já nasce revogado ou já visualizado', async () => {
    await assertFails(concederCom({ revogadoEm: Timestamp.now() }));
    await assertFails(concederCom({ visualizadoEm: Timestamp.now() }));
  });

  it('recusa campo desconhecido no documento', async () => {
    await assertFails(concederCom({ pontos: 9999 }));
  });
});

describe('perks — quem lê (AC-PERK-05)', () => {
  beforeEach(async () => {
    await semearPerk();
  });

  // A fila do professor e a do aluno precisam ordenar igual, então os dois
  // leem os perks da sala. O que NÃO é público é a sala: quem não tem vínculo
  // não lê nada (AC-SEC-02).
  it('qualquer membro da sala lê os perks dela', async () => {
    await assertSucceeds(getDocs(collection(como(BRUNO), `salas/${SALA}/perks`)));
    await assertSucceeds(getDoc(doc(como(ANA), `salas/${SALA}/perks/${PERK}`)));
  });

  it('quem não é membro da sala não lê perk nenhum dela', async () => {
    await assertFails(getDocs(collection(como(FORASTEIRO), `salas/${SALA}/perks`)));
    await assertFails(getDoc(doc(como(FORASTEIRO), `salas/${SALA}/perks/${PERK}`)));
  });
});

describe('perks — revogar e visualizar (AC-PERK-07, AC-PERK-04)', () => {
  beforeEach(async () => {
    await semearPerk();
  });

  it('o professor dono revoga o perk', async () => {
    await assertSucceeds(
      updateDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/perks/${PERK}`), {
        revogadoEm: serverTimestamp(),
      })
    );
  });

  it('o aluno premiado NÃO revoga nem desrevoga o próprio perk', async () => {
    await assertFails(
      updateDoc(doc(como(ANA), `salas/${SALA}/perks/${PERK}`), {
        revogadoEm: serverTimestamp(),
      })
    );
  });

  it('o professor de outra sala NÃO revoga perk desta sala', async () => {
    await assertFails(
      updateDoc(doc(como(DENISE, DENISE_EMAIL), `salas/${SALA}/perks/${PERK}`), {
        revogadoEm: serverTimestamp(),
      })
    );
  });

  // O `visualizadoEm` é recibo de leitura: é ele que impede a animação de
  // repetir a cada refresh. Quem o escreve é o premiado, e é a única coisa
  // que ele escreve neste documento.
  it('o aluno premiado marca o perk como visualizado', async () => {
    await assertSucceeds(
      updateDoc(doc(como(ANA), `salas/${SALA}/perks/${PERK}`), {
        visualizadoEm: serverTimestamp(),
      })
    );
  });

  it('um colega NÃO marca como visualizado o perk de outra pessoa', async () => {
    await assertFails(
      updateDoc(doc(como(BRUNO), `salas/${SALA}/perks/${PERK}`), {
        visualizadoEm: serverTimestamp(),
      })
    );
  });

  it('o aluno NÃO aproveita a carona do visualizadoEm para subir o próprio nível', async () => {
    await assertFails(
      updateDoc(doc(como(ANA), `salas/${SALA}/perks/${PERK}`), {
        visualizadoEm: serverTimestamp(),
        nivel: 3,
      })
    );
  });

  it('o aluno NÃO estica a validade do próprio perk', async () => {
    await assertFails(
      updateDoc(doc(como(ANA), `salas/${SALA}/perks/${PERK}`), {
        expiraEm: Timestamp.fromDate(new Date('2030-01-01T00:00:00.000Z')),
      })
    );
  });

  it('o aluno NÃO desfaz o visualizadoEm para rever a animação', async () => {
    await semearPerk({ visualizadoEm: Timestamp.now() });

    await assertFails(
      updateDoc(doc(como(ANA), `salas/${SALA}/perks/${PERK}`), { visualizadoEm: null })
    );
  });

  // Apagar o perk apagaria o histórico da premiação, que é o que a vitrine
  // mostra (AC-PERK-06). Revogar é um campo, não uma deleção.
  it('ninguém apaga um perk — nem o professor dono', async () => {
    await assertFails(deleteDoc(doc(como(ANA), `salas/${SALA}/perks/${PERK}`)));
    await assertFails(
      deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/perks/${PERK}`))
    );
  });
});

describe('auditoriaPerks — append-only (AC-PERK-10)', () => {
  const EVENTO = 'evento-1';

  it('o professor dono registra o evento de concessão', async () => {
    await assertSucceeds(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`),
        eventoNovo()
      )
    );
  });

  it('o aluno NÃO registra evento de auditoria', async () => {
    await assertFails(
      setDoc(
        doc(como(ANA), `salas/${SALA}/auditoriaPerks/${EVENTO}`),
        eventoNovo({ atorUid: ANA })
      )
    );
  });

  it('o professor NÃO registra evento assinado por outra pessoa', async () => {
    await assertFails(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`),
        eventoNovo({ atorUid: DENISE })
      )
    );
  });

  // O evento de revogação precisa nomear o aluno como o de concessão: uma
  // auditoria em que metade dos eventos não diz de quem se está falando não
  // responde à pergunta que ela existe para responder (AC-PERK-10).
  it('registra o evento de revogação nomeando o aluno', async () => {
    await assertSucceeds(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`),
        eventoNovo({ acao: 'revogar', detalhes: 'concedi por engano' })
      )
    );
  });

  it('recusa evento de auditoria sem o aluno a que ele se refere', async () => {
    await assertFails(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`),
        eventoNovo({ acao: 'revogar', alunoUid: null })
      )
    );
  });

  it('recusa ação fora da lista e carimbo escolhido pelo cliente', async () => {
    await assertFails(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`),
        eventoNovo({ acao: 'apagar' })
      )
    );
    await assertFails(
      setDoc(
        doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`),
        eventoNovo({ em: Timestamp.fromDate(new Date('2020-01-01T00:00:00.000Z')) })
      )
    );
  });

  // Um log que o autor do evento possa reescrever depois não é log. Nem o
  // dono da sala reescreve: o valor da auditoria está em ela ser imutável.
  it('nem o dono da sala altera um evento já registrado', async () => {
    await semear(`salas/${SALA}/auditoriaPerks/${EVENTO}`, {
      ...eventoNovo(),
      em: Timestamp.now(),
    });

    await assertFails(
      updateDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`), {
        detalhes: 'outra coisa',
      })
    );
  });

  it('nem o dono da sala apaga um evento já registrado', async () => {
    await semear(`salas/${SALA}/auditoriaPerks/${EVENTO}`, {
      ...eventoNovo(),
      em: Timestamp.now(),
    });

    await assertFails(
      deleteDoc(doc(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks/${EVENTO}`))
    );
  });

  it('o dono da sala lê a auditoria dela; o aluno não', async () => {
    await semear(`salas/${SALA}/auditoriaPerks/${EVENTO}`, {
      ...eventoNovo(),
      em: Timestamp.now(),
    });

    await assertSucceeds(
      getDocs(collection(como(CARLOS, CARLOS_EMAIL), `salas/${SALA}/auditoriaPerks`))
    );
    await assertFails(getDocs(collection(como(ANA), `salas/${SALA}/auditoriaPerks`)));
  });
});

// As preferências de animação e som moram no documento do próprio usuário —
// campo aditivo, com dono claro. Um aluno que pudesse escrever no documento de
// outro desligaria a animação da turma inteira.
describe('usuarios/{uid}.preferencias — campo aditivo do dono (AC-PERK-08)', () => {
  beforeEach(async () => {
    await semear(`usuarios/${ANA}`, {
      uid: ANA,
      nome: 'Ana Souza',
      email: 'ana@senai.br',
      tipo: 'aluno',
    });
  });

  it('o dono grava as próprias preferências', async () => {
    await assertSucceeds(
      updateDoc(doc(como(ANA), `usuarios/${ANA}`), {
        preferencias: { animacoes: true, som: true },
      })
    );
  });

  it('outro aluno não grava as preferências alheias', async () => {
    await assertFails(
      updateDoc(doc(como(BRUNO), `usuarios/${ANA}`), {
        preferencias: { animacoes: false, som: false },
      })
    );
  });

  // O mesmo documento continua sendo a fonte do papel: gravar preferências não
  // pode virar uma carona para se promover a professor (AC-SEC-03).
  it('gravar preferências não abre caminho para virar professor', async () => {
    await assertFails(
      updateDoc(doc(como(ANA), `usuarios/${ANA}`), {
        preferencias: { animacoes: true, som: false },
        tipo: 'professor',
      })
    );
  });
});
