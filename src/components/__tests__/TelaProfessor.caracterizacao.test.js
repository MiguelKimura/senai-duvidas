// Caracterização da tela do professor.
//
// É a contraparte da tela do aluno: mesma leitura de `chamados`, mesma
// ordenação, mas com um poder a mais — o professor pode excluir QUALQUER
// chamado, não só o seu. Esse poder hoje não é verificado em lugar nenhum:
// quem renderiza esta tela é o `App`, com base no papel lido do
// `localStorage`. Os testes abaixo registram esse estado:
//   * a exclusão não checa papel nem autoria — qualquer sessão que monte este
//     componente apaga o chamado de qualquer aluno (task 01 e task 03);
//   * o `onSnapshot` assina a coleção `chamados` inteira, sem `where` nem
//     `limit` — viola AC-PERF-03 e impede o escopo por sala (task 03);
//   * o retorno da exclusão é um `alert()` bloqueante (task 08 troca por toast).
import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  Timestamp,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import TelaProfessor from '../TelaProfessor';
import { fabricaChamado, renderComProvedores } from '../../test-utils';

const db = getFirestore();

const PROFESSOR = {
  uid: 'uid-prof',
  email: 'carlos.lima@senai.br',
  displayName: 'Carlos Lima',
};

/** Os cards, na ordem em que aparecem no DOM. */
function cardsNaTela() {
  return Array.from(document.querySelectorAll('.problema-card'));
}

/** Os nomes dos autores, na ordem em que aparecem no DOM. */
function autoresNaTela() {
  return cardsNaTela().map((card) => card.querySelector('.user-name').textContent);
}

beforeEach(() => {
  __resetarFirestore();
  __resetarAuth();
  __definirUsuarioAtual(PROFESSOR);
  // `handleDelete` chama `alert`, que o jsdom não implementa.
  jest.spyOn(window, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelaProfessor — lista de chamados (AC-CHAMADO-03)', () => {
  it('lista os chamados de TODOS os alunos, não só os do próprio professor', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', nome: 'Ana Souza', email: 'ana@senai.br' }),
      fabricaChamado({ id: 'c2', nome: 'Bruno Dias', email: 'bruno@senai.br' }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(autoresNaTela()).toEqual(['Ana Souza', 'Bruno Dias']);
  });

  it('ordena a fila por horário crescente, o mais antigo primeiro', () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'novo',
        nome: 'Chegou depois',
        horario: '2025-03-10T15:00:00.000Z',
      }),
      fabricaChamado({
        id: 'antigo',
        nome: 'Chegou antes',
        horario: '2025-03-10T09:00:00.000Z',
      }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(autoresNaTela()).toEqual(['Chegou antes', 'Chegou depois']);
  });

  it('mostra autor, descrição e horário no card (AC-CHAMADO-07)', () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'c1',
        nome: 'Ana Souza',
        descricao: 'O Visual Studio não abre no computador 12.',
      }),
    ]);

    renderComProvedores(<TelaProfessor />);

    const card = cardsNaTela()[0];
    expect(within(card).getByText('Ana Souza')).toBeInTheDocument();
    expect(
      within(card).getByText('O Visual Studio não abre no computador 12.')
    ).toBeInTheDocument();
    expect(card.querySelector('em')).not.toBeEmptyDOMElement();
  });

  it('usa a cor gravada no chamado como fundo do card (AC-COR-05)', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', cor: 'hsl(120, 70%, 80%)' }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(cardsNaTela()[0]).toHaveStyle({ backgroundColor: 'hsl(120, 70%, 80%)' });
  });

  it('reage em tempo real a um chamado criado enquanto a tela está aberta (AC-CHAMADO-02)', async () => {
    renderComProvedores(<TelaProfessor />);
    expect(cardsNaTela()).toHaveLength(0);

    __semearColecao('chamados', [fabricaChamado({ id: 'c1', nome: 'Ana Souza' })]);

    await waitFor(() => expect(autoresNaTela()).toEqual(['Ana Souza']));
  });

  it('cancela os listeners ao desmontar (AC-PERF-04)', () => {
    // São dois: o desta tela, em `chamados`, e o do `<Chat/>` embutido no
    // rodapé, em `chat`. Montar a tela do professor custa duas assinaturas de
    // coleção inteira — o dobro do que a task 03 vai precisar escopar por sala.
    const { unmount } = renderComProvedores(<TelaProfessor />);
    expect(__ouvintesAtivos()).toBe(2);

    unmount();

    expect(__ouvintesAtivos()).toBe(0);
  });
});

describe('TelaProfessor — compatibilidade retroativa de horario (AC-TEMPO-08)', () => {
  it('lê e ordena documentos com horario em string ISO e em Timestamp na mesma lista', () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'timestamp',
        nome: 'Gravado como Timestamp',
        horario: Timestamp.fromDate(new Date('2025-03-10T14:00:00.000Z')),
      }),
      fabricaChamado({
        id: 'iso',
        nome: 'Gravado como string ISO',
        horario: '2025-03-10T08:00:00.000Z',
      }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(autoresNaTela()).toEqual(['Gravado como string ISO', 'Gravado como Timestamp']);
  });

  it('não quebra com documento sem horario nenhum', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'sem-horario', nome: 'Sem horário', horario: undefined }),
    ]);

    expect(() => renderComProvedores(<TelaProfessor />)).not.toThrow();
    expect(autoresNaTela()).toEqual(['Sem horário']);
  });
});

describe('TelaProfessor — anexo por URL (AC-IMG-01)', () => {
  it('exibe o ícone de visualização quando o chamado tem imagem', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', imagem: 'https://exemplo.test/erro.png' }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(screen.getByTitle('Ver imagem')).toBeInTheDocument();
  });

  it('não exibe o ícone quando o chamado não tem imagem', () => {
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', imagem: null })]);

    renderComProvedores(<TelaProfessor />);

    expect(screen.queryByTitle('Ver imagem')).not.toBeInTheDocument();
  });

  it('abre o anexo por window.open — bloqueado em laboratório, AC-IMG-10 corrige', async () => {
    const abrir = jest.spyOn(window, 'open').mockImplementation(() => null);
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', imagem: 'https://exemplo.test/erro.png' }),
    ]);

    renderComProvedores(<TelaProfessor />);
    await userEvent.click(screen.getByTitle('Ver imagem'));

    expect(abrir).toHaveBeenCalledWith('https://exemplo.test/erro.png', '_blank');
  });
});

describe('TelaProfessor — exclusão sem restrição (AC-CHAMADO-05)', () => {
  it('mostra Excluir em TODOS os cards, inclusive nos de outros alunos', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', nome: 'Ana Souza', email: 'ana@senai.br' }),
      fabricaChamado({ id: 'c2', nome: 'Bruno Dias', email: 'bruno@senai.br' }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(screen.getAllByRole('button', { name: 'Excluir' })).toHaveLength(2);
  });

  it('remove do banco e da tela o chamado de um aluno qualquer', async () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', nome: 'Ana Souza', email: 'ana@senai.br' }),
    ]);

    renderComProvedores(<TelaProfessor />);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(cardsNaTela()).toHaveLength(0));
    const restantes = await getDocs(collection(db, 'chamados'));
    expect(restantes.size).toBe(0);
  });

  it('exclui SEM pedir confirmação — o AC-CHAMADO-04 exige confirmar, a task 08 resolve', async () => {
    const confirmar = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    __semearColecao('chamados', [fabricaChamado({ id: 'c1' })]);

    renderComProvedores(<TelaProfessor />);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(cardsNaTela()).toHaveLength(0));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('avisa o sucesso por alert bloqueante — a task 08 troca por toast', async () => {
    __semearColecao('chamados', [fabricaChamado({ id: 'c1' })]);

    renderComProvedores(<TelaProfessor />);
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith('Chamado excluído com sucesso!')
    );
  });
});
