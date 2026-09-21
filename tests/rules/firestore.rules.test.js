// Testes das Security Rules do Firestore.
//
// Estes testes NÃO afirmam que o banco está seguro. Eles afirmam o contrário:
// documentam, de forma executável, cada permissão excessiva que a v0.1.0
// precisa para funcionar. É o baseline contra o qual a task 03 vai provar que
// apertou — quando ela endurecer as rules, os testes marcados TODO(task-03)
// invertem de `assertSucceeds` para `assertFails`, e é essa inversão que
// comprova a correção.
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  Timestamp,
  updateDoc,
} = require('firebase/firestore');
const { projetoDeTeste } = require('./projetoDeTeste');

let ambiente;

const ANA = 'uid-ana';
const BRUNO = 'uid-bruno';

/** Firestore autenticado como `uid`. */
function como(uid) {
  return ambiente.authenticatedContext(uid).firestore();
}

/**
 * Firestore autenticado como `uid` com `email` no token.
 *
 * `ehProfessor()` resolve a autorização por `autorizados/{email}`, então o
 * e-mail precisa estar no token — é ele que o servidor usa, e não um campo do
 * payload, que o cliente escolheria.
 */
function comoUsuarioComEmail(uid, email) {
  return ambiente.authenticatedContext(uid, { email }).firestore();
}

/** Grava um documento contornando as rules, para montar o cenário. */
async function semearComoAdministrador(caminho, dados) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await setDoc(doc(contexto.firestore(), caminho), dados);
  });
}

/** Firestore sem nenhuma sessão. */
function comoVisitante() {
  return ambiente.unauthenticatedContext().firestore();
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
});

describe('guarda de segurança da suíte', () => {
  it('nunca aponta para o projeto de produção', () => {
    expect(projetoDeTeste()).toBe('demo-senai-duvidas');
    expect(projetoDeTeste()).not.toBe('senai-duvidas');
  });

  it('exige um projectId demo-, que o SDK não leva para a nuvem', () => {
    expect(projetoDeTeste().startsWith('demo-')).toBe(true);
  });
});

describe('chamados — estado atual', () => {
  // AJUSTADO pela task 02. O caso continua sendo "o aluno cria o próprio
  // chamado", que é o caminho comum e não pode quebrar. O que mudou é o campo
  // `horario`: era a string ISO do relógio do aluno, e passa a ser o carimbo
  // do servidor, que é o que as rules agora exigem.
  it('um aluno autenticado cria o próprio chamado', async () => {
    const db = como(ANA);

    await assertSucceeds(
      setDoc(doc(db, 'chamados/c1'), {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        descricao: 'O Visual Studio não abre.',
        horario: serverTimestamp(),
        cor: 'hsl(210, 70%, 80%)',
        imagem: null,
      })
    );
  });

  it('qualquer pessoa autenticada lê a fila inteira', async () => {
    const db = como(ANA);
    await assertSucceeds(getDocs(collection(db, 'chamados')));
  });

  // INVERTIDO pela task 03. Nasceu como `assertSucceeds`, documentando que
  // qualquer cliente apagava o chamado de qualquer aluno. A coleção global
  // continua existindo como backup da migração, mas a exclusão passou a ser do
  // autor — identificado pelo e-mail do token, que é o que aqueles documentos
  // têm — ou do professor (AC-CHAMADO-05).
  it('Bruno NÃO apaga mais o chamado de Ana', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chamados/da-ana'), {
        email: 'ana@senai.br',
        descricao: 'chamado da Ana',
      });
    });

    await assertFails(
      deleteDoc(doc(comoUsuarioComEmail(BRUNO, 'bruno@senai.br'), 'chamados/da-ana'))
    );
  });

  it('a própria Ana continua apagando o chamado dela', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chamados/da-ana'), {
        email: 'ana@senai.br',
        descricao: 'chamado da Ana',
      });
    });

    await assertSucceeds(
      deleteDoc(doc(comoUsuarioComEmail(ANA, 'ana@senai.br'), 'chamados/da-ana'))
    );
  });

  // INVERTIDO pela task 03: era `assertSucceeds` nos dois.
  it('quem não está logado NÃO lê nem escreve chamados', async () => {
    const db = comoVisitante();

    await assertFails(getDocs(collection(db, 'chamados')));
    await assertFails(setDoc(doc(db, 'chamados/anonimo'), { descricao: 'sem sessão' }));
  });

  // Esta coleção continua global DE PROPÓSITO nesta versão: ela é o banco da
  // v0.4.0, e `scripts/migrar-para-salas.js` a copia para dentro da sala sem
  // apagá-la. Enquanto a pessoa não tem sala, o app lê daqui — é o fallback de
  // leitura da migração. O escopo por turma está em `salas/{salaId}/chamados`,
  // provado em `tests/rules/salas.rules.test.js`; aqui a fila global some só
  // na 1.0.0.
  it('a fila global continua legível para quem tem sessão, como backup da migração', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chamados/de-antes-da-migracao'), {
        descricao: 'chamado da v0.4.0',
      });
    });

    const lido = await getDoc(doc(como(ANA), 'chamados/de-antes-da-migracao'));
    expect(lido.exists()).toBe(true);
  });
});

describe('chat — estado atual', () => {
  // AJUSTADO pela task 02, pelo mesmo motivo do chamado: `new Date()` era o
  // relógio do aluno.
  it('um aluno autenticado envia mensagem', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), 'chat/m1'), {
        texto: 'Alguém conseguiu rodar?',
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        horario: serverTimestamp(),
      })
    );
  });

  // INVERTIDO pela task 03. Era o `!clear` visto do lado do servidor: um aluno
  // apagava a conversa inteira da turma. A coleção global continua como backup
  // da migração, mas cada um só apaga a própria mensagem.
  it('um aluno NÃO apaga mais a mensagem de outro — o !clear visto do servidor', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chat/do-bruno'), {
        texto: 'mensagem do Bruno',
        email: 'bruno@senai.br',
      });
    });

    await assertFails(
      deleteDoc(doc(comoUsuarioComEmail(ANA, 'ana@senai.br'), 'chat/do-bruno'))
    );
  });

  it('cada um continua apagando a própria mensagem', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chat/do-bruno'), {
        texto: 'mensagem do Bruno',
        email: 'bruno@senai.br',
      });
    });

    await assertSucceeds(
      deleteDoc(doc(comoUsuarioComEmail(BRUNO, 'bruno@senai.br'), 'chat/do-bruno'))
    );
  });
});

describe('usuarios — estado atual', () => {
  it('o cadastro grava o documento do próprio usuário', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), `usuarios/${ANA}`), {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
      })
    );
  });

  // INVERTIDO pela task 01. Este teste nasceu como `assertSucceeds` na task 00,
  // documentando a escalada de privilégio vista do servidor: o cliente escolhia
  // o próprio `tipo`. A task 01 fecha exatamente esse buraco (AC-AUTH-07,
  // AC-SEC-03), então a asserção inverte — e é a inversão que prova a correção.
  it('o cliente NÃO escolhe mais o próprio tipo', async () => {
    await assertFails(
      setDoc(doc(comoUsuarioComEmail(ANA, 'ana@senai.br'), `usuarios/${ANA}`), {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'professor',
      })
    );
  });

  // INVERTIDO pela task 01, pelo mesmo motivo: `ehDono()` passou a valer.
  it('Ana NÃO escreve mais no documento de usuário do Bruno', async () => {
    await assertFails(
      setDoc(doc(como(ANA), `usuarios/${BRUNO}`), { nome: 'nome trocado' })
    );
  });
});

// O papel do usuário é a única decisão de segurança que este app toma, e até
// aqui ela só existia no cliente: `utils/permissoes.js` consultava
// `autorizados` no navegador, e o servidor aceitava qualquer `tipo` que
// chegasse. Quem abrisse o DevTools se promovia a professor.
//
// `ehAutenticado()` e `ehProfessor()` levam a mesma regra para o servidor. A
// task 03 vai reusá-las em `chamados` e `chat`; aqui elas valem só para
// `usuarios`, que é onde o papel é gravado.
describe('usuarios — dono e autorização exigidos pelo servidor (AC-AUTH-07, AC-SEC-03)', () => {
  const CARLOS = 'uid-carlos';

  beforeEach(async () => {
    await semearComoAdministrador('autorizados/carlos@senai.br', { Tipo: 'professor' });
  });

  describe('ehAutenticado()', () => {
    it('nega a escrita de quem não tem sessão', async () => {
      await assertFails(
        setDoc(doc(comoVisitante(), `usuarios/${ANA}`), {
          nome: 'Ana Souza',
          email: 'ana@senai.br',
          tipo: 'aluno',
        })
      );
    });

    it('nega a leitura de quem não tem sessão — a coleção tem e-mail de aluno', async () => {
      await semearComoAdministrador(`usuarios/${ANA}`, { email: 'ana@senai.br', tipo: 'aluno' });

      await assertFails(getDoc(doc(comoVisitante(), `usuarios/${ANA}`)));
    });

    // ENDURECIDO pela task 03: era `ehAutenticado()`, e qualquer aluno lia o
    // nome e o e-mail de qualquer outro (AC-SEC-01).
    it('nega a leitura do documento alheio, mesmo com sessão', async () => {
      await semearComoAdministrador(`usuarios/${ANA}`, { email: 'ana@senai.br', tipo: 'aluno' });

      await assertFails(getDoc(doc(comoUsuarioComEmail(BRUNO, 'bruno@senai.br'), `usuarios/${ANA}`)));
    });

    it('permite que a pessoa autenticada leia o próprio documento', async () => {
      await semearComoAdministrador(`usuarios/${ANA}`, { email: 'ana@senai.br', tipo: 'aluno' });

      await assertSucceeds(getDoc(doc(como(ANA), `usuarios/${ANA}`)));
    });
  });

  describe('ehProfessor()', () => {
    it('deixa quem está em autorizados gravar o próprio tipo professor', async () => {
      await assertSucceeds(
        setDoc(doc(comoUsuarioComEmail(CARLOS, 'carlos@senai.br'), `usuarios/${CARLOS}`), {
          nome: 'Carlos Lima',
          email: 'carlos@senai.br',
          tipo: 'professor',
          uid: CARLOS,
        })
      );
    });

    it('ignora a caixa alta do e-mail do token', async () => {
      await assertSucceeds(
        setDoc(doc(comoUsuarioComEmail(CARLOS, 'Carlos@Senai.BR'), `usuarios/${CARLOS}`), {
          nome: 'Carlos Lima',
          email: 'carlos@senai.br',
          tipo: 'professor',
          uid: CARLOS,
        })
      );
    });

    it('nega quem não está em autorizados, mesmo forjando o payload', async () => {
      await assertFails(
        setDoc(doc(comoUsuarioComEmail(BRUNO, 'bruno@senai.br'), `usuarios/${BRUNO}`), {
          nome: 'Bruno Alves',
          email: 'carlos@senai.br', // e-mail alheio no corpo: o token é que vale
          tipo: 'professor',
          uid: BRUNO,
        })
      );
    });

    it('nega quem está em autorizados com Tipo diferente de professor', async () => {
      await semearComoAdministrador('autorizados/monitor@senai.br', { Tipo: 'monitor' });

      await assertFails(
        setDoc(doc(comoUsuarioComEmail('uid-monitor', 'monitor@senai.br'), 'usuarios/uid-monitor'), {
          nome: 'Monitor',
          email: 'monitor@senai.br',
          tipo: 'professor',
        })
      );
    });

    it('nega a promoção a professor num update posterior ao cadastro', async () => {
      await semearComoAdministrador(`usuarios/${ANA}`, {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
      });

      await assertFails(
        setDoc(
          doc(comoUsuarioComEmail(ANA, 'ana@senai.br'), `usuarios/${ANA}`),
          { tipo: 'professor' },
          { merge: true }
        )
      );
    });
  });

  // Apagar `usuarios/{uid}` não é uma operação do app: nenhuma tela oferece
  // isso. Enquanto era livre, bastava uma chamada avulsa para o aluno perder o
  // perfil — e com ele o papel, o nome e o histórico de cadastro.
  describe('exclusão', () => {
    beforeEach(async () => {
      await semearComoAdministrador(`usuarios/${ANA}`, {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
      });
    });

    it('nega que Bruno apague o perfil da Ana', async () => {
      await assertFails(deleteDoc(doc(como(BRUNO), `usuarios/${ANA}`)));
    });

    it('nega até que a própria Ana apague o perfil dela', async () => {
      await assertFails(deleteDoc(doc(como(ANA), `usuarios/${ANA}`)));
    });

    it('nega quem não tem sessão', async () => {
      await assertFails(deleteDoc(doc(comoVisitante(), `usuarios/${ANA}`)));
    });
  });

  it('o cadastro de aluno continua funcionando, que é o caminho comum', async () => {
    await assertSucceeds(
      setDoc(doc(comoUsuarioComEmail(ANA, 'ana@senai.br'), `usuarios/${ANA}`), {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
        uid: ANA,
        criadoEm: new Date(),
        provedor: 'password',
      })
    );
  });

  it('o primeiro login social continua criando o documento como aluno', async () => {
    await assertSucceeds(
      setDoc(doc(comoUsuarioComEmail(ANA, 'ana@senai.br'), `usuarios/${ANA}`), {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
        uid: ANA,
        criadoEm: new Date(),
        provedor: 'google.com',
      })
    );
  });
});

describe('autorizados — a única restrição que já vale hoje', () => {
  it('a leitura é pública, porque o cadastro a consulta antes de haver sessão', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'autorizados/carlos@senai.br'), {
        Tipo: 'professor',
      });
    });

    const lido = await getDoc(doc(comoVisitante(), 'autorizados/carlos@senai.br'));
    expect(lido.data()).toEqual({ Tipo: 'professor' });
  });

  it('a escrita é negada: ninguém se promove a professor pelo cliente', async () => {
    await assertFails(
      setDoc(doc(como(ANA), 'autorizados/ana@senai.br'), { Tipo: 'professor' })
    );
  });

  it('a escrita é negada também para quem não está logado', async () => {
    await assertFails(
      setDoc(doc(comoVisitante(), 'autorizados/qualquer@senai.br'), { Tipo: 'professor' })
    );
  });
});

describe('coleções desconhecidas nascem fechadas', () => {
  it('nega leitura e escrita em qualquer coleção não declarada', async () => {
    const db = como(ANA);

    await assertFails(setDoc(doc(db, 'colecao-nova/x'), { a: 1 }));
    await assertFails(getDoc(doc(db, 'colecao-nova/x')));
  });
});

// O horário visto do lado do servidor — AC-TEMPO-01.
//
// Corrigir o cliente não resolve o problema: a fila é pública e a escrita é
// direta no Firestore, então quem abrir o DevTools grava o `horario` que
// quiser e se põe no topo. Só a rule fecha isso, porque `request.time` é o
// relógio do servidor e o cliente não tem como forjá-lo.
//
// Nenhuma outra permissão excessiva de `chamados` e `chat` é tocada aqui: elas
// dependem do escopo de sala, que é a task 03. O que esta task fecha é o vetor
// da própria task — furar a fila pelo horário.
describe('horario só pode ser o carimbo do servidor (AC-TEMPO-01)', () => {
  const PASSADO_FORJADO = Timestamp.fromDate(new Date('2000-01-01T00:00:00.000Z'));

  describe('chamados', () => {
    it('aceita a criação com serverTimestamp()', async () => {
      await assertSucceeds(
        setDoc(doc(como(ANA), 'chamados/c1'), {
          descricao: 'O Visual Studio não abre.',
          horario: serverTimestamp(),
        })
      );
    });

    it('nega um Timestamp escolhido pelo cliente, ainda que autenticado', async () => {
      await assertFails(
        setDoc(doc(como(ANA), 'chamados/furado'), {
          descricao: 'quero ser o primeiro da fila',
          horario: PASSADO_FORJADO,
        })
      );
    });

    it('nega a string ISO da v0.1.0, que era o vetor original', async () => {
      await assertFails(
        setDoc(doc(como(ANA), 'chamados/furado'), {
          descricao: 'quero ser o primeiro da fila',
          horario: '2000-01-01T00:00:00.000Z',
        })
      );
    });

    it('nega também para quem não está logado', async () => {
      await assertFails(
        setDoc(doc(comoVisitante(), 'chamados/furado'), { horario: PASSADO_FORJADO })
      );
    });

    it('deixa passar a escrita que não mexe em horario nenhum', async () => {
      // A task 03 é quem vai exigir os campos; aqui só o horário é validado.
      await assertSucceeds(setDoc(doc(como(ANA), 'chamados/sem-horario'), { descricao: 'oi' }));
    });

    it('deixa o autor preencher horarioIso sem tocar em horario', async () => {
      await semearComoAdministrador('chamados/antigo', {
        descricao: 'chamado da v0.1.0',
        horario: PASSADO_FORJADO,
      });

      await assertSucceeds(
        updateDoc(doc(como(ANA), 'chamados/antigo'), {
          horarioIso: '2000-01-01T00:00:00.000Z',
        })
      );
    });

    it('nega o update que reescreve horario para um instante escolhido', async () => {
      await semearComoAdministrador('chamados/meu', { descricao: 'meu chamado' });

      await assertFails(
        updateDoc(doc(como(ANA), 'chamados/meu'), { horario: PASSADO_FORJADO })
      );
    });

    it('aceita o update que recarimba horario com serverTimestamp()', async () => {
      await semearComoAdministrador('chamados/meu', { descricao: 'meu chamado' });

      await assertSucceeds(
        updateDoc(doc(como(ANA), 'chamados/meu'), { horario: serverTimestamp() })
      );
    });
  });

  describe('chat', () => {
    it('aceita a mensagem com serverTimestamp()', async () => {
      await assertSucceeds(
        setDoc(doc(como(ANA), 'chat/m1'), { texto: 'oi', horario: serverTimestamp() })
      );
    });

    it('nega a mensagem com horário escolhido pelo cliente', async () => {
      await assertFails(
        setDoc(doc(como(ANA), 'chat/m1'), { texto: 'oi', horario: PASSADO_FORJADO })
      );
    });
  });
});
