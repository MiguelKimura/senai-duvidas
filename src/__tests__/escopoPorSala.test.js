// Chamados e chat escopados por sala — AC-SALA-07, AC-PERF-03, AC-PERF-04.
//
// Este é o coração da task 03. Até a v0.4.0, `chamados` e `chat` eram coleções
// globais: o aluno de mecânica do noturno via a dúvida do aluno de informática
// do matutino, e o professor recebia a fila da escola inteira. A partir daqui,
// cada sala tem a sua subcoleção, e o que uma sala vê para na porta dela.
//
// As duas compatibilidades do protocolo (seção 4) também moram aqui:
//
//   * **retroativa** — sem `salaId`, as telas continuam lendo as coleções
//     globais da v0.4.0. É o fallback que impede a tela vazia no meio da
//     migração, para um aluno que abrir o app antes de entrar em sala alguma.
//   * **futura** — o documento novo grava `autorNome` **e** `nome`, com o mesmo
//     conteúdo. Um cliente 0.4.0 com a aba aberta continua exibindo o autor;
//     `nome` só sai na 1.0.0, depois que ninguém mais o lê.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __documentosDe,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import TelaAluno, { ROTULO_DO_NOVO_CHAMADO } from '../components/TelaAluno';
import TelaProfessor from '../components/TelaProfessor';
import Chat from '../components/chat/Chat';
import { MENSAGENS_POR_PAGINA } from '../services/chat';
import { LIMITE_DE_CHAMADOS, LIMITE_DE_MENSAGENS, PAPEL_DE_PROFESSOR } from '../services/salas';
import {
  excluirChamadoNaTela,
  fixarRelogio,
  renderComProvedores,
  restaurarRelogio,
} from '../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const HORARIO_DO_SERVIDOR = '2026-03-10T13:45:00.000Z';

const CHAMADOS_DA_SALA_A = 'salas/sala-a/chamados';
const CHAMADOS_DA_SALA_B = 'salas/sala-b/chamados';
const CHAT_DA_SALA_A = 'salas/sala-a/chat';
const CHAT_DA_SALA_B = 'salas/sala-b/chat';

/** Os cartões de chamado que estão na tela. */
function cartoes() {
  return document.querySelectorAll('.problema-card');
}

/**
 * Os balões de fala que estão na tela.
 *
 * `.fala-box` era a marcação da v0.7.0, quando o balão era um `div` solto. O
 * chat da v0.8.0 monta cada mensagem como item de lista, e o texto — o único
 * pedaço que este arquivo mede — mora em `.mensagem-texto`.
 */
function falas() {
  return Array.from(document.querySelectorAll('.mensagem-texto')).map((no) => no.textContent);
}

// O painel fechado nao escuta nada (AC-PERF-03), e a sessao resolve em outro
// tick: abrir e perguntar na mesma linha alcanca o aviso de carregamento, nao a
// conversa. Esperar a aba "Sala" aparecer e esperar as duas coisas de uma vez.
async function abrirChat() {
  await userEvent.click(document.querySelector('.toggle-chat-btn'));

  return screen.findByRole('tab', { name: 'Sala' });
}

function semearAsDuasSalas() {
  __semearColecao(CHAMADOS_DA_SALA_A, [
    {
      id: 'a1',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      nome: 'Ana Souza',
      email: ANA.email,
      descricao: 'O torno da sala A travou.',
      horario: '2026-03-10T13:00:00.000Z',
      atendido: false,
    },
  ]);
  __semearColecao(CHAMADOS_DA_SALA_B, [
    {
      id: 'b1',
      autorUid: 'uid-bruno',
      autorNome: 'Bruno Dias',
      nome: 'Bruno Dias',
      email: 'bruno@senai.br',
      descricao: 'O Visual Studio da sala B não abre.',
      horario: '2026-03-10T13:10:00.000Z',
      atendido: false,
    },
  ]);
  // As duas falas são do dia de `HORARIO_DO_SERVIDOR`, fixado no `beforeEach`:
  // a aba da sala mostra a conversa de hoje, e uma mensagem sem `horario` nao
  // pode ser provada como de hoje — ela fica no histórico, atrás do botão.
  // O que este arquivo mede é a porta da sala, não o filtro do dia.
  __semearColecao(CHAT_DA_SALA_A, [
    {
      id: 'ma',
      autorNome: 'Ana Souza',
      nome: 'Ana Souza',
      texto: 'Oi da sala A',
      email: ANA.email,
      horario: new Date('2026-03-10T12:00:00.000Z'),
    },
  ]);
  __semearColecao(CHAT_DA_SALA_B, [
    {
      id: 'mb',
      autorNome: 'Bruno Dias',
      nome: 'Bruno Dias',
      texto: 'Oi da sala B',
      email: 'bruno@senai.br',
      horario: new Date('2026-03-10T12:00:00.000Z'),
    },
  ]);
}

/** A fila global da v0.4.0, que a migração ainda não copiou. */
function semearColecoesGlobais() {
  __semearColecao('chamados', [
    {
      id: 'legado',
      nome: 'Ana Souza',
      email: ANA.email,
      descricao: 'Chamado da coleção global antiga.',
      horario: '2026-03-09T13:00:00.000Z',
    },
  ]);
  __semearColecao('chat', [
    {
      id: 'legado',
      nome: 'Ana Souza',
      email: ANA.email,
      texto: 'Mensagem global antiga',
      // `horario` como `Date`, que e exatamente a forma que a v0.4.0 gravava.
      // O documento legado nao tem `autorUid` nem `autorNome`: a cor dele sai
      // do e-mail, pelo caminho legado, e o nome exibido e o `nome`.
      horario: new Date('2026-03-10T12:00:00.000Z'),
    },
  ]);
}

beforeEach(() => {
  // O relogio do LEITOR, nao so o do servidor. Desde a v0.8.0 a aba da sala
  // mostra a conversa **de hoje** (ADR 0009): sem fixar o dia da maquina no
  // mesmo dia dos dados semeados, toda fala deste arquivo nasce "de outro dia"
  // e o que se estaria medindo era a data em que a suite rodou.
  fixarRelogio(HORARIO_DO_SERVIDOR);
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
});

afterEach(() => restaurarRelogio());

describe('Chamados escopados por sala (AC-SALA-07)', () => {
  it('a tela do aluno da sala A não mostra o chamado da sala B', async () => {
    semearAsDuasSalas();

    renderComProvedores(<TelaAluno salaId="sala-a" />);

    expect(await screen.findByText('O torno da sala A travou.')).toBeInTheDocument();
    expect(screen.queryByText('O Visual Studio da sala B não abre.')).not.toBeInTheDocument();
  });

  it('a tela do professor da sala A também para na porta da sala A', async () => {
    semearAsDuasSalas();

    renderComProvedores(<TelaProfessor salaId="sala-a" />);

    expect(await screen.findByText('O torno da sala A travou.')).toBeInTheDocument();
    expect(screen.queryByText('O Visual Studio da sala B não abre.')).not.toBeInTheDocument();
  });

  it('dentro de uma sala, a fila global antiga não se mistura à da turma', async () => {
    semearAsDuasSalas();
    semearColecoesGlobais();

    renderComProvedores(<TelaAluno salaId="sala-a" />);

    expect(await screen.findByText('O torno da sala A travou.')).toBeInTheDocument();
    expect(screen.queryByText('Chamado da coleção global antiga.')).not.toBeInTheDocument();
  });

  it('o chamado novo é gravado na subcoleção da sala, e não na coleção global', async () => {
    renderComProvedores(<TelaAluno salaId="sala-a" />);

    await userEvent.click(screen.getByRole('button', { name: ROTULO_DO_NOVO_CHAMADO }));
    await userEvent.type(screen.getByPlaceholderText(/descreva/i), 'A furadeira não liga.');
    await userEvent.click(screen.getByRole('button', { name: /concluir/i }));
    __confirmarCarimbos();

    await waitFor(() => expect(__documentosDe(CHAMADOS_DA_SALA_A)).toHaveLength(1));
    expect(__documentosDe('chamados')).toHaveLength(0);
  });

  it('excluir dentro da sala apaga o documento da sala', async () => {
    semearAsDuasSalas();
    // A confirmação e a janela de desfazer da v0.10.0 entraram entre o clique
    // e a gravação (AC-CHAMADO-04). A afirmação deste caso é sobre ESCOPO —
    // a sala B não é tocada —, e ela continua inteira.
    const relogio = fixarRelogio('2026-09-23T12:00:00.000Z');
    renderComProvedores(<TelaAluno salaId="sala-a" />);
    await screen.findByText('O torno da sala A travou.');

    await excluirChamadoNaTela(relogio);

    await waitFor(() => expect(__documentosDe(CHAMADOS_DA_SALA_A)).toHaveLength(0));
    expect(__documentosDe(CHAMADOS_DA_SALA_B)).toHaveLength(1);

    restaurarRelogio();
  });
});

describe('Chat escopado por sala (AC-SALA-07, AC-CHAT-10)', () => {
  it('a conversa da sala A não mostra a fala da sala B', async () => {
    semearAsDuasSalas();
    renderComProvedores(<Chat salaId="sala-a" />);

    await abrirChat();

    await waitFor(() => expect(falas().join(' ')).toContain('Oi da sala A'));
    expect(falas().join(' ')).not.toContain('Oi da sala B');
  });

  it('a mensagem nova vai para a subcoleção da sala', async () => {
    renderComProvedores(<Chat salaId="sala-a" />);
    await abrirChat();

    await userEvent.type(screen.getByPlaceholderText('Escreva uma mensagem'), 'Bom dia');
    await userEvent.click(document.querySelector('.enviar-btn'));
    __confirmarCarimbos();

    await waitFor(() => expect(__documentosDe(CHAT_DA_SALA_A)).toHaveLength(1));
    expect(__documentosDe('chat')).toHaveLength(0);
  });

  it('o !clear limpa só a conversa da sala, nunca a das outras', async () => {
    // Antes da task 03 o `!clear` era global: um aluno apagava a conversa da
    // escola inteira digitando cinco letras.
    //
    // A task 06 fechou a outra metade do buraco: o comando passou a exigir
    // papel de professor — garantido pela rule, não por esta tela — e a
    // perguntar antes. O que ESTE caso mede continua sendo o escopo, então ele
    // entra pelo caminho de quem tem permissão e responde à pergunta. Que o
    // aluno seja recusado é provado em `Chat.caracterizacao.test.js` e, do
    // lado que vale, em `tests/rules/salas.rules.test.js`.
    semearAsDuasSalas();
    renderComProvedores(<Chat salaId="sala-a" papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();

    await userEvent.type(screen.getByPlaceholderText('Escreva uma mensagem'), '!clear');
    await userEvent.click(document.querySelector('.enviar-btn'));

    await userEvent.click(await screen.findByRole('button', { name: 'Apagar' }));

    await waitFor(() => expect(__documentosDe(CHAT_DA_SALA_A)).toHaveLength(0));
    expect(__documentosDe(CHAT_DA_SALA_B)).toHaveLength(1);
  });
});

describe('Compatibilidade retroativa — sem sala, lê o que a v0.4.0 gravou', () => {
  it('a tela do aluno sem `salaId` mostra a fila da coleção global', async () => {
    semearColecoesGlobais();

    renderComProvedores(<TelaAluno />);

    expect(await screen.findByText('Chamado da coleção global antiga.')).toBeInTheDocument();
  });

  it('o chat sem `salaId` mostra a conversa da coleção global', async () => {
    semearColecoesGlobais();
    renderComProvedores(<Chat />);

    await abrirChat();

    await waitFor(() => expect(falas().join(' ')).toContain('Mensagem global antiga'));
  });

  it('um chamado antigo, sem `autorNome` nem `atendido`, continua legível dentro da sala', async () => {
    // O documento que a migração copia é exatamente o da v0.4.0: tem `nome`,
    // não tem `autorNome` e não tem `atendido`. A tela da sala precisa exibi-lo.
    __semearColecao(CHAMADOS_DA_SALA_A, [
      {
        id: 'migrado',
        nome: 'Ana Souza',
        email: ANA.email,
        descricao: 'Chamado migrado, no formato antigo.',
        horario: '2026-03-09T13:00:00.000Z',
      },
    ]);

    renderComProvedores(<TelaAluno salaId="sala-a" />);

    expect(await screen.findByText('Chamado migrado, no formato antigo.')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
  });
});

describe('Compatibilidade futura — o documento novo não quebra o leitor antigo', () => {
  it('o chamado novo grava `autorNome` e `nome` com o mesmo conteúdo', async () => {
    renderComProvedores(<TelaAluno salaId="sala-a" />);

    await userEvent.click(screen.getByRole('button', { name: ROTULO_DO_NOVO_CHAMADO }));
    await userEvent.type(screen.getByPlaceholderText(/descreva/i), 'A furadeira não liga.');
    await userEvent.click(screen.getByRole('button', { name: /concluir/i }));
    __confirmarCarimbos();

    await waitFor(() => expect(__documentosDe(CHAMADOS_DA_SALA_A)).toHaveLength(1));
    const [chamado] = __documentosDe(CHAMADOS_DA_SALA_A);
    expect(chamado.autorNome).toBe('Ana Souza');
    expect(chamado.nome).toBe('Ana Souza');
    expect(chamado.autorUid).toBe(ANA.uid);
    expect(chamado.email).toBe(ANA.email);
  });

  it('a mensagem nova também grava os dois nomes', async () => {
    renderComProvedores(<Chat salaId="sala-a" />);
    await abrirChat();

    await userEvent.type(screen.getByPlaceholderText('Escreva uma mensagem'), 'Bom dia');
    await userEvent.click(document.querySelector('.enviar-btn'));
    __confirmarCarimbos();

    await waitFor(() => expect(__documentosDe(CHAT_DA_SALA_A)).toHaveLength(1));
    const [mensagem] = __documentosDe(CHAT_DA_SALA_A);
    expect(mensagem.autorNome).toBe('Ana Souza');
    expect(mensagem.nome).toBe('Ana Souza');
    expect(mensagem.autorUid).toBe(ANA.uid);
  });
});

describe('Custo de leitura e listeners (AC-PERF-03, AC-PERF-04)', () => {
  it('a fila da sala é cortada no teto, e não cresce o ano letivo inteiro', async () => {
    __semearColecao(
      CHAMADOS_DA_SALA_A,
      Array.from({ length: LIMITE_DE_CHAMADOS + 2 }, (_, indice) => ({
        id: `c${indice}`,
        autorNome: 'Ana Souza',
        nome: 'Ana Souza',
        email: ANA.email,
        descricao: `Chamado ${indice}`,
        // `horarioIso` já preenchido: sem ele, o backfill da task 02 dispararia
        // uma escrita por documento, e o que este teste mede é o teto do
        // listener, não a migração de horário.
        horario: new Date(Date.UTC(2026, 2, 10, 12, indice)).toISOString(),
        horarioIso: new Date(Date.UTC(2026, 2, 10, 12, indice)).toISOString(),
        atendido: false,
      }))
    );

    renderComProvedores(<TelaAluno salaId="sala-a" />);

    await waitFor(() => expect(cartoes().length).toBeGreaterThan(0));
    expect(cartoes().length).toBe(LIMITE_DE_CHAMADOS);
  });

  it('a conversa da sala também tem teto', async () => {
    __semearColecao(
      CHAT_DA_SALA_A,
      Array.from({ length: LIMITE_DE_MENSAGENS + 2 }, (_, indice) => ({
        id: `m${indice}`,
        autorNome: 'Ana Souza',
        nome: 'Ana Souza',
        email: ANA.email,
        texto: `Mensagem ${indice}`,
        horario: new Date(Date.UTC(2026, 2, 10, 12, indice)).toISOString(),
        horarioIso: new Date(Date.UTC(2026, 2, 10, 12, indice)).toISOString(),
      }))
    );

    renderComProvedores(<Chat salaId="sala-a" />);
    await abrirChat();

    await waitFor(() => expect(falas().length).toBeGreaterThan(0));

    // O teto da v0.7.0 era o da PRIMEIRA leitura: 300 documentos baixados por
    // cada aluno cada vez que a tela abria. Na v0.8.0 a janela abre em 50
    // (AC-CHAT-06) e só cresce a pedido, e o `LIMITE_DE_MENSAGENS` virou o
    // ponto em que a paginação para de crescer. Semeamos 302: a janela corta
    // em 50, e nem paginando se passa de 300.
    expect(falas().length).toBe(MENSAGENS_POR_PAGINA);
    expect(MENSAGENS_POR_PAGINA).toBeLessThan(LIMITE_DE_MENSAGENS);
  });

  it('trocar de sala não acumula listener nenhum', async () => {
    const { rerender, unmount } = renderComProvedores(<TelaAluno salaId="sala-a" />);
    await waitFor(() => expect(__ouvintesAtivos()).toBeGreaterThan(0));
    const depoisDaPrimeira = __ouvintesAtivos();

    rerender(<TelaAluno salaId="sala-b" />);

    await waitFor(() => expect(__ouvintesAtivos()).toBe(depoisDaPrimeira));

    unmount();
    await waitFor(() => expect(__ouvintesAtivos()).toBe(0));
  });
});
