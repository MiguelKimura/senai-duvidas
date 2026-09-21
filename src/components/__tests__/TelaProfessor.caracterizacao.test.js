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
  addDoc,
  collection,
  getDocs,
  serverTimestamp,
  getFirestore,
  Timestamp,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import TelaProfessor from '../TelaProfessor';
import { PALETA } from '../../utils/paleta';
import { corDeFundo, fabricaChamado, renderComProvedores } from '../../test-utils';

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
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', cor: 'hsl(120, 70%, 80%)' })]);

    renderComProvedores(<TelaProfessor />);

    // Ver corDeFundo.js: `toHaveStyle` com `hsl()` no jsdom nao prova nada.
    expect(corDeFundo(cardsNaTela()[0])).toBe('hsl(120, 70%, 80%)');
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

  // INVERTIDO pela task 04, junto com o caso gêmeo da tela do aluno. Os dois
  // chamavam `window.open`, que nos laboratórios do SENAI vem bloqueado por
  // política de imagem do Windows e engolia o clique em silêncio. A asserção
  // vira de "chama window.open" para "NÃO chama, e abre o visualizador na
  // própria página". Nenhum caso foi removido.
  it('NÃO abre por window.open: o anexo abre em visualizador (AC-IMG-10)', async () => {
    const abrir = jest.spyOn(window, 'open').mockImplementation(() => null);
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', imagem: 'https://exemplo.test/erro.png' }),
    ]);

    renderComProvedores(<TelaProfessor />);
    await userEvent.click(screen.getByTitle('Ver imagem'));

    expect(abrir).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
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

describe('TelaProfessor — botão Sair (AC-SESSAO-05)', () => {
  it('oferece a saída explícita da sessão na própria tela', () => {
    renderComProvedores(<TelaProfessor />);

    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
  });
});

// Do lado do professor a janela pendente aparece igual: o card do aluno chega
// na tela dele antes de o servidor carimbar.
describe('TelaProfessor — horário pendente e exibição em Brasília (AC-TEMPO-03, AC-TEMPO-06)', () => {
  /** O `<em>` de cada card, na ordem da tela. */
  function horariosNaTela() {
    return cardsNaTela().map((card) => card.querySelector('em').textContent);
  }

  it('mostra "enviando…" no card cujo carimbo o servidor ainda não devolveu', () => {
    // `horario: null` é exatamente o que o SDK entrega no documento local.
    __semearColecao('chamados', [fabricaChamado({ id: 'em-voo', horario: null })]);

    renderComProvedores(<TelaProfessor />);

    expect(horariosNaTela()).toEqual(['enviando…']);
  });

  it('exibe o horário confirmado no fuso de Brasília, não no da máquina', () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'confirmado',
        horario: Timestamp.fromDate(new Date('2025-03-10T13:45:00.000Z')),
      }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(horariosNaTela()).toEqual(['10/03/2025 10:45']);
  });

  it('exibe o chamado antigo, com horario em string ISO, no mesmo formato', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'antigo', horario: '2025-03-10T13:45:00.000Z' }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(horariosNaTela()).toEqual(['10/03/2025 10:45']);
  });

  it('marca com travessão o chamado que nunca teve horário, sem dizer "enviando…"', () => {
    __semearColecao('chamados', [fabricaChamado({ id: 'sem-horario', horario: undefined })]);

    renderComProvedores(<TelaProfessor />);

    expect(horariosNaTela()).toEqual(['—']);
  });

  it('o card pendente assume a posição definitiva quando o servidor confirma', async () => {
    __definirRelogioDoServidor('2025-03-10T09:30:00.000Z');
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'confirmado',
        nome: 'Chegou depois',
        horario: Timestamp.fromDate(new Date('2025-03-10T10:00:00.000Z')),
      }),
    ]);
    // Um chamado em voo, que o servidor vai carimbar ANTES do outro.
    await addDoc(collection(db, 'chamados'), {
      nome: 'Chegou antes',
      email: 'ana@senai.br',
      descricao: 'em voo',
      horario: serverTimestamp(),
    });

    renderComProvedores(<TelaProfessor />);
    // Enquanto pendente, fica no fim — sem pular de posição a cada reemissão.
    expect(autoresNaTela()).toEqual(['Chegou depois', 'Chegou antes']);

    __confirmarCarimbos();

    await waitFor(() => expect(autoresNaTela()).toEqual(['Chegou antes', 'Chegou depois']));
  });
});

// ---------------------------------------------------------------------------
// Task 05 — o card do professor mostra o que o do aluno mostra.
//
// A fila do professor é a mesma fila, e o card é o mesmo card. A task 04 já
// mostrou o preço de esquecer isso: o ícone de anexo era dois trechos de JSX
// copiados, e os dois tinham divergido em silêncio. Estes casos existem para
// que cor e markdown não repitam a história.
// ---------------------------------------------------------------------------

describe('TelaProfessor — cor e markdown do card (AC-COR-04, AC-COR-07)', () => {
  it('pinta o card com a cor da paleta escolhida pelo aluno', () => {
    const escolhida = PALETA[6];
    __semearColecao('chamados', [fabricaChamado({ id: 'c1', cor: escolhida.fundo })]);

    renderComProvedores(<TelaProfessor />);

    expect(cardsNaTela()[0]).toHaveStyle({ backgroundColor: escolhida.fundo });
    expect(cardsNaTela()[0]).toHaveStyle({ color: escolhida.texto });
  });

  it('rende o markdown do chamado', () => {
    __semearColecao('chamados', [
      fabricaChamado({ id: 'c1', descricao: 'o **cabo** caiu', formato: 'markdown' }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(cardsNaTela()[0].querySelector('.texto-markdown strong')).toHaveTextContent('cabo');
  });

  it('não deixa script chegar ao DOM (AC-COR-08)', () => {
    __semearColecao('chamados', [
      fabricaChamado({
        id: 'c1',
        descricao: '<script>alert(1)</script><img src=x onerror=alert(1)>',
        formato: 'markdown',
      }),
    ]);

    renderComProvedores(<TelaProfessor />);

    expect(document.querySelector('script')).toBeNull();
    expect(document.querySelector('img[onerror]')).toBeNull();
  });

  it('mostra o chamado antigo como texto puro, sem interpretar markdown', () => {
    __semearColecao('chamados', [
      {
        id: 'antigo',
        nome: 'Bruno',
        email: 'b@senai.br',
        horario: '2025-03-10T10:00:00.000Z',
        cor: 'hsl(210, 70%, 80%)',
        descricao: 'o *.log some',
      },
    ]);

    renderComProvedores(<TelaProfessor />);

    const [cartao] = cardsNaTela();
    // Escopado ao texto da descrição: o `<em>` do horário é do card.
    expect(cartao.querySelector('.texto-markdown em')).toBeNull();
    expect(within(cartao).getByText('o *.log some')).toBeInTheDocument();
    expect(cartao.style.color).toBe('');
  });
});
