// A aba das mensagens diretas — AC-DM-01, AC-DM-02, AC-DM-03, AC-DM-05.
//
// Aqui a interface encontra o serviço. O que se prova é o fluxo inteiro: quem
// aparece na lista de "com quem posso falar", que a conversa aberta pelos dois
// lados é a mesma, que abrir zera o contador e que o listener some no unmount.
//
// O que NÃO se prova aqui é privacidade. Esconder a conversa de terceiros é
// trabalho da Security Rule, e está em `tests/rules/conversas.rules.test.js`.
// Um teste de interface que "não mostra" a conversa dos outros passaria
// alegremente com o banco aberto para todo mundo.
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  __documentosDe,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import AbaDiretas from '../AbaDiretas';
import { idDaConversa } from '../../../services/chat';
import { PAPEL_DE_ALUNO, PAPEL_DE_PROFESSOR } from '../../../services/salas';
import { renderComProvedores } from '../../../test-utils';

const SALA = 'sala-a';
const MEMBROS = `salas/${SALA}/membros`;
const CONVERSAS = `salas/${SALA}/conversas`;

const ANA = { uid: 'uid-ana', nome: 'Ana Souza', papel: PAPEL_DE_ALUNO };
const BRUNO = { uid: 'uid-bruno', nome: 'Bruno Dias', papel: PAPEL_DE_ALUNO };
const CARLOS = { uid: 'uid-carlos', nome: 'Carlos Lima', papel: PAPEL_DE_PROFESSOR };

/** A turma: um professor e dois alunos. */
function semearTurma() {
  __semearColecao(
    MEMBROS,
    [CARLOS, ANA, BRUNO].map((pessoa) => ({
      id: pessoa.uid,
      nome: pessoa.nome,
      email: `${pessoa.uid}@senai.br`,
      papel: pessoa.papel,
    }))
  );
}

function abrirNovaConversa() {
  return userEvent.click(screen.getByRole('button', { name: /nova conversa/i }));
}

beforeEach(() => {
  __resetarFirestore();
  semearTurma();
});

describe('AbaDiretas — com quem dá para falar', () => {
  it('o professor vê os alunos da sala (AC-DM-02)', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} />);

    await abrirNovaConversa();

    expect(await screen.findByRole('button', { name: 'Ana Souza' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bruno Dias' })).toBeInTheDocument();
  });

  it('o aluno vê o professor da sala (AC-DM-03)', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={ANA} />);

    await abrirNovaConversa();

    expect(await screen.findByRole('button', { name: 'Carlos Lima' })).toBeInTheDocument();
  });

  it('o aluno NÃO vê os colegas: aluno↔aluno é o AC-DM-07, de outra versão', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={ANA} />);

    await abrirNovaConversa();

    await screen.findByRole('button', { name: 'Carlos Lima' });
    expect(screen.queryByRole('button', { name: 'Bruno Dias' })).not.toBeInTheDocument();
  });

  it('ninguém aparece como opção de conversar consigo mesmo', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} />);

    await abrirNovaConversa();

    await screen.findByRole('button', { name: 'Ana Souza' });
    expect(screen.queryByRole('button', { name: 'Carlos Lima' })).not.toBeInTheDocument();
  });
});

describe('AbaDiretas — abrir e conversar', () => {
  it('abre a conversa com o id determinístico dos dois uids', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} />);
    await abrirNovaConversa();

    await userEvent.click(await screen.findByRole('button', { name: 'Ana Souza' }));

    await waitFor(() => expect(__documentosDe(CONVERSAS)).toHaveLength(1));
    expect(__documentosDe(CONVERSAS)[0].id).toBe(idDaConversa(CARLOS.uid, ANA.uid));
  });

  it('os dois lados chegam à MESMA conversa', async () => {
    const view = renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} />);
    await abrirNovaConversa();
    await userEvent.click(await screen.findByRole('button', { name: 'Ana Souza' }));
    await waitFor(() => expect(__documentosDe(CONVERSAS)).toHaveLength(1));
    view.unmount();

    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={ANA} />);
    await abrirNovaConversa();
    await userEvent.click(await screen.findByRole('button', { name: 'Carlos Lima' }));

    await waitFor(() => expect(__documentosDe(CONVERSAS)).toHaveLength(1));
  });

  it('envia mensagem dentro da conversa aberta', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} />);
    await abrirNovaConversa();
    await userEvent.click(await screen.findByRole('button', { name: 'Ana Souza' }));

    await userEvent.type(
      await screen.findByPlaceholderText('Escreva uma mensagem'),
      'Ana, me procure depois da aula{Enter}'
    );

    const conversaId = idDaConversa(CARLOS.uid, ANA.uid);
    await waitFor(() =>
      expect(__documentosDe(`${CONVERSAS}/${conversaId}/mensagens`)).toHaveLength(1)
    );
    expect(__documentosDe(`${CONVERSAS}/${conversaId}/mensagens`)[0].texto).toBe(
      'Ana, me procure depois da aula'
    );
  });

  it('mostra as mensagens da conversa aberta', async () => {
    const conversaId = idDaConversa(CARLOS.uid, ANA.uid);
    __semearColecao(CONVERSAS, [
      {
        id: conversaId,
        participantes: [ANA.uid, CARLOS.uid].sort(),
        participantesNomes: { [ANA.uid]: 'Ana Souza', [CARLOS.uid]: 'Carlos Lima' },
        naoLidas: { [ANA.uid]: 1, [CARLOS.uid]: 0 },
        ultimaMensagem: {
          texto: 'me procure depois da aula',
          autorUid: CARLOS.uid,
          horario: new Date(Date.UTC(2026, 2, 10, 12, 0)),
        },
      },
    ]);
    __semearColecao(`${CONVERSAS}/${conversaId}/mensagens`, [
      {
        id: 'm1',
        autorUid: CARLOS.uid,
        autorNome: 'Carlos Lima',
        texto: 'me procure depois da aula',
        horario: new Date(Date.UTC(2026, 2, 10, 12, 0)),
      },
    ]);

    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={ANA} />);

    await userEvent.click(await screen.findByRole('button', { name: /Carlos Lima/ }));

    expect(await screen.findByText('me procure depois da aula')).toBeInTheDocument();
  });

  it('abrir a conversa zera o contador de quem abriu (AC-DM-05)', async () => {
    const conversaId = idDaConversa(CARLOS.uid, ANA.uid);
    __semearColecao(CONVERSAS, [
      {
        id: conversaId,
        participantes: [ANA.uid, CARLOS.uid].sort(),
        participantesNomes: { [ANA.uid]: 'Ana Souza', [CARLOS.uid]: 'Carlos Lima' },
        naoLidas: { [ANA.uid]: 3, [CARLOS.uid]: 0 },
        ultimaMensagem: {
          texto: 'oi',
          autorUid: CARLOS.uid,
          horario: new Date(Date.UTC(2026, 2, 10, 12, 0)),
        },
      },
    ]);

    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={ANA} />);
    await userEvent.click(await screen.findByRole('button', { name: /Carlos Lima/ }));

    await waitFor(() => expect(__documentosDe(CONVERSAS)[0].naoLidas[ANA.uid]).toBe(0));
    // E não mexe no do outro lado.
    expect(__documentosDe(CONVERSAS)[0].naoLidas[CARLOS.uid]).toBe(0);
  });

  it('dá para voltar da conversa para a lista', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} />);
    await abrirNovaConversa();
    await userEvent.click(await screen.findByRole('button', { name: 'Ana Souza' }));
    await screen.findByPlaceholderText('Escreva uma mensagem');

    await userEvent.click(screen.getByRole('button', { name: /voltar/i }));

    expect(screen.queryByPlaceholderText('Escreva uma mensagem')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /nova conversa/i })).toBeInTheDocument();
  });
});

describe('AbaDiretas — listeners (AC-PERF-04)', () => {
  it('cancela tudo ao desmontar', async () => {
    const { unmount } = renderComProvedores(<AbaDiretas salaId={SALA} pessoa={ANA} />);
    await waitFor(() => expect(__ouvintesAtivos()).toBeGreaterThan(0));

    unmount();

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('abrir e fechar conversas não acumula listener', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} />);
    await waitFor(() => expect(__ouvintesAtivos()).toBeGreaterThan(0));
    const soComALista = __ouvintesAtivos();

    await abrirNovaConversa();
    await userEvent.click(await screen.findByRole('button', { name: 'Ana Souza' }));
    await screen.findByPlaceholderText('Escreva uma mensagem');
    await userEvent.click(screen.getByRole('button', { name: /voltar/i }));

    await waitFor(() => expect(__ouvintesAtivos()).toBe(soComALista));
  });
});

describe('AbaDiretas — sala arquivada (AC-SALA-10)', () => {
  it('deixa ler a conversa e não deixa escrever', async () => {
    renderComProvedores(<AbaDiretas salaId={SALA} pessoa={CARLOS} somenteLeitura />);
    await abrirNovaConversa();
    await userEvent.click(await screen.findByRole('button', { name: 'Ana Souza' }));

    expect(await screen.findByPlaceholderText('Escreva uma mensagem')).toBeDisabled();
  });
});
