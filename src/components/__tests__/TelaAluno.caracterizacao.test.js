// Caracterização da tela do aluno — o coração da v0.1.0.
//
// Cobre os critérios de regressão AC-CHAMADO-01/02/03/04/07, AC-IMG-01 e
// AC-COR-05, e registra as três falhas estruturais que as próximas tasks vão
// corrigir:
//   * o listener é `onSnapshot` na coleção `chamados` INTEIRA, sem `where` nem
//     `limit` — viola AC-PERF-03 e impede o escopo por sala (task 03);
//   * `horario` é `new Date().toISOString()` do relógio do aluno — viola
//     AC-TEMPO-01/02 e é o que a task 02 troca por `serverTimestamp()`;
//   * o anexo abre por `window.open`, bloqueado em parte dos laboratórios —
//     AC-IMG-10 troca isso por um lightbox na task 04.
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
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
import TelaAluno from '../TelaAluno';
import {
  corDeFundo,
  fabricaChamado,
  fixarRelogio,
  renderComProvedores,
  restaurarRelogio,
} from '../../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const db = getFirestore();
const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** O instante que o servidor carimba. Três horas atrás do relógio do aluno. */
const HORARIO_DO_SERVIDOR = '2025-03-10T13:45:00.000Z';
const RELOGIO_ADIANTADO_DO_ALUNO = '2025-03-10T16:45:00.000Z';

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
});

afterEach(() => {
  restaurarRelogio();
});

async function chamadosGravados() {
  const snapshot = await getDocs(query(collection(db, 'chamados')));
  return snapshot.docs.map((documento) => documento.data());
}

function cartoes() {
  return document.querySelectorAll('.problema-card');
}

async function abrirModalECriar({ descricao, imagem = '' }) {
  userEvent.click(screen.getByRole('button', { name: '+' }));

  if (descricao) {
    userEvent.type(screen.getByPlaceholderText('Descreva o problema'), descricao);
  }
  if (imagem) {
    userEvent.type(screen.getByPlaceholderText('Cole o link da imagem'), imagem);
  }

  userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
}

describe('TelaAluno — saudação', () => {
  it('cumprimenta o aluno pelo displayName do Auth', () => {
    renderComProvedores(<TelaAluno />);

    expect(screen.getByRole('heading', { name: 'Bem-vindo, Ana Souza!' })).toBeInTheDocument();
  });

  it('cai para "Aluno" quando o provedor não trouxe nome', () => {
    __definirUsuarioAtual({ uid: 'uid-sem-nome', email: 'x@senai.br', displayName: null });
    renderComProvedores(<TelaAluno />);

    expect(screen.getByRole('heading', { name: 'Bem-vindo, Aluno!' })).toBeInTheDocument();
  });
});

describe('TelaAluno — lista de chamados (AC-CHAMADO-03)', () => {
  it('ordena a fila por horário crescente, o mais antigo primeiro', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c2', descricao: 'segunda', horario: '2025-03-10T10:05:00.000Z' }),
      fabricaChamado({ id: 'c3', descricao: 'terceira', horario: '2025-03-10T10:10:00.000Z' }),
      fabricaChamado({ id: 'c1', descricao: 'primeira', horario: '2025-03-10T10:00:00.000Z' }),
    ]);

    renderComProvedores(<TelaAluno />);

    const descricoes = [...cartoes()].map((cartao) => within(cartao).getByText(/^(primeira|segunda|terceira)$/).textContent);
    expect(descricoes).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('mostra nome do autor, descrição e horário no card (AC-CHAMADO-07)', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', nome: 'Bruno Alves', descricao: 'A rede caiu' }),
    ]);

    renderComProvedores(<TelaAluno />);

    const [cartao] = cartoes();
    expect(within(cartao).getByText('Bruno Alves')).toBeInTheDocument();
    expect(within(cartao).getByText('A rede caiu')).toBeInTheDocument();
    expect(cartao.querySelector('em')).not.toBeEmptyDOMElement();
  });

  it('usa a cor gravada no chamado como fundo do card (AC-COR-05)', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', cor: 'hsl(120, 70%, 80%)' }),
    ]);

    renderComProvedores(<TelaAluno />);

    // `toHaveStyle` passaria aqui mesmo com a cor errada: o jsdom desaba todo
    // `hsl()` no mesmo cinza. `corDeFundo` le o valor que o componente pediu.
    expect(corDeFundo(cartoes()[0])).toBe('hsl(120, 70%, 80%)');
  });

  it('reage em tempo real a um chamado criado por outra pessoa (AC-CHAMADO-02)', async () => {
    renderComProvedores(<TelaAluno />);
    expect(cartoes()).toHaveLength(0);

    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', nome: 'Bruno Alves', descricao: 'A rede caiu' }),
    ]);

    expect(await screen.findByText('A rede caiu')).toBeInTheDocument();
  });

  it('cancela o listener ao desmontar (AC-PERF-04)', () => {
    const { unmount } = renderComProvedores(<TelaAluno />);

    unmount();
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', descricao: 'depois do unmount' })]);

    expect(screen.queryByText('depois do unmount')).not.toBeInTheDocument();
  });
});

describe('TelaAluno — compatibilidade retroativa de horario (AC-TEMPO-08)', () => {
  it('lê e ordena documentos com horario em string ISO e em Timestamp na mesma lista', () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'novo',
        descricao: 'gravado como Timestamp',
        horario: Timestamp.fromDate(new Date('2025-03-10T10:05:00.000Z')),
      }),
      fabricaChamado({
        id: 'antigo',
        descricao: 'gravado como string ISO',
        horario: '2025-03-10T10:00:00.000Z',
      }),
    ]);

    renderComProvedores(<TelaAluno />);

    const descricoes = [...cartoes()].map(
      (cartao) => within(cartao).getByText(/gravado como/).textContent
    );
    expect(descricoes).toEqual(['gravado como string ISO', 'gravado como Timestamp']);
  });

  it('não quebra com documento sem horario nenhum', () => {
    __semearColecao('chamados', [
      { id: 'sem-horario', nome: 'Bruno', email: 'b@senai.br', descricao: 'sem horário' },
    ]);

    renderComProvedores(<TelaAluno />);

    expect(screen.getByText('sem horário')).toBeInTheDocument();
  });
});

describe('TelaAluno — criação de chamado (AC-CHAMADO-01)', () => {
  it('não grava nada quando a descrição está vazia', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: '' });

    expect(await chamadosGravados()).toHaveLength(0);
  });

  it('mantém o modal aberto quando a descrição está vazia', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: '' });

    expect(screen.getByPlaceholderText('Descreva o problema')).toBeInTheDocument();
  });

  it('grava nome, email, descrição, cor e horário quando há descrição', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(1));
    __confirmarCarimbos();

    expect(await chamadosGravados()).toEqual([
      {
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        descricao: 'O VS Code não abre',
        horario: expect.any(Timestamp),
        horarioIso: HORARIO_DO_SERVIDOR,
        cor: expect.stringMatching(/^hsl\(/),
        imagem: null,
      },
    ]);
  });

  it('gera cor automática quando o aluno não escolhe nenhuma (AC-COR-05)', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(1));
    const [chamado] = await chamadosGravados();
    expect(chamado.cor).toMatch(/^hsl\(\d+(\.\d+)?, 70%, 80%\)$/);
  });

  it('fecha o modal depois de gravar', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(() =>
      expect(screen.queryByPlaceholderText('Descreva o problema')).not.toBeInTheDocument()
    );
  });

  // INVERTIDO pela task 02. Este caso nasceu na task 00 provando que o horário
  // saía de `new Date().toISOString()` do aluno — a origem da fila furada. A
  // asserção vira de "é o relógio do cliente" para "é o do servidor, e o do
  // cliente não influi". Nenhum caso foi removido.
  it('carimba o horário com o relógio DO SERVIDOR (AC-TEMPO-01)', async () => {
    // O relógio do aluno está três horas adiantado, como acontece em
    // laboratório — e como faria quem quisesse furar a fila de propósito.
    fixarRelogio(RELOGIO_ADIANTADO_DO_ALUNO);
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(1));

    // Fase 1: escrita otimista, sem horário provisório inventado pelo cliente.
    expect((await chamadosGravados())[0].horario).toBeNull();

    // Fase 2: o servidor responde.
    __confirmarCarimbos();

    const [chamado] = await chamadosGravados();
    expect(chamado.horario.toDate()).toEqual(new Date(HORARIO_DO_SERVIDOR));
  });

  it('não grava em lugar nenhum o instante que o relógio do aluno marcava', async () => {
    fixarRelogio(RELOGIO_ADIANTADO_DO_ALUNO);
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(1));
    __confirmarCarimbos();

    expect(JSON.stringify(await chamadosGravados())).not.toContain(
      RELOGIO_ADIANTADO_DO_ALUNO
    );
  });
});

describe('TelaAluno — anexo por URL (AC-IMG-01)', () => {
  it('grava a URL colada pelo aluno', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({
      descricao: 'Olha o erro',
      imagem: 'https://exemplo.br/erro.png',
    });

    await waitFor(async () =>
      expect((await chamadosGravados())[0]).toMatchObject({
        imagem: 'https://exemplo.br/erro.png',
      })
    );
  });

  it('exibe o ícone de visualização no card quando há imagem (AC-CHAMADO-07)', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', imagem: 'https://exemplo.br/erro.png' }),
    ]);

    renderComProvedores(<TelaAluno />);

    expect(screen.getByTitle('Ver imagem')).toBeInTheDocument();
  });

  it('não exibe o ícone quando o chamado não tem imagem', () => {
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', imagem: null })]);

    renderComProvedores(<TelaAluno />);

    expect(screen.queryByTitle('Ver imagem')).not.toBeInTheDocument();
  });

  it('abre o anexo por window.open — bloqueado em laboratório, AC-IMG-10 corrige', () => {
    const abrirJanela = jest.spyOn(window, 'open').mockImplementation(() => null);
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', imagem: 'https://exemplo.br/erro.png' }),
    ]);
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByTitle('Ver imagem'));

    expect(abrirJanela).toHaveBeenCalledWith('https://exemplo.br/erro.png', '_blank');
    abrirJanela.mockRestore();
  });

  it('exibe chamado antigo cujo campo imagem é string de URL (AC-IMG-13)', () => {
    __semearColecao('chamados', [
      { id: 'antigo', nome: 'Bruno', email: 'b@senai.br', descricao: 'print antigo', horario: '2025-01-05T10:00:00.000Z', imagem: 'https://exemplo.br/antigo.png' },
    ]);

    renderComProvedores(<TelaAluno />);

    expect(screen.getByText('print antigo')).toBeInTheDocument();
    expect(screen.getByTitle('Ver imagem')).toBeInTheDocument();
  });
});

describe('TelaAluno — exclusão (AC-CHAMADO-04 e AC-CHAMADO-05)', () => {
  it('mostra Excluir apenas no chamado do próprio aluno', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'meu', email: 'ana@senai.br', descricao: 'meu chamado' }),
      fabricaChamado({ id: 'alheio', email: 'bruno@senai.br', descricao: 'chamado do Bruno' }),
    ]);

    renderComProvedores(<TelaAluno />);

    const [meuCartao, cartaoAlheio] = cartoes();
    expect(within(meuCartao).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(within(cartaoAlheio).queryByRole('button', { name: 'Excluir' })).toBeNull();
  });

  it('remove o chamado do banco e da tela ao clicar em Excluir', async () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'meu', email: 'ana@senai.br', descricao: 'meu chamado' }),
    ]);
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(screen.queryByText('meu chamado')).not.toBeInTheDocument());
    expect(await chamadosGravados()).toHaveLength(0);
  });

  it('exclui SEM pedir confirmação — o AC-CHAMADO-04 exige confirmar, a task 08 resolve', async () => {
    const confirmar = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    __semearColecao('chamados', [
      fabricaChamado({ id: 'meu', email: 'ana@senai.br', descricao: 'meu chamado' }),
    ]);
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(0));
    expect(confirmar).not.toHaveBeenCalled();
    confirmar.mockRestore();
  });
});

describe('TelaAluno — botão Sair (AC-SESSAO-05)', () => {
  it('oferece a saída explícita da sessão na própria tela', () => {
    renderComProvedores(<TelaAluno />);

    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});

// O critério de saída da v0.4.0, e o motivo de a task existir: mexer no
// relógio do Windows não pode mudar a ordem de atendimento.
//
// Os dois sentidos importam, e erram para lados opostos com o código antigo,
// que ordenava pelo `new Date()` de quem enviou:
//
//   relógio atrasado  -> horário menor -> sobe para o topo da fila;
//   relógio adiantado -> horário maior -> afunda para o fim da fila.
//
// Com o carimbo do servidor, os dois casos caem na ordem de chegada.
describe('TelaAluno — o relógio da máquina não move a fila (AC-TEMPO-02)', () => {
  /** As descrições dos cards, na ordem em que estão na tela. */
  function filaNaTela() {
    return [...cartoes()].map((cartao) => within(cartao).getByText(/^chegou /).textContent);
  }

  /** Um chamado de outra pessoa, já carimbado pelo servidor. */
  function chamadoDeBruno(descricao, instante) {
    return fabricaChamado({
      id: 'do-bruno',
      nome: 'Bruno Dias',
      email: 'bruno@senai.br',
      descricao,
      horario: Timestamp.fromDate(new Date(instante)),
    });
  }

  async function anaEnviaCom({ relogioDaMaquina, carimboDoServidor, descricao }) {
    fixarRelogio(relogioDaMaquina);
    __definirRelogioDoServidor(carimboDoServidor);

    renderComProvedores(<TelaAluno />);
    await abrirModalECriar({ descricao });

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(2));
    __confirmarCarimbos();
  }

  it('atrasar o relógio em 3 horas não passa ninguém na frente', async () => {
    // Bruno enviou às 10:00 pelo relógio do servidor.
    __semearColecao('chamados', [chamadoDeBruno('chegou primeiro', '2025-03-10T10:00:00.000Z')]);

    // Ana atrasa o relógio dela em 3 horas e envia depois. Pelo código
    // antigo, o chamado dela nasceria com 07:05 e apareceria no topo.
    await anaEnviaCom({
      relogioDaMaquina: '2025-03-10T07:05:00.000Z',
      carimboDoServidor: '2025-03-10T10:05:00.000Z',
      descricao: 'chegou depois',
    });

    // `waitFor` e não asserção seca: a confirmação do servidor chega por um
    // `onSnapshot` fora de `act`, e é a reordenação **depois** dela que este
    // caso precisa observar.
    await waitFor(() => expect(filaNaTela()).toEqual(['chegou primeiro', 'chegou depois']));
  });

  it('adiantar o relógio em 3 horas não manda ninguém para o fim', async () => {
    // Bruno enviou às 10:10, depois de Ana.
    __semearColecao('chamados', [chamadoDeBruno('chegou depois', '2025-03-10T10:10:00.000Z')]);

    // Ana está com o relógio 3 horas adiantado e enviou às 10:05 pelo
    // servidor. Pelo código antigo, o chamado dela nasceria com 13:05 e cairia
    // para o fim, e ela nunca seria atendida.
    await anaEnviaCom({
      relogioDaMaquina: '2025-03-10T13:05:00.000Z',
      carimboDoServidor: '2025-03-10T10:05:00.000Z',
      descricao: 'chegou primeiro',
    });

    await waitFor(() => expect(filaNaTela()).toEqual(['chegou primeiro', 'chegou depois']));
  });

  it('o horário exibido é o do servidor, não o que o relógio da máquina marcava', async () => {
    __semearColecao('chamados', [chamadoDeBruno('chegou primeiro', '2025-03-10T10:00:00.000Z')]);

    await anaEnviaCom({
      relogioDaMaquina: '2025-03-10T07:05:00.000Z',
      carimboDoServidor: '2025-03-10T10:05:00.000Z',
      descricao: 'chegou depois',
    });

    // 10:05Z é 07:05 em Brasília. O relógio da máquina marcava 07:05 **UTC**,
    // que daria 04:05 em Brasília — é essa a diferença que o teste separa.
    await waitFor(() =>
      expect(cartoes()[1].querySelector('em')).toHaveTextContent('10/03/2025 07:05')
    );
  });
});

// A janela entre a escrita e a confirmação do servidor é curta, mas existe e
// é visível. Preenchê-la com o relógio do cliente seria o pior dos mundos:
// mostraria um horário errado, e depois o trocaria por outro sem explicação.
describe('TelaAluno — horário pendente de confirmação (AC-TEMPO-06)', () => {
  /** O `<em>` de cada card, na ordem da tela. */
  function horariosNaTela() {
    return [...cartoes()].map((cartao) => cartao.querySelector('em').textContent);
  }

  it('mostra "enviando…" no lugar do horário enquanto o servidor não confirma', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(() => expect(cartoes()).toHaveLength(1));
    expect(horariosNaTela()).toEqual(['enviando…']);
  });

  it('não exibe horário provisório nenhum durante a espera', async () => {
    fixarRelogio(RELOGIO_ADIANTADO_DO_ALUNO);
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(() => expect(cartoes()).toHaveLength(1));
    // Nem o relógio da máquina, nem "Invalid Date", nem uma data qualquer.
    expect(horariosNaTela()[0]).not.toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(horariosNaTela()[0]).not.toMatch(/Invalid/);
  });

  it('deixa o card pendente no fim da fila, sem passar na frente de ninguém', async () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'confirmado',
        descricao: 'chamado confirmado',
        horario: Timestamp.fromDate(new Date('2025-03-10T10:00:00.000Z')),
      }),
    ]);
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'chamado em voo' });

    await waitFor(() => expect(cartoes()).toHaveLength(2));
    expect([...cartoes()].map((cartao) => within(cartao).getByText(/^chamado /).textContent)).toEqual(
      ['chamado confirmado', 'chamado em voo']
    );
  });

  it('troca "enviando…" pelo horário de Brasília quando o servidor confirma', async () => {
    __definirRelogioDoServidor('2025-03-10T13:45:00.000Z');
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });
    await waitFor(() => expect(cartoes()).toHaveLength(1));

    __confirmarCarimbos();

    await waitFor(() => expect(horariosNaTela()).toEqual(['10/03/2025 10:45']));
  });
});
