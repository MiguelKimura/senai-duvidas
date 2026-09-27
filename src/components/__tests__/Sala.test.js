// A porta da sala — AC-SALA-07, AC-SALA-09, AC-SALA-10, AC-SEC-02.
//
// Quem decide qual tela abrir aqui **não** é o papel global da pessoa. Ser
// professor no SENAI não é ser professor desta sala: o papel que vale é o do
// vínculo `salas/{salaId}/membros/{uid}`, que é também o que as rules
// consultam. Um professor que digite na barra de endereços a URL da sala de um
// colega não entra — e é este arquivo que prova isso do lado do cliente, com o
// lado do servidor provado em `tests/rules/salas.rules.test.js`.
import React from 'react';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
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
import Sala from '../Sala';
import { ROTULO_DO_NOVO_CHAMADO } from '../TelaAluno';
import { renderComProvedores } from '../../test-utils';

const mockNavegar = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavegar,
  useParams: () => ({ salaId: 'sala-mecanica' }),
}));

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };
const OUTRO_PROFESSOR = {
  uid: 'uid-marta',
  email: 'marta@senai.br',
  displayName: 'Marta Reis',
};
const HORARIO_DO_SERVIDOR = '2026-03-10T13:45:00.000Z';

function semearProfessoresNoAuth() {
  __semearColecao('usuarios', [
    {
      id: CARLOS.uid,
      uid: CARLOS.uid,
      nome: 'Carlos Lima',
      email: CARLOS.email,
      tipo: 'professor',
    },
    {
      id: OUTRO_PROFESSOR.uid,
      uid: OUTRO_PROFESSOR.uid,
      nome: 'Marta Reis',
      email: OUTRO_PROFESSOR.email,
      tipo: 'professor',
    },
  ]);
  __semearColecao('autorizados', [
    { id: CARLOS.email, Tipo: 'professor' },
    { id: OUTRO_PROFESSOR.email, Tipo: 'professor' },
  ]);
}

/** A sala do Carlos, com Ana dentro e um chamado aberto. */
function semearSala({ ativa = true, comAna = true } = {}) {
  __semearColecao('salas', [
    {
      id: 'sala-mecanica',
      nome: 'Mecânica 2º ano',
      curso: 'Mecânica — Turma B',
      anoLetivo: 2026,
      professorUid: CARLOS.uid,
      professorNome: 'Carlos Lima',
      ativa,
      arquivadaEm: null,
    },
  ]);

  __semearColecao('salas/sala-mecanica/membros', [
    { id: CARLOS.uid, nome: 'Carlos Lima', email: CARLOS.email, papel: 'professor' },
    ...(comAna ? [{ id: ANA.uid, nome: 'Ana Souza', email: ANA.email, papel: 'aluno' }] : []),
  ]);

  __semearColecao('salas/sala-mecanica/chamados', [
    {
      id: 'c1',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      nome: 'Ana Souza',
      email: ANA.email,
      descricao: 'O torno travou.',
      horario: '2026-03-10T13:00:00.000Z',
      horarioIso: '2026-03-10T13:00:00.000Z',
      atendido: false,
    },
  ]);
}

beforeEach(() => {
  mockNavegar.mockClear();
  __resetarAuth();
  __resetarFirestore();
  __definirRelogioDoServidor(HORARIO_DO_SERVIDOR);
});

describe('Sala — qual tela abre (AC-SALA-07)', () => {
  it('o aluno membro vê a tela do aluno, com a fila da sala', async () => {
    semearSala();
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Sala />);

    expect(await screen.findByRole('heading', { name: /bem-vindo/i })).toBeInTheDocument();
    expect(await screen.findByText('O torno travou.')).toBeInTheDocument();
  });

  it('o professor dono vê a tela do professor, com a mesma fila', async () => {
    semearProfessoresNoAuth();
    semearSala();
    __definirUsuarioAtual(CARLOS);

    renderComProvedores(<Sala />);

    expect(
      await screen.findByRole('heading', { name: 'Chamados dos Alunos' })
    ).toBeInTheDocument();
    expect(await screen.findByText('O torno travou.')).toBeInTheDocument();
  });

  it('mostra o nome da sala em que a pessoa está', async () => {
    semearSala();
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Sala />);

    expect(await screen.findByText(/Mecânica 2º ano/)).toBeInTheDocument();
  });
});

describe('Sala — quem não é da sala não entra (AC-SEC-02)', () => {
  it('professor de OUTRA sala não vê os chamados desta, mesmo com a URL na mão', async () => {
    semearProfessoresNoAuth();
    semearSala();
    __definirUsuarioAtual(OUTRO_PROFESSOR);

    renderComProvedores(<Sala />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não faz parte desta sala/i);
    expect(screen.queryByText('O torno travou.')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Chamados dos Alunos' })
    ).not.toBeInTheDocument();
  });

  it('aluno removido da sala perde o acesso na próxima abertura (AC-SALA-09)', async () => {
    semearSala({ comAna: false });
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Sala />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/não faz parte desta sala/i);
    expect(screen.queryByText('O torno travou.')).not.toBeInTheDocument();
  });

  it('a recusa não conta nada sobre a sala além de que ela não é dele', async () => {
    semearProfessoresNoAuth();
    semearSala();
    __definirUsuarioAtual(OUTRO_PROFESSOR);

    renderComProvedores(<Sala />);

    await screen.findByRole('alert');
    expect(screen.queryByText(/Mecânica 2º ano/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Carlos Lima/)).not.toBeInTheDocument();
  });
});

/** Desde a v1.1.0 o painel da turma mora numa aba própria. */
async function abrirTurma() {
  fireEvent.click(await screen.findByRole('tab', { name: 'Turma' }));

  return screen.findByRole('region', { name: /turma/i });
}

describe('Sala — o painel da turma (AC-SALA-09)', () => {
  beforeEach(() => {
    semearProfessoresNoAuth();
    semearSala();
    __definirUsuarioAtual(CARLOS);
  });

  it('lista os membros da sala para o dono', async () => {
    renderComProvedores(<Sala />);

    const painel = await abrirTurma();
    expect(await within(painel).findByText('Ana Souza')).toBeInTheDocument();
  });

  it('remover um aluno apaga o vínculo e gera um PIN novo no mesmo gesto', async () => {
    renderComProvedores(<Sala />);
    const painel = await abrirTurma();

    await userEvent.click(
      await within(painel).findByRole('button', { name: /remover ana souza/i })
    );
    __confirmarCarimbos();

    await waitFor(() =>
      expect(__documentosDe('salas/sala-mecanica/membros').map(({ id }) => id)).toEqual([
        CARLOS.uid,
      ])
    );
    // Sem o PIN novo, o aluno removido voltaria em dez segundos com o número
    // que anotou no caderno.
    expect(await screen.findByTestId('pin-em-destaque')).toHaveTextContent(/^\d{6}$/);
  });

  it('não oferece remover o próprio professor da sala', async () => {
    renderComProvedores(<Sala />);
    const painel = await abrirTurma();

    await within(painel).findByText('Carlos Lima');
    expect(within(painel).queryByRole('button', { name: /remover carlos lima/i })).toBeNull();
  });

  it('o aluno não vê o painel da turma', async () => {
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Sala />);

    await screen.findByRole('heading', { name: /bem-vindo/i });
    expect(screen.queryByRole('region', { name: /turma/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Turma' })).not.toBeInTheDocument();
  });
});

describe('Sala — arquivada é somente leitura (AC-SALA-10)', () => {
  it('avisa que a sala está arquivada', async () => {
    semearSala({ ativa: false });
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Sala />);

    expect(await screen.findByText(/arquivada/i)).toBeInTheDocument();
  });

  it('o aluno não consegue abrir um chamado novo numa sala arquivada', async () => {
    semearSala({ ativa: false });
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Sala />);
    await screen.findByText(/arquivada/i);

    expect(
      screen.queryByRole('button', { name: ROTULO_DO_NOVO_CHAMADO })
    ).not.toBeInTheDocument();
  });

  it('mas continua mostrando o que já foi escrito: arquivar não é apagar', async () => {
    semearSala({ ativa: false });
    __definirUsuarioAtual(ANA);

    renderComProvedores(<Sala />);

    expect(await screen.findByText('O torno travou.')).toBeInTheDocument();
  });
});

describe('Sala — higiene de listeners (AC-PERF-04)', () => {
  it('cancela tudo ao desmontar', async () => {
    semearSala();
    __definirUsuarioAtual(ANA);

    const { unmount } = renderComProvedores(<Sala />);
    await screen.findByText('O torno travou.');

    unmount();

    await waitFor(() => expect(__ouvintesAtivos()).toBe(0));
  });
});

describe('trocar de sala sem voltar à lista (v1.1.0)', () => {
  /** O Carlos com duas salas: a de mecânica e a de elétrica. */
  function semearDuasSalasDoCarlos() {
    semearProfessoresNoAuth();
    semearSala();
    __semearColecao('salas', [
      {
        id: 'sala-mecanica',
        nome: 'Mecânica 2º ano',
        curso: 'Mecânica — Turma B',
        anoLetivo: 2026,
        professorUid: CARLOS.uid,
        professorNome: 'Carlos Lima',
        ativa: true,
        arquivadaEm: null,
      },
      {
        id: 'sala-eletrica',
        nome: 'Elétrica 1º ano',
        curso: 'Elétrica — Turma A',
        anoLetivo: 2026,
        professorUid: CARLOS.uid,
        professorNome: 'Carlos Lima',
        ativa: true,
        arquivadaEm: null,
      },
    ]);
    __semearColecao('salas/sala-eletrica/membros', [
      { id: CARLOS.uid, nome: 'Carlos Lima', email: CARLOS.email, papel: 'professor' },
    ]);
    __semearColecao(`usuarios/${CARLOS.uid}/salas`, [
      { id: 'sala-mecanica', salaId: 'sala-mecanica', papel: 'professor' },
      { id: 'sala-eletrica', salaId: 'sala-eletrica', papel: 'professor' },
    ]);
  }

  it('o seletor lista as salas da pessoa, com a atual escolhida', async () => {
    semearDuasSalasDoCarlos();
    __definirUsuarioAtual(CARLOS);

    renderComProvedores(<Sala />);

    const seletor = await screen.findByRole('combobox', { name: 'Trocar de sala' });

    await waitFor(() =>
      expect(
        within(seletor).getByRole('option', { name: /Elétrica 1º ano/ })
      ).toBeInTheDocument()
    );
    expect(seletor).toHaveValue('sala-mecanica');
  });

  it('escolher outra sala abre essa sala', async () => {
    semearDuasSalasDoCarlos();
    __definirUsuarioAtual(CARLOS);
    renderComProvedores(<Sala />);

    const seletor = await screen.findByRole('combobox', { name: 'Trocar de sala' });
    await within(seletor).findByRole('option', { name: /Elétrica 1º ano/ });

    fireEvent.change(seletor, { target: { value: 'sala-eletrica' } });

    expect(mockNavegar).toHaveBeenCalledWith('/sala/sala-eletrica');
  });

  it('há sempre um caminho de volta para "Minhas salas"', async () => {
    semearSala();
    __definirUsuarioAtual(ANA);
    renderComProvedores(<Sala />);

    await userEvent.click(await screen.findByRole('button', { name: 'Minhas salas' }));

    expect(mockNavegar).toHaveBeenCalledWith('/salas');
  });
});

describe('o PIN sempre à vista para o dono da sala (v1.1.0)', () => {
  it('mostra o PIN guardado da sala', async () => {
    semearProfessoresNoAuth();
    semearSala();
    __semearColecao('salas/sala-mecanica/segredo', [
      { id: 'pin', hash: 'x'.repeat(64), sal: 'y'.repeat(16), pin: '123456' },
    ]);
    __definirUsuarioAtual(CARLOS);

    renderComProvedores(<Sala />);

    const selo = await screen.findByRole('region', { name: 'PIN da sala' });
    expect(await within(selo).findByText('123456')).toBeInTheDocument();
  });

  it('sala criada antes da v1.1.0, sem PIN guardado, oferece gerar um novo', async () => {
    semearProfessoresNoAuth();
    semearSala();
    __semearColecao('salas/sala-mecanica/segredo', [
      { id: 'pin', hash: 'x'.repeat(64), sal: 'y'.repeat(16) },
    ]);
    __definirUsuarioAtual(CARLOS);
    renderComProvedores(<Sala />);

    const selo = await screen.findByRole('region', { name: 'PIN da sala' });
    // O botão aparece quando a leitura do PIN guardado termina.
    await userEvent.click(await within(selo).findByRole('button', { name: 'Gerar novo PIN' }));

    // Gerar é uma sequência de leituras e escritas (índice, segredo, sala):
    // com a suíte inteira rodando em paralelo, o segundo padrão não basta.
    await waitFor(() => expect(within(selo).getByText(/^\d{6}$/)).toBeInTheDocument(), {
      timeout: 5000,
    });
    // O PIN novo fica guardado, para aparecer de novo na próxima vez.
    expect(__documentosDe('salas/sala-mecanica/segredo')[0].pin).toMatch(/^\d{6}$/);
  });

  it('o aluno não vê o PIN', async () => {
    semearSala();
    __definirUsuarioAtual(ANA);
    renderComProvedores(<Sala />);

    await screen.findByRole('heading', { name: /bem-vindo/i });
    expect(screen.queryByRole('region', { name: 'PIN da sala' })).toBeNull();
  });
});
