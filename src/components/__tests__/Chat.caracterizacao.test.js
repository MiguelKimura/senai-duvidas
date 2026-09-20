// Caracterização do chat da sala.
//
// O chat é o componente com mais dívida estrutural da v0.1.0, e é inteiro
// reescrito pela task 06. Antes disso, este arquivo fixa o que ele faz hoje:
//   * `onSnapshot` na coleção `chat` INTEIRA, sem `where` nem `limit` — com o
//     alvo de 1000 mensagens por sala isso é leitura de coleção cheia a cada
//     abertura de tela (viola AC-PERF-03);
//   * `!clear` apaga o chat inteiro para QUALQUER usuário, sem checar papel —
//     um aluno apaga a conversa da turma toda (task 06 restringe ao professor);
//   * `horario` é `new Date()` do cliente (task 02 troca por serverTimestamp);
//   * o botão que abre o chat não tem nome acessível (task 08, AC-ANIM-09).
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
import Chat from '../Chat';
import {
  corDeFundo,
  fabricaMensagem,
  fixarRelogio,
  renderComProvedores,
  restaurarRelogio,
} from '../../test-utils';

const db = getFirestore();

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

/** O instante que o servidor carimba, longe de qualquer relógio de máquina. */
const HORARIO_DO_SERVIDOR = '2025-03-10T13:45:00.000Z';
const BRUNO = { uid: 'uid-bruno', email: 'bruno@senai.br', displayName: 'Bruno Dias' };

/** Abre o painel do chat, que começa fechado. */
async function abrirChat() {
  await userEvent.click(document.querySelector('.toggle-chat-btn'));
}

/** O campo de digitação — só existe com o painel aberto. */
function campoDeMensagem() {
  return screen.getByPlaceholderText('Escreva uma mensagem');
}

/** Os balões de fala, na ordem em que aparecem no DOM. */
function falasNaTela() {
  return Array.from(document.querySelectorAll('.fala-box')).map((balao) => balao.textContent);
}

beforeEach(() => {
  __resetarFirestore();
  __resetarAuth();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
  __definirUsuarioAtual(ANA);
});

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

  it('o botão que abre o chat não tem nome acessível — AC-ANIM-09 corrige na task 08', () => {
    renderComProvedores(<Chat />);

    const botao = document.querySelector('.toggle-chat-btn');
    expect(botao).toBeInTheDocument();
    expect(botao).toHaveAccessibleName('');
  });
});

describe('Chat — leitura das mensagens (AC-CHAT-01)', () => {
  it('renderiza autor e texto de cada mensagem', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', nome: 'Ana Souza', texto: 'Bom dia, turma' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    expect(falasNaTela()).toEqual(['Ana Souza: Bom dia, turma']);
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

    expect(falasNaTela()).toEqual(['Ana Souza: primeira', 'Ana Souza: segunda']);
  });

  it('reage em tempo real a uma mensagem de outra pessoa (AC-CHAT-02)', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();
    expect(falasNaTela()).toEqual([]);

    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', nome: 'Bruno Dias', texto: 'Alguém tem o link?' }),
    ]);

    await waitFor(() => expect(falasNaTela()).toEqual(['Bruno Dias: Alguém tem o link?']));
  });

  it('cancela o listener ao desmontar (AC-PERF-04)', () => {
    const { unmount } = renderComProvedores(<Chat />);
    expect(__ouvintesAtivos()).toBe(1);

    unmount();

    expect(__ouvintesAtivos()).toBe(0);
  });
});

describe('Chat — envio de mensagem (AC-CHAT-01)', () => {
  it('grava texto, nome e email do autor', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), 'Consegui rodar aqui');
    await userEvent.click(document.querySelector('.enviar-btn'));

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
    await userEvent.click(document.querySelector('.enviar-btn'));

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
    await userEvent.click(document.querySelector('.enviar-btn'));

    const gravadas = await getDocs(collection(db, 'chat'));
    expect(gravadas.size).toBe(0);
  });

  // INVERTIDO pela task 02. O caso nasceu na task 00 provando que o horário da
  // mensagem era um `Date` do navegador — o relógio do aluno. A asserção vira
  // para o carimbo do servidor; o caso continua aqui.
  it('carimba o horário com o relógio DO SERVIDOR (AC-TEMPO-01)', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), 'Que horas são?');
    await userEvent.click(document.querySelector('.enviar-btn'));

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

describe('Chat — cor por e-mail (AC-COR-05)', () => {
  it('dá a mesma cor à mesma pessoa em mensagens diferentes', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', email: 'ana@senai.br', texto: 'primeira' }),
      fabricaMensagem({ id: 'm2', email: 'ana@senai.br', texto: 'segunda' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    const [primeira, segunda] = document.querySelectorAll('.fala-box');
    expect(corDeFundo(primeira)).toBe(corDeFundo(segunda));
    expect(corDeFundo(primeira)).toMatch(/^hsl\(/);
  });

  it('dá cores diferentes a pessoas diferentes', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', email: 'ana@senai.br' }),
      fabricaMensagem({ id: 'm2', email: 'bruno@senai.br' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    const [daAna, doBruno] = document.querySelectorAll('.fala-box');
    expect(corDeFundo(daAna)).not.toBe(corDeFundo(doBruno));
  });

  it('a cor é derivada do e-mail, então é estável entre sessões', async () => {
    __semearColecao('chat', [fabricaMensagem({ id: 'm1', email: 'ana@senai.br' })]);

    const { unmount } = renderComProvedores(<Chat />);
    await abrirChat();
    const corNaPrimeiraSessao = corDeFundo(document.querySelector('.fala-box'));
    unmount();

    renderComProvedores(<Chat />);
    await abrirChat();

    expect(corDeFundo(document.querySelector('.fala-box'))).toBe(corNaPrimeiraSessao);
  });

  it('marca a mensagem do próprio usuário com uma classe diferente', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', email: 'ana@senai.br' }),
      fabricaMensagem({ id: 'm2', email: 'bruno@senai.br' }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    const cards = document.querySelectorAll('.mensagem-card');
    expect(cards[0]).toHaveClass('minha-mensagem');
    expect(cards[1]).toHaveClass('mensagem-outro-usuario');
  });
});

describe('Chat — comando !clear sem restrição', () => {
  it('um ALUNO apaga o chat inteiro da turma — task 06 restringe ao professor', async () => {
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', email: 'bruno@senai.br', texto: 'da outra pessoa' }),
      fabricaMensagem({ id: 'm2', email: 'ana@senai.br', texto: 'minha' }),
    ]);
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Chat />);
    await abrirChat();
    expect(falasNaTela()).toHaveLength(2);

    await userEvent.type(campoDeMensagem(), '!clear');
    await userEvent.click(document.querySelector('.enviar-btn'));

    await waitFor(() => expect(falasNaTela()).toHaveLength(0));
    const restantes = await getDocs(collection(db, 'chat'));
    expect(restantes.size).toBe(0);
  });

  it('reconhece o comando sem diferenciar maiúsculas de minúsculas', async () => {
    __semearColecao('chat', [fabricaMensagem({ id: 'm1' })]);

    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), '!CLEAR');
    await userEvent.click(document.querySelector('.enviar-btn'));

    await waitFor(() => expect(falasNaTela()).toHaveLength(0));
  });

  it('não grava o !clear como mensagem visível', async () => {
    renderComProvedores(<Chat />);
    await abrirChat();

    await userEvent.type(campoDeMensagem(), '!clear');
    await userEvent.click(document.querySelector('.enviar-btn'));

    await waitFor(() => expect(campoDeMensagem()).toHaveValue(''));
    const gravadas = await getDocs(collection(db, 'chat'));
    expect(gravadas.size).toBe(0);
  });
});

describe('Chat — compatibilidade retroativa', () => {
  it('renderiza mensagem antiga sem o campo email, caindo no e-mail da sessão', async () => {
    __definirUsuarioAtual(BRUNO);
    __semearColecao('chat', [
      fabricaMensagem({ id: 'm1', nome: 'Autor Antigo', texto: 'sem email', email: undefined }),
    ]);

    renderComProvedores(<Chat />);
    await abrirChat();

    expect(falasNaTela()).toEqual(['Autor Antigo: sem email']);
    expect(corDeFundo(document.querySelector('.fala-box'))).toMatch(/^hsl\(/);
  });
});

// O chat se limpa à meia-noite. **Qual** meia-noite não é detalhe: a da
// máquina pode estar a horas da de Brasília, e a conversa da turma sumiria no
// meio da aula seguinte — ou sobreviveria um dia a mais.
//
// Este arquivo roda também em `npm run test:fusos`, com o processo em UTC e em
// America/New_York. É lá que o caso ganha os dentes: numa máquina já em
// Brasília, `setHours(24, 0, 0, 0)` acerta por coincidência.
describe('Chat — reset à meia-noite de Brasília (AC-TEMPO-07)', () => {
  // 19/09/2026, 14:32 em Brasília. Faltam 9h28min para a meia-noite de lá.
  const TARDE_DE_SABADO = '2026-09-19T17:32:00.000Z';
  const MS_ATE_A_MEIA_NOITE = 9 * 3600000 + 28 * 60000;

  afterEach(() => restaurarRelogio());

  it('não limpa nada um milissegundo antes da meia-noite de Brasília', async () => {
    const relogio = fixarRelogio(TARDE_DE_SABADO);
    __semearColecao('chat', [fabricaMensagem({ id: 'm1', texto: 'conversa da tarde' })]);
    renderComProvedores(<Chat />);
    await abrirChat();

    relogio.avancar(MS_ATE_A_MEIA_NOITE - 1);

    expect(falasNaTela()).toHaveLength(1);
  });

  it('limpa a conversa exatamente na meia-noite de Brasília', async () => {
    const relogio = fixarRelogio(TARDE_DE_SABADO);
    __semearColecao('chat', [fabricaMensagem({ id: 'm1', texto: 'conversa da tarde' })]);
    renderComProvedores(<Chat />);
    await abrirChat();

    relogio.avancar(MS_ATE_A_MEIA_NOITE);

    await waitFor(() => expect(falasNaTela()).toHaveLength(0));
  });

  it('cancela o timer ao desmontar, para não limpar o chat de outra tela', () => {
    fixarRelogio(TARDE_DE_SABADO);
    const { unmount } = renderComProvedores(<Chat />);
    expect(jest.getTimerCount()).toBeGreaterThan(0);

    unmount();

    expect(jest.getTimerCount()).toBe(0);
  });
});
