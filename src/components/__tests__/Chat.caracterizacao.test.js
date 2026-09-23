// Caracterização do chat da sala — INVERTIDA PELA TASK 06.
//
// Este arquivo nasceu na task 00 fixando o que o chat fazia, **inclusive o que
// ele fazia de errado**, para que a task que o corrigisse precisasse virar cada
// asserção uma a uma. É a inversão que comprova a correção; apagar os casos
// teria deixado o CI verde sem prova nenhuma.
//
// O que era fixado aqui, e o que virou:
//
//   `onSnapshot` na coleção `chat` INTEIRA, sem `limit` útil
//       -> janela decrescente de 50, com paginação (AC-CHAT-06). A prova da
//          consulta está em `src/hooks/__tests__/useMensagens.test.js`.
//
//   `!clear` de qualquer aluno apaga a conversa da turma
//       -> só o professor, com confirmação, e garantido pela rule
//          (AC-CHAT-08). A prova do servidor está em
//          `tests/rules/salas.rules.test.js`.
//
//   cor do balão caindo no e-mail de QUEM ESTÁ OLHANDO
//       -> cor derivada do autor, estável entre sessões e dispositivos
//          (AC-CHAT-02).
//
//   nenhum horário na mensagem, embora `horario` fosse gravado
//       -> HH:mm de Brasília em cada balão (AC-CHAT-01).
//
//   reset de meia-noite por `setTimeout` de até 24 horas, apagando documentos
//       -> filtro do dia corrente, sem destruir histórico (ADR 0009).
//
//   botão do chat sem nome acessível
//       -> "Abrir o chat" / "Fechar o chat". A marcação é nova desta versão, e
//          nascer sem nome seria um defeito autorado aqui. O resto do
//          AC-ANIM-09 continua sendo da task 08.
//
// O comportamento que **não** mudou — abrir, fechar, digitar, enviar com
// Enter, ver a mensagem de outra pessoa chegar — continua fixado abaixo, com
// as mesmas asserções de antes.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  collection,
  getDocs,
  getFirestore,
  Timestamp,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import Chat from '../chat/Chat';
import { PAPEL_DE_ALUNO, PAPEL_DE_PROFESSOR } from '../../services/salas';
import {
  fabricaMensagem,
  fixarRelogio,
  renderComProvedores,
  restaurarRelogio,
} from '../../test-utils';

const db = getFirestore();

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const BRUNO = { uid: 'uid-bruno', email: 'bruno@senai.br', displayName: 'Bruno Dias' };

/** O instante que o servidor carimba, longe de qualquer relógio de máquina. */
const HORARIO_DO_SERVIDOR = '2025-03-10T13:45:00.000Z';

/** Abre o painel do chat e espera a sessão resolver. */
async function abrirChat() {
  await userEvent.click(screen.getByRole('button', { name: /abrir o chat/i }));

  return screen.findByRole('tab', { name: 'Sala' });
}

/** O campo de digitação — só existe com o painel aberto. */
function campoDeMensagem() {
  return screen.getByPlaceholderText('Escreva uma mensagem');
}

/** Os textos das falas, na ordem em que aparecem no DOM. */
function falasNaTela() {
  return [...document.querySelectorAll('.mensagem-texto')].map((balao) => balao.textContent);
}

/** Os autores exibidos, na ordem do DOM. */
function autoresNaTela() {
  return [...document.querySelectorAll('.mensagem-autor')].map((no) => no.textContent);
}

function enviar() {
  return userEvent.click(screen.getByRole('button', { name: /enviar mensagem/i }));
}

beforeEach(() => {
  // As fábricas produzem mensagens de 10/03/2025; o relógio do leitor precisa
  // estar no mesmo dia, porque a aba da sala mostra a conversa **de hoje**.
  fixarRelogio(HORARIO_DO_SERVIDOR);
  __resetarFirestore();
  __resetarAuth();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
});

afterEach(() => restaurarRelogio());

describe('Chat — abertura do painel', () => {
  it('começa fechado: o campo de mensagem não está no DOM', () => {
    renderComProvedores(<Chat />);

    expect(screen.queryByPlaceholderText('Escreva uma mensagem')).not.toBeInTheDocument();
  });

  it('abre o painel ao clicar no botão flutuante', async () => {
    renderComProvedores(<Chat />);

    await abrirChat();

    expect(campoDeMensagem()).toBeInTheDocument();
  });

  // INVERTIDO pela task 06. O caso nasceu fixando `toHaveAccessibleName('')`
  // com um TODO para a task 08. A marcação do botão é reescrita aqui, e
  // reescrevê-la sem nome seria autorar o defeito em vez de herdá-lo.
  it('o botão que abre o chat tem nome acessível', () => {
    renderComProvedores(<Chat />);

    expect(screen.getByRole('button', { name: 'Abrir o chat' })).toBeInTheDocument();
  });
});

describe('Chat — leitura das mensagens (AC-CHAT-01)', () => {
  it('renderiza autor e texto de cada mensagem', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', nome: 'Ana Souza', texto: 'Bom dia, turma' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    await waitFor(() => expect(falasNaTela()).toEqual(['Bom dia, turma']));
    expect(autoresNaTela()).toEqual(['Ana Souza']);
  });

  it('ordena as mensagens por horário crescente', async () => {
    __semearColecao('chat', [
      fabricaMensagem({
        id: 'depois',
        texto: 'segunda',
        horario: new Date('2025-03-10T15:00:00.000Z'),
      }),
      fabricaMensagem({
        id: 'antes',
        texto: 'primeira',
        horario: new Date('2025-03-10T09:00:00.000Z'),
      }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    await waitFor(() => expect(falasNaTela()).toEqual(['primeira', 'segunda']));
  });

  it('reage em tempo real a uma mensagem de outra pessoa', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();
    expect(falasNaTela()).toEqual([]);

    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', nome: 'Bruno Dias', texto: 'Alguém tem o link?' }),
    ]);

    await waitFor(() => expect(falasNaTela()).toEqual(['Alguém tem o link?']));
  });

  // ACRESCENTADO pela task 06 (AC-CHAT-01). O campo `horario` era gravado
  // desde a v0.1.0 e nunca exibido.
  it('mostra o horário de cada mensagem, em HH:mm de Brasília', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', horario: new Date('2025-03-10T15:30:00.000Z') }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    // 15:30 em UTC é 12:30 em Brasília.
    expect(await screen.findByText('12:30')).toBeInTheDocument();
  });

  it('cancela o listener ao desmontar (AC-PERF-04)', async () => {
    const { unmount } = renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(__ouvintesAtivos()).toBe(1));

    unmount();

    expect(__ouvintesAtivos()).toBe(0);
  });
});

describe('Chat — envio de mensagem', () => {
  it('grava texto, nome e email do autor', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), 'Consegui rodar aqui');
    await enviar();

    await waitFor(async () => {
      const gravadas = await getDocs(collection(db, 'chat'));
      expect(gravadas.size).toBe(1);
    });

    const gravadas = await getDocs(collection(db, 'chat'));
    expect(gravadas.docs[0].data()).toMatchObject({
      texto: 'Consegui rodar aqui',
      nome: 'Ana Souza',
      email: 'ana@senai.br',
    });
  });

  it('limpa o campo depois de enviar', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), 'Consegui rodar aqui');
    await enviar();

    await waitFor(() => expect(campoDeMensagem()).toHaveValue(''));
  });

  it('envia também com a tecla Enter', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), 'Enviado com Enter{Enter}');

    await waitFor(async () => {
      const gravadas = await getDocs(collection(db, 'chat'));
      expect(gravadas.size).toBe(1);
    });
  });

  it('não grava mensagem vazia nem só com espaços', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), '    ');
    await enviar();

    const gravadas = await getDocs(collection(db, 'chat'));
    expect(gravadas.size).toBe(0);
  });

  // INVERTIDO pela task 02 e mantido pela 06. O caso nasceu provando que o
  // horário era um `Date` do navegador — o relógio do aluno.
  it('carimba o horário com o relógio DO SERVIDOR (AC-TEMPO-01)', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), 'Que horas são?');
    await enviar();

    await waitFor(async () => {
      const gravadas = await getDocs(collection(db, 'chat'));
      expect(gravadas.size).toBe(1);
    });

    // Fase 1: escrita otimista, sem horário provisório do cliente.
    const emVoo = await getDocs(collection(db, 'chat'));
    expect(emVoo.docs[0].data().horario).toBeNull();

    // Fase 2: o servidor responde.
    __confirmarCarimbos();

    const gravadas = await getDocs(collection(db, 'chat'));
    expect(gravadas.docs[0].data().horario).toBeInstanceOf(Timestamp);
    expect(gravadas.docs[0].data().horario.toDate()).toEqual(new Date(HORARIO_DO_SERVIDOR));
  });
});

// INVERTIDO pela task 06 (AC-CHAT-02). O bloco original se chamava "cor por
// e-mail" e fixava, entre outras coisas, que uma mensagem sem `email` herdava a
// cor de quem estava lendo. Os casos continuam; o que mudou é de onde a cor sai.
describe('Chat — cor estável por autor (AC-CHAT-02)', () => {
  it('dá a mesma cor à mesma pessoa em mensagens diferentes', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', email: 'ana@senai.br', texto: 'primeira' }),
      fabricaMensagem({ id: 'm2', email: 'ana@senai.br', texto: 'segunda' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(2));

    const [primeira, segunda] = document.querySelectorAll('.mensagem-balao');
    expect(primeira.style.backgroundColor).toBe(segunda.style.backgroundColor);
  });

  it('dá cores diferentes a pessoas diferentes', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', email: 'ana@senai.br' }),
      fabricaMensagem({ id: 'm2', email: 'bruno@senai.br' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(2));

    const [daAna, doBruno] = document.querySelectorAll('.mensagem-balao');
    expect(daAna.style.backgroundColor).not.toBe(doBruno.style.backgroundColor);
  });

  it('a cor é estável entre sessões', async () => {
    __semearColecao('chat', [fabricaMensagem({ id: 'm1', email: 'ana@senai.br' })]);

    const view = renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(1));
    const corNaPrimeiraSessao = document.querySelector('.mensagem-balao').style.backgroundColor;
    view.unmount();

    renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(1));

    expect(document.querySelector('.mensagem-balao').style.backgroundColor).toBe(
      corNaPrimeiraSessao
    );
  });

  // INVERTIDO. Era: "renderiza mensagem antiga sem o campo email, caindo no
  // e-mail da sessão". Cair no e-mail da sessão é o defeito — a mesma mensagem
  // ficava de uma cor para a Ana e de outra para o Bruno.
  it('a cor NÃO cai no e-mail de quem está lendo', async () => {
    const semIdentidade = fabricaMensagem({
      id: 'm1',
      nome: 'Autor Antigo',
      texto: 'sem email',
      email: undefined,
    });

    __definirUsuarioAtual(ANA);
    const view = renderComProvedores(<Chat />);
    await abrirChat();
    __semearColecao('chat', [semIdentidade]);
    await waitFor(() => expect(falasNaTela()).toEqual(['sem email']));
    const corParaAna = document.querySelector('.mensagem-balao').style.backgroundColor;
    view.unmount();

    __resetarFirestore();
    __definirUsuarioAtual(BRUNO);
    renderComProvedores(<Chat />);
    await abrirChat();
    __semearColecao('chat', [semIdentidade]);
    await waitFor(() => expect(falasNaTela()).toEqual(['sem email']));

    expect(document.querySelector('.mensagem-balao').style.backgroundColor).toBe(corParaAna);
  });

  it('marca a mensagem do próprio usuário com uma classe diferente', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', autorUid: ANA.uid, email: 'ana@senai.br' }),
      fabricaMensagem({ id: 'm2', autorUid: BRUNO.uid, email: 'bruno@senai.br' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(2));

    const cards = document.querySelectorAll('.mensagem');
    expect(cards[0]).toHaveClass('mensagem--minha');
    expect(cards[1]).toHaveClass('mensagem--de-outro');
  });
});

// INVERTIDO pela task 06 (AC-CHAT-08). O bloco original se chamava "comando
// !clear sem restrição" e o primeiro caso provava, em código executável, que um
// aluno apagava o chat inteiro da turma. É a falha grave que esta task corrige,
// e o caso continua aqui com a asserção virada.
describe('Chat — comando !clear, agora só do professor (AC-CHAT-08)', () => {
  it('um ALUNO não apaga o chat da turma: recebe a recusa', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', email: 'bruno@senai.br', texto: 'da outra pessoa' }),
      fabricaMensagem({ id: 'm2', email: 'ana@senai.br', texto: 'minha' }),
    ]);
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Chat papelNaSala={PAPEL_DE_ALUNO} />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(2));

    await userEvent.type(campoDeMensagem(), '!clear');
    await enviar();

    expect(await screen.findByRole('alert')).toHaveTextContent(/professor/i);
    expect(falasNaTela()).toHaveLength(2);
    expect((await getDocs(collection(db, 'chat'))).size).toBe(2);
  });

  it('o professor precisa confirmar, e só então a conversa é apagada', async () => {
    __semearColecao('chat', [fabricaMensagem({ id: 'm1' })]);

    renderComProvedores(<Chat papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(1));

    await userEvent.type(campoDeMensagem(), '!clear');
    await enviar();

    expect(await screen.findByText(/apagar a conversa da turma/i)).toBeInTheDocument();
    expect((await getDocs(collection(db, 'chat'))).size).toBe(1);

    await userEvent.click(screen.getByRole('button', { name: /^apagar$/i }));

    await waitFor(async () => expect((await getDocs(collection(db, 'chat'))).size).toBe(0));
  });

  it('reconhece o comando sem diferenciar maiúsculas de minúsculas', async () => {
    __semearColecao('chat', [fabricaMensagem({ id: 'm1' })]);

    renderComProvedores(<Chat papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), '!CLEAR');
    await enviar();

    expect(await screen.findByText(/apagar a conversa da turma/i)).toBeInTheDocument();
  });

  it('não grava o !clear como mensagem visível', async () => {
    renderComProvedores(<Chat papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), '!clear');
    await enviar();

    await waitFor(() => expect(campoDeMensagem()).toHaveValue(''));
    expect((await getDocs(collection(db, 'chat'))).size).toBe(0);
  });
});

describe('Chat — compatibilidade retroativa', () => {
  it('renderiza mensagem antiga sem autorUid, com o nome gravado', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', nome: 'Autor Antigo', texto: 'sem email', email: undefined }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    await waitFor(() => expect(falasNaTela()).toEqual(['sem email']));
    expect(autoresNaTela()).toEqual(['Autor Antigo']);
  });
});

// INVERTIDO pela task 06 (ADR 0009). O bloco original provava que o chat
// APAGAVA as mensagens à meia-noite de Brasília, com um `setTimeout` de até 24
// horas. A promessa visível ao usuário continua a mesma — a conversa começa
// limpa a cada dia — e o histórico deixa de ser destruído para cumpri-la.
describe('Chat — o dia vira à meia-noite de Brasília (AC-TEMPO-07)', () => {
  // 19/09/2026, 14:32 em Brasília. Faltam 9h28min para a meia-noite de lá.
  const TARDE_DE_SABADO = '2026-09-19T17:32:00.000Z';
  const MS_ATE_A_MEIA_NOITE = 9 * 3600000 + 28 * 60000;

  /** Uma mensagem da tarde de sábado, no mesmo dia do relógio fixado. */
  function daTarde() {
    return fabricaMensagem({
      id: 'm1',
      texto: 'conversa da tarde',
      horario: new Date(TARDE_DE_SABADO),
    });
  }

  it('a conversa da tarde continua na tela um instante antes da meia-noite', async () => {
    const relogio = fixarRelogio(TARDE_DE_SABADO);
    __semearColecao('chat', [daTarde()]);
    renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(1));

    relogio.avancar(MS_ATE_A_MEIA_NOITE - 1);

    expect(falasNaTela()).toHaveLength(1);
  });

  it('na meia-noite de Brasília a tela começa limpa', async () => {
    const relogio = fixarRelogio(TARDE_DE_SABADO);
    __semearColecao('chat', [daTarde()]);
    renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(1));

    relogio.avancar(MS_ATE_A_MEIA_NOITE + 1000);

    await waitFor(() => expect(falasNaTela()).toHaveLength(0));
  });

  // INVERTIDO. Era `deleteDoc` em cada mensagem. A conversa de ontem sai da
  // tela e **fica no banco**: um professor que precise mostrar hoje o que foi
  // combinado ontem não deveria depender de alguém ter deixado a aba aberta.
  it('a virada do dia NÃO apaga nenhuma mensagem do banco', async () => {
    const relogio = fixarRelogio(TARDE_DE_SABADO);
    __semearColecao('chat', [daTarde()]);
    renderComProvedores(<Chat />);
    await abrirChat();
    await waitFor(() => expect(falasNaTela()).toHaveLength(1));

    relogio.avancar(MS_ATE_A_MEIA_NOITE + 1000);

    await waitFor(() => expect(falasNaTela()).toHaveLength(0));
    expect((await getDocs(collection(db, 'chat'))).size).toBe(1);
  });

  it('cancela o temporizador ao desmontar', async () => {
    fixarRelogio(TARDE_DE_SABADO);
    const { unmount } = renderComProvedores(<Chat />);
    await abrirChat();
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
