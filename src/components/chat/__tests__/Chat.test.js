// A casca do chat — AC-CHAT-05 a AC-CHAT-10, AC-CHAT-13, AC-DM-01.
//
// Aqui se prova o que só existe com as peças montadas: as abas, o `!clear` com
// confirmação e o "reset" de meia-noite, que nesta versão deixa de apagar
// documentos.
//
// **Sobre o reset.** Até a v0.7.0 o chat se limpava à meia-noite apagando as
// mensagens com um `setTimeout` de até 24 horas — que não sobrevivia a um
// refresh e usava a meia-noite da máquina. A v0.8.0 mantém a promessa visível
// ("o chat começa limpo a cada dia") e para de destruir histórico: a conversa
// de ontem sai da tela e continua no banco, alcançável por um clique. Um
// professor que precise mostrar o que foi combinado ontem hoje não consegue —
// e ninguém decidiu isso, foi só o efeito colateral de um `deleteDoc`.
import React from 'react';
import { act, screen, waitFor } from '@testing-library/react';
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
import Chat from '../Chat';
import { PAPEL_DE_ALUNO, PAPEL_DE_PROFESSOR } from '../../../services/salas';
import { fixarRelogio, renderComProvedores, restaurarRelogio } from '../../../test-utils';

const SALA = 'sala-a';
const CHAT = `salas/${SALA}/chat`;
const MEMBROS = `salas/${SALA}/membros`;

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };

/** 10/03/2026, 14:00 em Brasília. */
const TARDE = '2026-03-10T17:00:00.000Z';

/**
 * Abre o painel e espera a sessão resolver.
 *
 * O `findByRole` não é enfeite: até o `AuthContext` responder quem está
 * logado, o painel mostra "Carregando a conversa..." em vez do campo. Sem essa
 * espera o teste digitaria numa tela que ainda não sabe quem é o autor.
 */
async function abrirChat() {
  await userEvent.click(screen.getByRole('button', { name: /abrir o chat/i }));

  return screen.findByRole('tab', { name: 'Sala' });
}

function campo() {
  return screen.getByPlaceholderText('Escreva uma mensagem');
}

function falas() {
  return [...document.querySelectorAll('.mensagem-texto')].map((no) => no.textContent);
}

/** Uma mensagem da turma, no instante dado. */
function mensagemEm(id, texto, quando, autor = ANA) {
  return {
    id,
    autorUid: autor.uid,
    autorNome: autor.displayName,
    nome: autor.displayName,
    email: autor.email,
    texto,
    horario: new Date(quando),
  };
}

beforeEach(() => {
  // O relógio do LEITOR precisa estar no mesmo dia das mensagens semeadas: a
  // partir desta versão a aba da sala mostra a conversa **de hoje**, e sem
  // fixar o dia a suíte passaria hoje e falharia amanhã.
  fixarRelogio(TARDE);
  __resetarFirestore();
  __resetarAuth();
  __definirRelogioDoServidor(TARDE);
  __definirUsuarioAtual(ANA);
  __semearColecao(MEMBROS, [
    { id: ANA.uid, nome: 'Ana Souza', email: ANA.email, papel: PAPEL_DE_ALUNO },
    { id: CARLOS.uid, nome: 'Carlos Lima', email: CARLOS.email, papel: PAPEL_DE_PROFESSOR },
  ]);
});

afterEach(() => restaurarRelogio());

describe('Chat — o painel', () => {
  it('começa fechado', () => {
    renderComProvedores(<Chat salaId={SALA} />);

    expect(screen.queryByPlaceholderText('Escreva uma mensagem')).not.toBeInTheDocument();
  });

  it('o botão que abre o chat tem nome acessível', async () => {
    // INVERTIDO em relação à caracterização da task 00, que fixava
    // `toHaveAccessibleName('')`. O botão é marcação nova desta versão, e
    // nascer sem nome seria um defeito autorado aqui, não herdado. O resto do
    // AC-ANIM-09 continua sendo da task 08.
    renderComProvedores(<Chat salaId={SALA} />);

    expect(screen.getByRole('button', { name: /abrir o chat/i })).toBeInTheDocument();
  });

  it('abre e fecha o painel', async () => {
    renderComProvedores(<Chat salaId={SALA} />);

    await abrirChat();
    expect(campo()).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /fechar o chat/i }));
    expect(screen.queryByPlaceholderText('Escreva uma mensagem')).not.toBeInTheDocument();
  });
});

describe('Chat — abas Sala e Diretas (AC-DM-01)', () => {
  it('abre na aba da sala', async () => {
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();

    expect(screen.getByRole('tab', { name: 'Sala' })).toHaveAttribute('aria-selected', 'true');
  });

  it('troca para a aba de diretas', async () => {
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();

    await userEvent.click(screen.getByRole('tab', { name: 'Diretas' }));

    expect(await screen.findByRole('button', { name: /nova conversa/i })).toBeInTheDocument();
  });

  it('a aba de diretas esconde a conversa da turma', async () => {
    __semearColecao(CHAT, [mensagemEm('m1', 'Bom dia, turma', TARDE)]);
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();
    await waitFor(() => expect(falas()).toEqual(['Bom dia, turma']));

    await userEvent.click(screen.getByRole('tab', { name: 'Diretas' }));

    expect(falas()).toEqual([]);
  });

  it('volta para a aba da sala com a conversa da turma intacta', async () => {
    __semearColecao(CHAT, [mensagemEm('m1', 'Bom dia, turma', TARDE)]);
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();
    await userEvent.click(screen.getByRole('tab', { name: 'Diretas' }));

    await userEvent.click(screen.getByRole('tab', { name: 'Sala' }));

    await waitFor(() => expect(falas()).toEqual(['Bom dia, turma']));
  });
});

describe('Chat — envio na conversa da turma', () => {
  it('grava os campos novos e os legados na subcoleção da sala', async () => {
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_ALUNO} />);
    await abrirChat();

    await userEvent.type(campo(), 'Consegui rodar aqui{Enter}');

    await waitFor(() => expect(__documentosDe(CHAT)).toHaveLength(1));
    expect(__documentosDe(CHAT)[0]).toMatchObject({
      texto: 'Consegui rodar aqui',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      autorPapel: PAPEL_DE_ALUNO,
      nome: 'Ana Souza',
      email: ANA.email,
    });
  });

  it('a mensagem aparece como "enviando" e confirma ao gravar (AC-CHAT-07)', async () => {
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();

    await userEvent.type(campo(), 'Bom dia{Enter}');

    expect(await screen.findByText('enviando…')).toBeInTheDocument();

    __confirmarCarimbos();

    await waitFor(() => expect(screen.queryByText('enviando…')).not.toBeInTheDocument());
    expect(screen.getByText('14:00')).toBeInTheDocument();
  });

  it('o selo de professor aparece em quem escreve como professor (AC-CHAT-04)', async () => {
    __definirUsuarioAtual(CARLOS);
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();

    await userEvent.type(campo(), 'Atenção, turma{Enter}');
    __confirmarCarimbos();

    expect(await screen.findByText('Professor')).toBeInTheDocument();
  });
});

describe('Chat — !clear só do professor, com confirmação (AC-CHAT-08)', () => {
  beforeEach(() => {
    __semearColecao(CHAT, [
      mensagemEm('m1', 'primeira', TARDE),
      mensagemEm('m2', 'segunda', TARDE, CARLOS),
    ]);
  });

  it('o ALUNO recebe a recusa e a conversa continua inteira', async () => {
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_ALUNO} />);
    await abrirChat();
    await waitFor(() => expect(falas()).toHaveLength(2));

    await userEvent.type(campo(), '!clear{Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent(/professor/i);
    expect(__documentosDe(CHAT)).toHaveLength(2);
  });

  it('o !clear do aluno não apaga NENHUMA mensagem, nem as dele', async () => {
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_ALUNO} />);
    await abrirChat();

    await userEvent.type(campo(), '!clear{Enter}');
    await screen.findByRole('alert');

    expect(falas()).toHaveLength(2);
  });

  it('o professor PRECISA confirmar antes de qualquer deleção', async () => {
    __definirUsuarioAtual(CARLOS);
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();

    await userEvent.type(campo(), '!clear{Enter}');

    expect(await screen.findByText(/apagar a conversa da turma/i)).toBeInTheDocument();
    expect(__documentosDe(CHAT)).toHaveLength(2);
  });

  it('confirmar apaga a conversa da sala', async () => {
    __definirUsuarioAtual(CARLOS);
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();
    await userEvent.type(campo(), '!clear{Enter}');
    await screen.findByText(/apagar a conversa da turma/i);

    await userEvent.click(screen.getByRole('button', { name: /^apagar$/i }));

    await waitFor(() => expect(__documentosDe(CHAT)).toHaveLength(0));
  });

  it('cancelar não apaga nada e fecha o aviso', async () => {
    __definirUsuarioAtual(CARLOS);
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();
    await userEvent.type(campo(), '!clear{Enter}');
    await screen.findByText(/apagar a conversa da turma/i);

    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.queryByText(/apagar a conversa da turma/i)).not.toBeInTheDocument();
    expect(__documentosDe(CHAT)).toHaveLength(2);
  });

  it('o !clear não é gravado como mensagem visível', async () => {
    __definirUsuarioAtual(CARLOS);
    renderComProvedores(<Chat salaId={SALA} papelNaSala={PAPEL_DE_PROFESSOR} />);
    await abrirChat();

    await userEvent.type(campo(), '!clear{Enter}');
    await screen.findByText(/apagar a conversa da turma/i);

    expect(falas()).not.toContain('!clear');
    expect(__documentosDe(CHAT)).toHaveLength(2);
  });
});

// O "reset de meia-noite", reescrito. A promessa visível ao usuário não muda —
// o chat começa limpo a cada dia — e o custo dela sim: nada é apagado.
describe('Chat — o dia corrente (AC-TEMPO-07)', () => {
  const ONTEM = '2026-03-09T17:00:00.000Z';

  it('mostra só a conversa de hoje', async () => {
    __semearColecao(CHAT, [
      mensagemEm('velha', 'combinado de ontem', ONTEM),
      mensagemEm('nova', 'bom dia de hoje', TARDE),
    ]);

    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();

    await waitFor(() => expect(falas()).toEqual(['bom dia de hoje']));
  });

  it('a conversa de ontem continua NO BANCO — nada é apagado', async () => {
    __semearColecao(CHAT, [mensagemEm('velha', 'combinado de ontem', ONTEM)]);

    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();

    await waitFor(() => expect(falas()).toEqual([]));
    expect(__documentosDe(CHAT)).toHaveLength(1);
  });

  it('dá para ver o histórico quando alguém precisa dele', async () => {
    __semearColecao(CHAT, [
      mensagemEm('velha', 'combinado de ontem', ONTEM),
      mensagemEm('nova', 'bom dia de hoje', TARDE),
    ]);
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();
    await waitFor(() => expect(falas()).toEqual(['bom dia de hoje']));

    await userEvent.click(screen.getByRole('button', { name: /dias anteriores/i }));

    await waitFor(() => expect(falas()).toEqual(['combinado de ontem', 'bom dia de hoje']));
  });

  it('a mensagem em voo, sem horário ainda, não some da tela', async () => {
    // `horario` é `null` até o servidor carimbar. Tratar isso como "não é de
    // hoje" faria a própria mensagem recém-enviada piscar e sumir.
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();

    await userEvent.type(campo(), 'acabei de mandar{Enter}');

    await waitFor(() => expect(falas()).toEqual(['acabei de mandar']));
  });

  it('a virada da meia-noite esvazia a TELA e não o banco', async () => {
    // O caso que documenta a troca. Na v0.7.0 este mesmo avanço de relógio
    // disparava `deleteDoc` em cada mensagem da conversa, e o histórico da
    // turma sumia para sempre. Aqui ele só troca o dia do filtro.
    const relogio = fixarRelogio(TARDE);
    __semearColecao(CHAT, [mensagemEm('m1', 'conversa da tarde', TARDE)]);

    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();
    await waitFor(() => expect(falas()).toEqual(['conversa da tarde']));

    // 14:00 em Brasília -> faltam 10 horas para a meia-noite de lá.
    await act(async () => {
      relogio.avancar(10 * 3600000 + 1000);
    });

    await waitFor(() => expect(falas()).toEqual([]));
    expect(__documentosDe(CHAT)).toHaveLength(1);
  });
});

describe('Chat — listeners (AC-PERF-04)', () => {
  it('não deixa listener para trás ao desmontar', async () => {
    const { unmount } = renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();
    await waitFor(() => expect(__ouvintesAtivos()).toBeGreaterThan(0));

    unmount();

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('fechar o painel solta o listener da conversa', async () => {
    renderComProvedores(<Chat salaId={SALA} />);
    await abrirChat();
    await waitFor(() => expect(__ouvintesAtivos()).toBeGreaterThan(0));

    await userEvent.click(screen.getByRole('button', { name: /fechar o chat/i }));

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('o chat fechado não escuta nada — ninguém paga leitura por um painel fechado', () => {
    renderComProvedores(<Chat salaId={SALA} />);

    expect(__ouvintesAtivos()).toBe(0);
  });
});

describe('Chat — sala arquivada (AC-SALA-10)', () => {
  it('deixa ler e não deixa escrever', async () => {
    __semearColecao(CHAT, [mensagemEm('m1', 'conversa da turma', TARDE)]);

    renderComProvedores(<Chat salaId={SALA} somenteLeitura />);
    await abrirChat();

    await waitFor(() => expect(falas()).toEqual(['conversa da turma']));
    expect(campo()).toBeDisabled();
  });
});
