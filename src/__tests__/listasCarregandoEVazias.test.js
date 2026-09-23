// Nenhuma lista mente sobre o próprio vazio — AC-ANIM-04, AC-CHAMADO-10.
//
// `FilaDeChamados` já distingue os quatro estados de uma lista lida do banco:
// carregando, vazia, com erro e cheia. As outras duas listas do app — as salas
// da pessoa e as conversas diretas — ainda tratam os dois primeiros como um
// só, e o efeito é sempre o mesmo e sempre invisível em desenvolvimento:
//
//   * a lista de salas diz *"Você ainda não está em nenhuma sala. Peça o PIN
//     ao professor"* no instante entre o render e o primeiro snapshot. Numa
//     máquina de desenvolvimento esse instante é um quadro; no wi-fi do
//     laboratório com quarenta pessoas é meio segundo, e é a primeira coisa
//     que o aluno lê ao abrir o app. Ele vai pedir o PIN de uma sala em que
//     já está;
//   * a lista de conversas diz *"Nenhuma conversa por aqui ainda"* enquanto
//     as conversas carregam — e quem abriu a aba justamente para retomar uma
//     conversa conclui que ela sumiu.
//
// A regra que este arquivo fixa é uma só: **enquanto não se sabe, não se
// afirma**. Antes do primeiro snapshot a lista mostra esqueleto; a frase
// sobre o vazio só aparece depois que o banco respondeu "não há nada".
//
// O esqueleto usa as classes de `styles/animacoes.css`, que é onde o
// `prefers-reduced-motion` global desliga o brilho de uma vez (AC-ANIM-05).
import React from 'react';
import { screen } from '@testing-library/react';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __definirRelogioDoServidor,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import MinhasSalas from '../components/MinhasSalas';
import ListaConversas from '../components/chat/ListaConversas';
import { PAPEL_DE_ALUNO } from '../services/salas';
import { renderComProvedores } from '../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };

const AGORA = '2026-09-23T12:00:00.000Z';

/**
 * As barras cinzas na tela, buscadas por classe.
 *
 * Não há papel ARIA para "esqueleto" — e não há de propósito: ele é
 * `aria-hidden`, porque não é conteúdo. Quem anuncia a espera é o
 * `role="status"` ao lado, e esse tem teste próprio logo abaixo.
 */
function esqueletos() {
  return document.querySelectorAll('.esqueleto');
}

/** O texto que só pode aparecer depois de o banco dizer que não há sala. */
const VAZIO_DE_SALAS = /não está em nenhuma sala/i;

/** Idem, para as conversas diretas. */
const VAZIO_DE_CONVERSAS = /nenhuma conversa por aqui ainda/i;

function semearSala() {
  __semearColecao('salas', [
    {
      id: 'sala-a',
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
      professorUid: CARLOS.uid,
      professorNome: 'Carlos Lima',
      ativa: true,
      criadaEm: Timestamp.fromDate(new Date('2026-02-01T12:00:00.000Z')),
    },
  ]);

  __semearColecao(`usuarios/${ANA.uid}/salas`, [
    { id: 'sala-a', salaId: 'sala-a', papel: PAPEL_DE_ALUNO },
  ]);
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(AGORA);
});

describe('a lista de salas (AC-ANIM-04, AC-CHAMADO-10)', () => {
  it('mostra esqueleto, e NÃO o vazio, antes do primeiro snapshot', () => {
    __definirUsuarioAtual(ANA);
    semearSala();

    renderComProvedores(<MinhasSalas />, { rota: '/salas' });

    expect(screen.queryByText(VAZIO_DE_SALAS)).not.toBeInTheDocument();
    expect(esqueletos()).not.toHaveLength(0);
  });

  it('anuncia a espera a quem usa leitor de tela', () => {
    __definirUsuarioAtual(ANA);
    semearSala();

    renderComProvedores(<MinhasSalas />, { rota: '/salas' });

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });

  it('o esqueleto some quando as salas chegam', async () => {
    __definirUsuarioAtual(ANA);
    semearSala();

    renderComProvedores(<MinhasSalas />, { rota: '/salas' });

    await screen.findByText('Mecânica 2º ano');

    expect(esqueletos()).toHaveLength(0);
    expect(screen.queryByText(VAZIO_DE_SALAS)).not.toBeInTheDocument();
  });

  it('o vazio aparece depois que o banco responde que não há sala nenhuma', async () => {
    __definirUsuarioAtual(ANA);

    renderComProvedores(<MinhasSalas />, { rota: '/salas' });

    await screen.findByText(VAZIO_DE_SALAS);

    expect(esqueletos()).toHaveLength(0);
  });

  it('o vazio diz qual é a próxima ação, e não só que está vazio', async () => {
    __definirUsuarioAtual(ANA);

    renderComProvedores(<MinhasSalas />, { rota: '/salas' });

    expect(await screen.findByText(/peça o pin ao professor/i)).toBeInTheDocument();
  });
});

describe('a lista de conversas diretas (AC-ANIM-04, AC-DM-06)', () => {
  it('mostra esqueleto, e NÃO o vazio, enquanto carrega', () => {
    renderComProvedores(<ListaConversas uid={ANA.uid} conversas={[]} carregando />);

    expect(screen.queryByText(VAZIO_DE_CONVERSAS)).not.toBeInTheDocument();
    expect(esqueletos()).not.toHaveLength(0);
  });

  it('o vazio só aparece quando já se sabe que não há conversa', () => {
    renderComProvedores(<ListaConversas uid={ANA.uid} conversas={[]} />);

    expect(screen.getByText(VAZIO_DE_CONVERSAS)).toBeInTheDocument();
  });

  it('com conversas na mão, não mostra esqueleto nem vazio', async () => {
    renderComProvedores(
      <ListaConversas
        uid={ANA.uid}
        carregando
        conversas={[
          {
            id: 'conversa-1',
            participantes: [ANA.uid, CARLOS.uid],
            participantesNomes: { [CARLOS.uid]: 'Carlos Lima' },
            naoLidas: {},
            ultimaMensagem: { texto: 'Bom dia', horario: new Date(AGORA) },
          },
        ]}
      />
    );

    expect(await screen.findByText('Carlos Lima')).toBeInTheDocument();

    expect(esqueletos()).toHaveLength(0);
    expect(screen.queryByText(VAZIO_DE_CONVERSAS)).not.toBeInTheDocument();
  });
});
