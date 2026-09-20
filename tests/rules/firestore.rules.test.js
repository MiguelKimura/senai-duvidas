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
const { doc, getDoc, setDoc, deleteDoc, collection, getDocs } = require('firebase/firestore');
const { projetoDeTeste } = require('./projetoDeTeste');

let ambiente;

const ANA = 'uid-ana';
const BRUNO = 'uid-bruno';

/** Firestore autenticado como `uid`. */
function como(uid) {
  return ambiente.authenticatedContext(uid).firestore();
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
  it('um aluno autenticado cria o próprio chamado', async () => {
    const db = como(ANA);

    await assertSucceeds(
      setDoc(doc(db, 'chamados/c1'), {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        descricao: 'O Visual Studio não abre.',
        horario: '2025-03-10T13:45:00.000Z',
        cor: 'hsl(210, 70%, 80%)',
        imagem: null,
      })
    );
  });

  it('qualquer pessoa autenticada lê a fila inteira', async () => {
    const db = como(ANA);
    await assertSucceeds(getDocs(collection(db, 'chamados')));
  });

  // TODO(task-03): endurecer. Depois da task 03 isto deve ser assertFails.
  it('INSEGURO: Bruno apaga o chamado de Ana, e o servidor deixa', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chamados/da-ana'), {
        email: 'ana@senai.br',
        descricao: 'chamado da Ana',
      });
    });

    await assertSucceeds(deleteDoc(doc(como(BRUNO), 'chamados/da-ana')));
  });

  // TODO(task-03): endurecer. Depois da task 03 isto deve ser assertFails.
  it('INSEGURO: quem nem está logado lê e escreve chamados', async () => {
    const db = comoVisitante();

    await assertSucceeds(getDocs(collection(db, 'chamados')));
    await assertSucceeds(setDoc(doc(db, 'chamados/anonimo'), { descricao: 'sem sessão' }));
  });

  // TODO(task-03): endurecer. Sem escopo de sala, toda turma divide a fila.
  it('INSEGURO: não existe escopo de sala — a fila é global', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chamados/de-outra-turma'), {
        descricao: 'chamado da turma da tarde',
      });
    });

    const lido = await getDoc(doc(como(ANA), 'chamados/de-outra-turma'));
    expect(lido.exists()).toBe(true);
  });
});

describe('chat — estado atual', () => {
  it('um aluno autenticado envia mensagem', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), 'chat/m1'), {
        texto: 'Alguém conseguiu rodar?',
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        horario: new Date(),
      })
    );
  });

  // TODO(task-03): endurecer. É o `!clear` visto do lado do servidor.
  it('INSEGURO: um aluno apaga a mensagem de outro — o !clear da turma inteira', async () => {
    await ambiente.withSecurityRulesDisabled(async (contexto) => {
      await setDoc(doc(contexto.firestore(), 'chat/do-bruno'), {
        texto: 'mensagem do Bruno',
        email: 'bruno@senai.br',
      });
    });

    await assertSucceeds(deleteDoc(doc(como(ANA), 'chat/do-bruno')));
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

  // TODO(task-03): endurecer. É a falha de privilégio vista do servidor.
  it('INSEGURO: o cliente escolhe o próprio tipo, inclusive "professor"', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), `usuarios/${ANA}`), {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'professor',
      })
    );
  });

  // TODO(task-03): endurecer. Ninguém deveria escrever no documento alheio.
  it('INSEGURO: Ana escreve no documento de usuário do Bruno', async () => {
    await assertSucceeds(
      setDoc(doc(como(ANA), `usuarios/${BRUNO}`), { nome: 'nome trocado' })
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
