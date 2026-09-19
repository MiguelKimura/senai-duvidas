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
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import TelaAluno from '../TelaAluno';
import {
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

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
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

    expect(cartoes()[0]).toHaveStyle({ backgroundColor: 'hsl(120, 70%, 80%)' });
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

    await waitFor(async () =>
      expect(await chamadosGravados()).toEqual([
        {
          nome: 'Ana Souza',
          email: 'ana@senai.br',
          descricao: 'O VS Code não abre',
          horario: expect.any(String),
          cor: expect.stringMatching(/^hsl\(/),
          imagem: null,
        },
      ])
    );
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

  it('carimba o horário com o relógio DO CLIENTE — falha que a task 02 corrige', async () => {
    fixarRelogio('2025-03-10T13:45:00.000Z');
    renderComProvedores(<TelaAluno />);

    await abrirModalECriar({ descricao: 'O VS Code não abre' });

    await waitFor(async () => expect(await chamadosGravados()).toHaveLength(1));
    const [chamado] = await chamadosGravados();
    expect(chamado.horario).toBe('2025-03-10T13:45:00.000Z');
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
