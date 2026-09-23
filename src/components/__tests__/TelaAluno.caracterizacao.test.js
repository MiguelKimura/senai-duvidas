// Caracterização da tela do aluno — o coração da v0.1.0.
//
// Cobre os critérios de regressão AC-CHAMADO-01/02/03/04/07, AC-IMG-01 e
// AC-COR-05, e registra as falhas estruturais que as próximas tasks vão
// corrigir:
//   * o listener é `onSnapshot` na coleção `chamados` INTEIRA, sem `where` nem
//     `limit` — viola AC-PERF-03 e impede o escopo por sala (task 03);
//   * o anexo abria por `window.open`, bloqueado em parte dos laboratórios.
//     A task 04 corrigiu isso: a asserção correspondente foi INVERTIDA e hoje
//     exige o lightbox na própria página (AC-IMG-10).
//
// A terceira falha registrada aqui pela task 00 — `horario` vindo do relógio do
// aluno — foi corrigida pela task 02: as asserções que a descreviam foram
// INVERTIDAS, não apagadas, e hoje exigem o carimbo do servidor
// (AC-TEMPO-01/02, a partir de `:252`).
import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
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
import { PRAZO_DE_DESFAZER_MS } from '../../hooks/useExclusaoComDesfazer';
import { PALETA } from '../../utils/paleta';
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

/** O botão que confirma a exclusão, de dentro do diálogo. */
function confirmarNoDialogo() {
  return within(screen.getByRole('dialog')).getByRole('button', { name: 'Excluir' });
}

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

    const descricoes = [...cartoes()].map(
      (cartao) => within(cartao).getByText(/^(primeira|segunda|terceira)$/).textContent
    );
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
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', cor: 'hsl(120, 70%, 80%)' })]);

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

    // A task 03 acrescentou três campos **aditivos**, e a igualdade exata
    // continua sendo exata: `nome` não saiu de cena, `autorNome` entrou ao
    // lado dele com o mesmo conteúdo (escrita dupla da seção 4 do protocolo),
    // `autorUid` amarra o chamado ao dono para as rules, e `atendido` nasce
    // falso. O `nome` só é removido na 1.0.0, quando nenhum leitor o procurar.
    expect(await chamadosGravados()).toEqual([
      {
        nome: 'Ana Souza',
        autorNome: 'Ana Souza',
        autorUid: 'uid-ana',
        email: 'ana@senai.br',
        descricao: 'O VS Code não abre',
        horario: expect.any(Timestamp),
        horarioIso: HORARIO_DO_SERVIDOR,
        cor: expect.stringMatching(/^hsl\(/),
        imagem: null,
        // A task 04 acrescentou `anexo` ao lado de `imagem`, e a igualdade
        // exata continua exata: `imagem` não saiu de cena. Os dois carregam a
        // mesma URL (escrita dupla da seção 4 do protocolo) e `imagem` só é
        // removido na 1.0.0, quando nenhum leitor antigo o procurar.
        anexo: null,
        // A task 05 acrescentou `formato`, e a igualdade exata continua
        // exata. Ele diz como `descricao` deve ser lida; ausente significa
        // texto puro, que e o que todo chamado gravado ate a v0.6.0 e. Nenhum
        // documento antigo precisa ser tocado para isso valer (AC-COR-07).
        formato: 'markdown',
        atendido: false,
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

    expect(JSON.stringify(await chamadosGravados())).not.toContain(RELOGIO_ADIANTADO_DO_ALUNO);
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

  // INVERTIDO pela task 04. Este caso nasceu na task 00 provando que o anexo
  // abria por `window.open` — que nos laboratórios do SENAI vem bloqueado por
  // política de imagem do Windows, e engolia o clique em silêncio. A asserção
  // vira de "chama window.open" para "NÃO chama, e abre o visualizador na
  // própria página". Nenhum caso foi removido.
  it('NÃO abre por window.open: o anexo abre em visualizador (AC-IMG-10)', () => {
    const abrirJanela = jest.spyOn(window, 'open').mockImplementation(() => null);
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', imagem: 'https://exemplo.br/erro.png' }),
    ]);
    renderComProvedores(<TelaAluno />);

    userEvent.click(screen.getByTitle('Ver imagem'));

    expect(abrirJanela).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    abrirJanela.mockRestore();
  });

  it('exibe chamado antigo cujo campo imagem é string de URL (AC-IMG-13)', () => {
    __semearColecao('chamados', [
      {
        id: 'antigo',
        nome: 'Bruno',
        email: 'b@senai.br',
        descricao: 'print antigo',
        horario: '2025-01-05T10:00:00.000Z',
        imagem: 'https://exemplo.br/antigo.png',
      },
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

    // Os cartões são achados pelo conteúdo, e não pela posição na lista: desde
    // a v0.9.0 dois chamados com o MESMO horário desempatam pelo id do chamado
    // (AC-PERK-09), e a ordem entre estes dois deixou de ser a de semeadura.
    // A afirmação deste teste nunca foi sobre ordem — é sobre de quem é o
    // botão —, e por isso ela continua valendo palavra por palavra.
    const meuCartao = screen.getByText('meu chamado').closest('.problema-card');
    const cartaoAlheio = screen.getByText('chamado do Bruno').closest('.problema-card');

    expect(within(meuCartao).getByRole('button', { name: 'Excluir' })).toBeInTheDocument();
    expect(within(cartaoAlheio).queryByRole('button', { name: 'Excluir' })).toBeNull();
  });

  // INVERTIDO pela task 08. Na v0.9.0 um clique só apagava a dúvida, com o
  // print junto e sem volta. O AC-CHAMADO-04 sempre exigiu a confirmação, e
  // este caso registrava a ausência dela apontando para esta task.
  //
  // A asserção vira de "some da tela e do banco num clique" para "pede
  // confirmação, e só então some". A exclusão otimista e a janela de desfazer
  // estão em `exclusaoDeChamado.test.js`; o que se afirma aqui é o que esta
  // tela sempre afirmou — que o chamado sai da fila e sai do banco.
  it('remove o chamado do banco e da tela DEPOIS de confirmar', async () => {
    const relogio = fixarRelogio(HORARIO_DO_SERVIDOR);
    __semearColecao('chamados', [
      fabricaChamado({ id: 'meu', email: 'ana@senai.br', descricao: 'meu chamado' }),
    ]);
    renderComProvedores(<TelaAluno />);

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    await userEvent.click(confirmarNoDialogo());

    await waitFor(() => expect(screen.queryByText('meu chamado')).not.toBeInTheDocument());

    // A gravação é adiada pela janela de desfazer (AC-CHAMADO-04): o documento
    // sai do banco quando ela vence, e não no clique.
    act(() => relogio.avancar(PRAZO_DE_DESFAZER_MS));
    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(0));

    restaurarRelogio();
  });

  // INVERTIDO pela task 08, pelo mesmo motivo do caso acima. Era
  // "exclui SEM pedir confirmação".
  it('NÃO exclui enquanto a confirmação não vem — nem pelo `window.confirm`', async () => {
    const confirmar = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    __semearColecao('chamados', [
      fabricaChamado({ id: 'meu', email: 'ana@senai.br', descricao: 'meu chamado' }),
    ]);
    renderComProvedores(<TelaAluno />);

    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    // O diálogo é do app, e não do navegador: `window.confirm` vem suprimido
    // por política do Windows em parte dos laboratórios, e suprimido ele
    // devolve `false` em silêncio (AC-ANIM-07).
    expect(confirmar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await chamadosGravados()).toHaveLength(1);
    expect(screen.getByText('meu chamado')).toBeInTheDocument();

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
    __semearColecao('chamados', [
      chamadoDeBruno('chegou primeiro', '2025-03-10T10:00:00.000Z'),
    ]);

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
    __semearColecao('chamados', [
      chamadoDeBruno('chegou primeiro', '2025-03-10T10:00:00.000Z'),
    ]);

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
    expect(
      [...cartoes()].map((cartao) => within(cartao).getByText(/^chamado /).textContent)
    ).toEqual(['chamado confirmado', 'chamado em voo']);
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

// ---------------------------------------------------------------------------
// Task 05 — cor escolhida e markdown no card.
//
// Os dois campos são aditivos: `cor` já existia e continua sendo uma string
// CSS; `formato` é novo, e a ausência dele é o que preserva todo chamado já
// gravado. Os casos abaixo cobrem as duas pontas — o que a tela grava e o que
// ela mostra —, e o grupo de retrocompatibilidade prova que o card de março
// continua aparecendo como apareceu em março.
// ---------------------------------------------------------------------------

async function abrirModalEEscolherCor(nomeDaCor, descricao) {
  userEvent.click(screen.getByRole('button', { name: '+' }));
  userEvent.click(document.querySelector('.painel-avancado summary'));
  userEvent.click(screen.getByRole('radio', { name: nomeDaCor }));
  userEvent.type(screen.getByPlaceholderText('Descreva o problema'), descricao);
  userEvent.click(screen.getByRole('button', { name: 'Concluir' }));
}

describe('TelaAluno — a cor escolhida pelo aluno (AC-COR-04)', () => {
  beforeEach(() => window.localStorage.clear());

  it('grava no chamado a cor que o aluno escolheu, e não uma sorteada', async () => {
    const escolhida = PALETA[4];
    renderComProvedores(<TelaAluno />);

    await abrirModalEEscolherCor(escolhida.nome, 'A rede caiu');

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(1));
    expect((await chamadosGravados())[0].cor).toBe(escolhida.fundo);
  });

  it('pinta o card com a cor da paleta, para todo mundo que o vê', () => {
    const escolhida = PALETA[4];
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', cor: escolhida.fundo })]);

    renderComProvedores(<TelaAluno />);

    expect(cartoes()[0]).toHaveStyle({ backgroundColor: escolhida.fundo });
  });

  it('usa a cor de texto que a paleta garante legível (AC-COR-03)', () => {
    const escolhida = PALETA[4];
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', cor: escolhida.fundo })]);

    renderComProvedores(<TelaAluno />);

    expect(cartoes()[0]).toHaveStyle({ color: escolhida.texto });
  });

  it('NÃO mexe na cor de texto do card antigo, de cor sorteada (AC-COR-05)', () => {
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', cor: 'hsl(210, 70%, 80%)' })]);

    renderComProvedores(<TelaAluno />);

    // Vazio, e não "preto": a cor do texto do card legado continua sendo a que
    // o CSS define, exatamente como antes desta versão.
    expect(cartoes()[0].style.color).toBe('');
  });
});

describe('TelaAluno — markdown no card (AC-COR-07, AC-COR-08)', () => {
  beforeEach(() => window.localStorage.clear());

  it('grava os chamados novos como markdown', async () => {
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'o **cabo** caiu' });

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(1));
    expect((await chamadosGravados())[0].formato).toBe('markdown');
  });

  it('rende o markdown do chamado no card', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', descricao: 'o **cabo** caiu', formato: 'markdown' }),
    ]);

    renderComProvedores(<TelaAluno />);

    expect(cartoes()[0].querySelector('.texto-markdown strong')).toHaveTextContent('cabo');
  });

  it('não deixa script de um chamado chegar ao DOM (AC-COR-08)', () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'c1',
        descricao: '<img src=x onerror=alert(1)><script>alert(1)</script>',
        formato: 'markdown',
      }),
    ]);

    renderComProvedores(<TelaAluno />);

    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });
});

describe('TelaAluno — o card de março continua o card de março (AC-COR-05)', () => {
  it('não interpreta como markdown a descrição de um chamado sem formato', () => {
    __semearColecao('chamados', [
      {
        id: 'antigo',
        nome: 'Bruno',
        email: 'b@senai.br',
        horario: '2025-03-10T10:00:00.000Z',
        cor: 'hsl(210, 70%, 80%)',
        descricao: 'o arquivo C:\\Users\\*.log some e o _log_ fica vazio',
      },
    ]);

    renderComProvedores(<TelaAluno />);

    const [cartao] = cartoes();
    // Escopado ao texto da descrição: o `<em>` do horário do card é do card,
    // não do markdown.
    expect(cartao.querySelector('.texto-markdown em')).toBeNull();
    expect(cartao.querySelector('.texto-markdown strong')).toBeNull();
    expect(
      within(cartao).getByText('o arquivo C:\\Users\\*.log some e o _log_ fica vazio')
    ).toBeInTheDocument();
  });

  it('escapa HTML da descrição antiga em vez de executá-lo (AC-SEC-04)', () => {
    __semearColecao('chamados', [
      {
        id: 'antigo',
        nome: 'Bruno',
        email: 'b@senai.br',
        horario: '2025-03-10T10:00:00.000Z',
        descricao: '<script>alert(1)</script>',
      },
    ]);

    renderComProvedores(<TelaAluno />);

    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
  });
});
