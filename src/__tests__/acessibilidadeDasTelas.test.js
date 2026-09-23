// A auditoria automática de acessibilidade — AC-ANIM-10.
//
// Uma tela por vez, renderizada de verdade, submetida ao `axe`. A asserção é
// **zero violação crítica ou séria**; moderadas e leves são listadas no
// relatório e não reprovam, pela razão de sempre — um piso que reprova tudo
// vira um piso que alguém desliga.
//
// O que este teste é e o que ele não é. O `axe` cobre o que dá para decidir
// olhando a árvore: rótulo ausente, papel inválido, `aria-*` apontando para
// id que não existe, cabeçalho fora de ordem, contraste calculável. Ele não
// cobre ordem de tabulação, prisão de foco, nem se o texto do rótulo faz
// sentido — e nada disso é acidente: são justamente as coisas que exigem
// julgamento. Elas têm os próprios testes, escritos à mão:
//
//   * foco preso, `Esc` e devolução do foco → `ConfirmarAcao.test.js`,
//     `Modal.test.js`, `Lightbox.test.js`;
//   * anúncio de aviso e de mensagem nova → `Toast.test.js`, `Chat.test.js`;
//   * o que cada rótulo diz → o teste de comportamento de cada tela.
//
// Somados, os dois lados são a auditoria. Sozinho, o `axe` daria uma
// aprovação que não significa nada — a regra do ofício é que ele pega algo
// como um terço das barreiras reais.
//
// Sobre o contraste: aqui ele fica **desligado**. O jsdom não aplica folha de
// estilo, então o `axe` leria preto sobre transparente em toda tela e acusaria
// violação onde não há, ou aprovaria onde há. Quem mede contraste neste
// projeto é `src/styles/__tests__/contraste.test.js`, que lê os tokens e roda
// a conta da WCAG par a par.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __definirRelogioDoServidor,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import { __resetarStorage } from 'firebase/storage';
import Login from '../components/Login';
import Cadastro from '../components/Cadastro';
import MinhasSalas from '../components/MinhasSalas';
import EntrarComPin from '../components/EntrarComPin';
import TelaAluno, { ROTULO_DO_NOVO_CHAMADO } from '../components/TelaAluno';
import TelaProfessor from '../components/TelaProfessor';
import Chat from '../components/chat/Chat';
import { PAPEL_DE_ALUNO, PAPEL_DE_PROFESSOR } from '../services/salas';
import { renderComProvedores } from '../test-utils';

expect.extend(toHaveNoViolations);

// O `axe` roda 90 e poucas regras sobre a árvore inteira, em jsdom, sem as
// otimizações que o navegador dá a ele. Uma tela pequena leva segundos; a fila
// com trinta cards leva mais. O padrão de cinco segundos da suíte transforma
// isso num sorteio de agendamento, e o teste que falha passa a ser o que teve
// azar, não o que está errado.
jest.setTimeout(60000);

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const SALA = 'sala-a';
const CHAMADOS = `salas/${SALA}/chamados`;
const MEMBROS = `salas/${SALA}/membros`;
const PERKS = `salas/${SALA}/perks`;
const CHAT = `salas/${SALA}/chat`;

const AGORA = '2026-09-23T12:00:00.000Z';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };

/**
 * A configuração do `axe` para este projeto.
 *
 * `region` fora: ela exige que todo conteúdo esteja dentro de um marco
 * (`main`, `nav`, ...), e o teste renderiza **um componente**, não a página
 * inteira — o marco fica em `App.js`, acima de tudo isto. Cobrar aqui seria
 * cobrar a tela por uma falta que é do contêiner.
 */
const REGRAS = {
  rules: {
    'color-contrast': { enabled: false },
    region: { enabled: false },
  },
};

/** As duas severidades que reprovam, na nomenclatura do próprio axe. */
const GRAVES = ['critical', 'serious'];

/**
 * Roda o `axe` e devolve só as violações que reprovam.
 *
 * O relatório vem legível de propósito: `expect(lista).toEqual([])` com
 * objetos crus do axe imprime trezentas linhas de nó do DOM, e o que a pessoa
 * precisa ler é o nome da regra, quantos nós e qual o primeiro deles.
 */
async function violacoesGraves(container) {
  const resultado = await axe(container, REGRAS);

  return resultado.violations
    .filter((violacao) => GRAVES.includes(violacao.impact))
    .map(
      (violacao) =>
        `${violacao.impact}: ${violacao.id} — ${violacao.help} ` +
        `(${violacao.nodes.length}×, ex.: ${violacao.nodes[0].html.slice(0, 120)})`
    );
}

function semearMembros() {
  __semearColecao(MEMBROS, [
    { id: ANA.uid, uid: ANA.uid, nome: 'Ana Souza', email: ANA.email, papel: PAPEL_DE_ALUNO },
    {
      id: CARLOS.uid,
      uid: CARLOS.uid,
      nome: 'Carlos Lima',
      email: CARLOS.email,
      papel: PAPEL_DE_PROFESSOR,
    },
  ]);
}

function semearSala() {
  __semearColecao('salas', [
    {
      id: SALA,
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
      professorUid: CARLOS.uid,
      professorNome: 'Carlos Lima',
      ativa: true,
      criadaEm: Timestamp.fromDate(new Date('2026-02-01T12:00:00.000Z')),
    },
  ]);

  __semearColecao('usuarios', [
    { id: ANA.uid, uid: ANA.uid, nome: 'Ana Souza', email: ANA.email, tipo: 'aluno' },
    {
      id: CARLOS.uid,
      uid: CARLOS.uid,
      nome: 'Carlos Lima',
      email: CARLOS.email,
      tipo: 'professor',
    },
  ]);

  // Sem isto o `AuthContext` rebaixa Carlos para aluno, e o painel de
  // premiação — que só o dono vê — não chega a ser renderizado.
  __semearColecao('autorizados', [{ id: CARLOS.email, Tipo: 'professor' }]);
}

/**
 * O espelho `usuarios/{uid}/salas`, que é por onde `MinhasSalas` lista.
 *
 * Perguntar "de quais salas este uid é membro?" exigiria varrer as subcoleções
 * de todas as salas; o espelho é a resposta pronta. Ver services/salas.js.
 */
function semearEspelho(uid, papel) {
  __semearColecao(`usuarios/${uid}/salas`, [{ id: SALA, salaId: SALA, papel }]);
}

/** Dois chamados, um com anexo — o card com miniatura é o mais arriscado. */
function semearChamados() {
  __semearColecao(CHAMADOS, [
    {
      id: 'chamado-ana',
      salaId: SALA,
      uid: ANA.uid,
      nome: 'Ana Souza',
      email: ANA.email,
      descricao: 'O Visual Studio não abre no computador 12.',
      horario: Timestamp.fromDate(new Date('2026-09-23T11:50:00.000Z')),
      cor: '#d8e5ff',
      atendido: false,
      anexo: {
        url: 'https://exemplo.test/print.png',
        caminho: `salas/${SALA}/chamados/chamado-ana/print.png`,
        tipo: 'image/png',
        bytes: 4096,
      },
    },
    {
      id: 'chamado-bruno',
      salaId: SALA,
      uid: 'uid-bruno',
      nome: 'Bruno Alves',
      email: 'bruno@senai.br',
      descricao: 'A impressora 3D parou no meio da peça.',
      horario: Timestamp.fromDate(new Date('2026-09-23T11:55:00.000Z')),
      cor: '#d4f0d4',
      atendido: false,
    },
  ]);
}

/** Uma premiação ativa e já vista: a vitrine aparece, a celebração não. */
function semearPerk() {
  __semearColecao(PERKS, [
    {
      id: 'perk-ana',
      alunoUid: ANA.uid,
      alunoNome: 'Ana Souza',
      tipo: 'resolvedor',
      nivel: 2,
      justificativa: 'Resolveu sozinha o erro de driver.',
      anunciarParaSala: false,
      concedidoPor: CARLOS.uid,
      concedidoPorNome: 'Carlos Lima',
      concedidoEm: Timestamp.fromDate(new Date('2026-09-22T13:00:00.000Z')),
      expiraEm: Timestamp.fromDate(new Date('2099-01-01T00:00:00.000Z')),
      revogadoEm: null,
      visualizadoEm: Timestamp.fromDate(new Date('2026-09-22T13:01:00.000Z')),
    },
  ]);
}

function semearMensagens() {
  __semearColecao(CHAT, [
    {
      id: 'msg-1',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      nome: 'Ana Souza',
      email: ANA.email,
      texto: 'Alguém já usou o torno 3?',
      horario: new Date('2026-09-23T11:58:00.000Z'),
    },
  ]);
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __resetarStorage();
  __definirRelogioDoServidor(AGORA);

  // O jsdom não traz `matchMedia`, e o hook de movimento reduzido o consulta.
  window.matchMedia = jest.fn().mockImplementation((consulta) => ({
    matches: false,
    media: consulta,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
});

describe('telas de entrada (AC-ANIM-10)', () => {
  it('o login não tem violação séria', async () => {
    const { container } = renderComProvedores(<Login />);
    // Nome exato: a tela tem três botões cujo rótulo começa com "Entrar".
    await screen.findByRole('button', { name: 'Entrar' });

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('o cadastro não tem violação séria', async () => {
    const { container } = renderComProvedores(<Cadastro />);
    await screen.findByRole('button', { name: /cadastrar/i });

    expect(await violacoesGraves(container)).toEqual([]);
  });
});

describe('telas de sala (AC-ANIM-10)', () => {
  it('a lista de salas do aluno não tem violação séria', async () => {
    __definirUsuarioAtual(ANA);
    semearSala();
    semearMembros();
    semearEspelho(ANA.uid, PAPEL_DE_ALUNO);

    const { container } = renderComProvedores(<MinhasSalas />, { rota: '/salas' });
    await screen.findByText('Mecânica 2º ano');

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('a lista de salas do professor não tem violação séria', async () => {
    __definirUsuarioAtual(CARLOS);
    semearSala();
    semearMembros();
    semearChamados();
    semearEspelho(CARLOS.uid, PAPEL_DE_PROFESSOR);

    const { container } = renderComProvedores(<MinhasSalas />, { rota: '/salas' });
    await screen.findByText('Mecânica 2º ano');

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('a entrada por PIN não tem violação séria', async () => {
    __definirUsuarioAtual(ANA);

    const { container } = renderComProvedores(<EntrarComPin />);
    await screen.findByRole('button', { name: /entrar/i });

    expect(await violacoesGraves(container)).toEqual([]);
  });
});

describe('a fila de chamados (AC-ANIM-10)', () => {
  it('a sala do aluno não tem violação séria', async () => {
    __definirUsuarioAtual(ANA);
    semearSala();
    semearMembros();
    semearChamados();
    semearPerk();

    const { container } = renderComProvedores(<TelaAluno salaId={SALA} />);
    await screen.findByText('O Visual Studio não abre no computador 12.');

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('a sala do professor não tem violação séria', async () => {
    __definirUsuarioAtual(CARLOS);
    semearSala();
    semearMembros();
    semearChamados();

    const { container } = renderComProvedores(<TelaProfessor salaId={SALA} />);
    await screen.findByText('O Visual Studio não abre no computador 12.');

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('o modal de novo chamado não tem violação séria', async () => {
    __definirUsuarioAtual(ANA);
    semearSala();
    semearMembros();

    const { container } = renderComProvedores(<TelaAluno salaId={SALA} />);

    await userEvent.click(await screen.findByRole('button', { name: ROTULO_DO_NOVO_CHAMADO }));
    await screen.findByRole('dialog');

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('a confirmação de exclusão não tem violação séria', async () => {
    __definirUsuarioAtual(ANA);
    semearSala();
    semearMembros();
    semearChamados();

    const { container } = renderComProvedores(<TelaAluno salaId={SALA} />);
    await screen.findByText('O Visual Studio não abre no computador 12.');

    await userEvent.click(screen.getAllByRole('button', { name: /excluir/i })[0]);
    await screen.findByRole('dialog');

    expect(await violacoesGraves(container)).toEqual([]);
  });
});

describe('o chat (AC-ANIM-10)', () => {
  async function abrirChat(papel) {
    __definirUsuarioAtual(papel === PAPEL_DE_PROFESSOR ? CARLOS : ANA);
    semearSala();
    semearMembros();
    semearMensagens();

    const view = renderComProvedores(<Chat salaId={SALA} papel={papel} />);

    await userEvent.click(await screen.findByRole('button', { name: /abrir o chat/i }));
    await screen.findByRole('tab', { name: 'Sala' });

    return view;
  }

  it('a aba da sala não tem violação séria', async () => {
    const { container } = await abrirChat(PAPEL_DE_ALUNO);

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('a aba de conversas diretas não tem violação séria', async () => {
    const { container } = await abrirChat(PAPEL_DE_ALUNO);

    await userEvent.click(screen.getByRole('tab', { name: /direta/i }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /direta/i })).toHaveAttribute(
        'aria-selected',
        'true'
      )
    );

    expect(await violacoesGraves(container)).toEqual([]);
  });
});

describe('a vitrine de perks (AC-ANIM-10)', () => {
  it('as conquistas do aluno não têm violação séria', async () => {
    __definirUsuarioAtual(ANA);
    semearSala();
    semearMembros();
    semearPerk();

    const { container } = renderComProvedores(<TelaAluno salaId={SALA} />);
    await screen.findByRole('region', { name: 'Minhas conquistas' });

    expect(await violacoesGraves(container)).toEqual([]);
  });

  it('o painel de premiação do professor não tem violação séria', async () => {
    __definirUsuarioAtual(CARLOS);
    semearSala();
    semearMembros();
    semearPerk();

    // `ehDono` porque só o dono da sala concede — é o que a rule cobra do
    // outro lado (AC-PERK-07), e sem ele o painel não chega a ser renderizado.
    const { container } = renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);
    await screen.findByRole('region', { name: 'Conceder premiações' });

    expect(await violacoesGraves(container)).toEqual([]);
  });
});
