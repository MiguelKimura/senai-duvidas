// Compatibilidade futura dos dados — exigência do tasks/_PROTOCOLO.md, seção 4.
//
// O cenário que este arquivo defende é concreto e vai acontecer. As tasks 03 e
// 05 acrescentam `salaId`, `prioridade` e `atendido` aos documentos. No dia do
// deploy, metade do laboratório vai estar com a aba aberta desde antes — e
// essas abas, rodando a versão de hoje, vão receber pelo `onSnapshot` os
// documentos com os campos novos.
//
// Se o leitor de hoje quebrar diante de um campo que não conhece, o sintoma é
// uma tela branca no meio da aula, para quem não fez nada de errado. O
// protocolo chama isso de campo **aditivo**: campo novo é opcional, com padrão
// seguro na leitura, e o leitor antigo simplesmente o ignora.
//
// Este teste prova que a v0.1.0 satisfaz essa regra, em `chamados` e em `chat`.
// A prova precisa existir agora, antes de os campos novos aparecerem: depois do
// deploy, já é tarde para descobrir que não.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  query,
  Timestamp,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import TelaAluno from '../components/TelaAluno';
import TelaProfessor from '../components/TelaProfessor';
import Chat from '../components/Chat';
import { corDeFundo, renderComProvedores } from '../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

// Um chamado como a v0.1.0 o grava.
const CHAMADO_DE_HOJE = {
  id: 'hoje',
  nome: 'Ana Souza',
  email: 'ana@senai.br',
  descricao: 'O Visual Studio não abre.',
  horario: '2025-03-10T13:45:00.000Z',
  cor: 'hsl(210, 70%, 80%)',
  imagem: null,
};

// O mesmo chamado depois das tasks 03 e 05: os campos de hoje intactos, e os
// novos acrescentados ao lado. É o formato que uma aba antiga vai receber.
const CHAMADO_DO_FUTURO = {
  ...CHAMADO_DE_HOJE,
  id: 'futuro',
  salaId: 'sala-3b',
  prioridade: 2,
  atendido: false,
  atendidoPor: null,
  anexos: [{ caminho: 'salas/sala-3b/chamados/futuro/print.png', tipo: 'image/png' }],
  markdown: true,
};

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirUsuarioAtual(ANA);
});

describe('chamados com campos que a v0.1.0 não conhece', () => {
  it('a tela do aluno renderiza o chamado novo sem lançar', () => {
    __semearColecao('chamados', [CHAMADO_DO_FUTURO]);

    expect(() => renderComProvedores(<TelaAluno />)).not.toThrow();
    expect(screen.getByText('O Visual Studio não abre.')).toBeInTheDocument();
  });

  it('a tela do professor renderiza o chamado novo sem lançar', () => {
    __semearColecao('chamados', [CHAMADO_DO_FUTURO]);

    expect(() => renderComProvedores(<TelaProfessor />)).not.toThrow();
    expect(screen.getByText('O Visual Studio não abre.')).toBeInTheDocument();
  });

  it('os campos desconhecidos não vazam para a tela', () => {
    __semearColecao('chamados', [CHAMADO_DO_FUTURO]);

    renderComProvedores(<TelaAluno />);

    // Nem como texto solto, nem como `[object Object]` — o sinal clássico de
    // um campo novo caindo num `{...}` de JSX que não o esperava.
    expect(screen.queryByText(/sala-3b/)).toBeNull();
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  it('o card novo fica visualmente idêntico ao de hoje', () => {
    __semearColecao('chamados', [CHAMADO_DE_HOJE, CHAMADO_DO_FUTURO]);

    renderComProvedores(<TelaAluno />);

    const [deHoje, doFuturo] = document.querySelectorAll('.problema-card');

    expect(corDeFundo(doFuturo)).toBe(corDeFundo(deHoje));
    expect(doFuturo.className).toBe(deHoje.className);
  });

  it('o chamado novo não desorganiza a ordenação por horário', () => {
    __semearColecao('chamados', [
      { ...CHAMADO_DO_FUTURO, descricao: 'mais novo', horario: '2025-03-10T15:00:00.000Z' },
      { ...CHAMADO_DE_HOJE, descricao: 'mais antigo', horario: '2025-03-10T09:00:00.000Z' },
    ]);

    renderComProvedores(<TelaAluno />);

    const textos = [...document.querySelectorAll('.problema-card')].map(
      (card) => card.textContent
    );

    expect(textos[0]).toContain('mais antigo');
    expect(textos[1]).toContain('mais novo');
  });
});

describe('mensagens de chat com campos que a v0.1.0 não conhece', () => {
  const MENSAGEM_DO_FUTURO = {
    id: 'futura',
    nome: 'Ana Souza',
    email: 'ana@senai.br',
    texto: 'Alguém conseguiu rodar?',
    horario: '2025-03-10T13:45:00.000Z',
    salaId: 'sala-3b',
    destinatario: null,
    papel: 'aluno',
    reacoes: { '👍': 2 },
  };

  /** O painel do chat começa fechado; as mensagens só existem no DOM depois. */
  async function abrirChat() {
    await userEvent.click(document.querySelector('.toggle-chat-btn'));
  }

  it('o chat renderiza a mensagem nova sem lançar e mostra o texto', async () => {
    __semearColecao('chat', [MENSAGEM_DO_FUTURO]);

    expect(() => renderComProvedores(<Chat />)).not.toThrow();
    await abrirChat();

    expect(screen.getByText(/Alguém conseguiu rodar\?/)).toBeInTheDocument();
  });

  it('os campos desconhecidos da mensagem não aparecem na conversa', async () => {
    __semearColecao('chat', [MENSAGEM_DO_FUTURO]);

    renderComProvedores(<Chat />);
    await abrirChat();

    expect(screen.queryByText(/sala-3b/)).toBeNull();
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// `usuarios/{uid}` — os campos que a task 01 acrescenta.
//
// A v0.2.0 gravava `nome`, `email`, `tipo` e `uid`. A task 01 acrescenta
// `criadoEm` (timestamp do servidor) e `provedor`. O protocolo chama isso de
// mudança **aditiva**, e exige a prova nos dois sentidos:
//
//   futura     — um leitor que não conhece os campos novos continua lendo o
//                documento novo sem lançar e sem mudar de comportamento;
//   retroativa — o leitor novo lê o documento velho, sem os campos, e resolve
//                o papel normalmente.
//
// O cenário é o do dia do deploy: a professora fica com a aba aberta desde
// antes e a turma entra depois, criando documentos no formato novo. Se o leitor
// antigo quebrasse diante de `criadoEm`, o sintoma seria tela branca em aula.
// ---------------------------------------------------------------------------
describe('usuarios com campos que a v0.2.0 não conhece', () => {
  /**
   * O leitor da v0.2.0, reproduzido: ele conhecia exatamente estes quatro
   * campos e decidia a rota pelo `tipo`. Qualquer outra chave era ignorada.
   */
  function leitorDaV020(documento) {
    return {
      nome: documento.nome,
      email: documento.email,
      tipo: documento.tipo,
      uid: documento.uid,
      rota: documento.tipo === 'professor' ? '/professor' : '/aluno',
    };
  }

  const PERFIL_DA_V020 = {
    nome: 'Ana Souza',
    email: 'ana@senai.br',
    tipo: 'aluno',
    uid: 'uid-ana',
  };

  const PERFIL_DA_V030 = {
    ...PERFIL_DA_V020,
    criadoEm: { seconds: 1741613100, nanoseconds: 0 },
    provedor: 'google.com',
  };

  it('o leitor da v0.2.0 lê o documento novo sem lançar', () => {
    expect(() => leitorDaV020(PERFIL_DA_V030)).not.toThrow();
  });

  it('o leitor da v0.2.0 chega exatamente à mesma conclusão de antes', () => {
    expect(leitorDaV020(PERFIL_DA_V030)).toEqual(leitorDaV020(PERFIL_DA_V020));
  });

  it('nenhum dos quatro campos da v0.2.0 foi renomeado ou removido', async () => {
    const { __resetarFirestore: resetar } = require('firebase/firestore');
    resetar();
    const { garantirPerfil } = require('../services/perfilUsuario');

    const { perfil } = await garantirPerfil({
      uid: 'uid-ana',
      email: 'ana@senai.br',
      displayName: 'Ana Souza',
      providerData: [{ providerId: 'google.com' }],
    });

    expect(Object.keys(perfil)).toEqual(expect.arrayContaining(['nome', 'email', 'tipo', 'uid']));
  });

  it('o leitor novo lê o documento da v0.2.0, sem criadoEm nem provedor', async () => {
    const { __resetarFirestore: resetar, __semearColecao: semear } = require('firebase/firestore');
    resetar();
    semear('usuarios', [{ id: 'uid-ana', ...PERFIL_DA_V020 }]);
    const { garantirPerfil } = require('../services/perfilUsuario');

    await expect(
      garantirPerfil({ uid: 'uid-ana', email: 'ana@senai.br' })
    ).resolves.toMatchObject({ papel: 'aluno', criado: false });
  });
});

// ---------------------------------------------------------------------------
// `horario` — a mudança de FORMA de dado da v0.4.0.
//
// As seções acima tratam de campos **acrescentados**, que o leitor antigo
// ignora sem esforço. Esta é diferente, e mais perigosa: o campo `horario`
// continua com o mesmo nome e muda de tipo. Era string ISO, passa a ser
// `Timestamp` do servidor — que é o único jeito de a ordem da fila não ser
// decidida pelo relógio da máquina do aluno.
//
// O leitor da v0.3.0 faz `new Date(chamado.horario)`. Diante de um
// `Timestamp`, isso não lança: devolve `Invalid Date`, e o card escreve
// "Invalid Date" em silêncio, durante a aula. Um campo que muda de tipo é pior
// do que um campo removido, justamente porque não explode.
//
// Por isso a v0.4.0 grava **também** `horarioIso`, a mesma data em string, ao
// lado. O campo só sai na 1.0.0, quando não houver mais cliente antigo em
// sala. Os testes abaixo provam as duas pontas: que a string existe e vale o
// mesmo instante, e que o leitor novo continua entendendo o documento que
// nunca teve `Timestamp` nenhum.
// ---------------------------------------------------------------------------
describe('horario: a forma de dado que mudou na v0.4.0', () => {
  const INSTANTE = '2025-03-10T13:45:00.000Z';
  const INSTANTE_ANTERIOR = '2025-03-10T09:00:00.000Z';

  /** Um chamado como a v0.4.0 o deixa no banco, depois da confirmação. */
  const CHAMADO_DA_V040 = {
    ...CHAMADO_DE_HOJE,
    id: 'novo',
    horario: Timestamp.fromDate(new Date(INSTANTE)),
    horarioIso: INSTANTE,
  };

  /** O leitor da v0.3.0, reproduzido: ele conhecia só `horario`. */
  function leitorDaV030(chamado) {
    return new Date(chamado.horario);
  }

  /**
   * O mesmo leitor com a correção de uma linha que `horarioIso` torna
   * possível — a saída que o campo aditivo abre para quem ficou para trás.
   */
  function leitorDaV030ComAPonte(chamado) {
    return new Date(chamado.horarioIso || chamado.horario);
  }

  it('o leitor antigo diante do Timestamp não lança: erra em silêncio', () => {
    expect(() => leitorDaV030(CHAMADO_DA_V040)).not.toThrow();
  });

  it('e o que ele erra é tudo: Invalid Date — é por isto que horarioIso existe', () => {
    expect(Number.isNaN(leitorDaV030(CHAMADO_DA_V040).getTime())).toBe(true);
  });

  it('com horarioIso, o leitor antigo volta a acertar o instante', () => {
    expect(leitorDaV030ComAPonte(CHAMADO_DA_V040).toISOString()).toBe(INSTANTE);
  });

  it('horarioIso guarda o mesmo instante que horario, e não outro', () => {
    expect(new Date(CHAMADO_DA_V040.horarioIso).getTime()).toBe(
      CHAMADO_DA_V040.horario.toDate().getTime()
    );
  });

  it('o chamado que o app grava hoje leva horarioIso junto', async () => {
    __definirRelogioDoServidor(INSTANTE);
    renderComProvedores(<TelaAluno />);

    await userEvent.click(screen.getByRole('button', { name: '+' }));
    await userEvent.type(screen.getByPlaceholderText('Descreva o problema'), 'O VS Code não abre');
    await userEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    const chamados = async () =>
      (await getDocs(query(collection(getFirestore(), 'chamados')))).docs;

    await waitFor(async () => expect(await chamados()).toHaveLength(1));
    __confirmarCarimbos();

    expect((await chamados())[0].data().horarioIso).toBe(INSTANTE);
  });

  it('o leitor da v0.4.0 lê o chamado da v0.1.0, que nunca teve Timestamp', () => {
    __semearColecao('chamados', [CHAMADO_DE_HOJE]);

    renderComProvedores(<TelaProfessor />);

    // 13:45 em UTC são 10:45 em Brasília: a data velha é lida e convertida.
    expect(screen.getByText('10/03/2025 10:45')).toBeInTheDocument();
  });

  it('o leitor da v0.4.0 ordena uma fila que mistura os dois formatos', () => {
    __semearColecao('chamados', [
      { ...CHAMADO_DA_V040, descricao: 'mais novo' },
      { ...CHAMADO_DE_HOJE, id: 'antigo', descricao: 'mais antigo', horario: INSTANTE_ANTERIOR },
    ]);

    renderComProvedores(<TelaProfessor />);

    const textos = [...document.querySelectorAll('.problema-card')].map((card) => card.textContent);

    expect(textos[0]).toContain('mais antigo');
    expect(textos[1]).toContain('mais novo');
  });
});
