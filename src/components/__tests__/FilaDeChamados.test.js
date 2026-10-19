// A fila de chamados: paginação, estado vazio e esqueleto — AC-CHAMADO-09,
// AC-CHAMADO-10, AC-ANIM-02, AC-ANIM-04.
//
// Três buracos que as versões anteriores deixaram e que aparecem justamente
// nos dois piores momentos de uma aula:
//
//   1. **os 200 cards.** O alvo declarado do projeto é 200 chamados por sala,
//      e as duas telas desenhavam os 200 de uma vez. Nas máquinas do
//      laboratório isso é meio segundo de tela travada a cada snapshot — e o
//      `onSnapshot` reemite a cada chamado novo da turma (AC-CHAMADO-09);
//   2. **a tela branca.** Sala sem chamado nenhum — que é toda sala no começo
//      de cada aula — mostrava uma área vazia, indistinguível de erro de
//      carregamento (AC-CHAMADO-10);
//   3. **o "carregando" que não existia.** Entre montar a tela e o primeiro
//      snapshot chegar, a fila aparecia vazia e depois se preenchia. O aluno
//      via "nenhuma dúvida" por um instante e podia abrir a dúvida duas vezes
//      (AC-ANIM-04).
import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __definirRelogioDoServidor,
  __recusarLeituraEm,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import FilaDeChamados, { CHAMADOS_POR_PAGINA } from '../FilaDeChamados';
import TelaAluno from '../TelaAluno';
import TelaProfessor from '../TelaProfessor';
import { renderComProvedores } from '../../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

/** `quantos` chamados prontos para semear, do mais antigo para o mais novo. */
function chamados(quantos) {
  return Array.from({ length: quantos }, (_, indice) => ({
    id: `c${indice}`,
    autorNome: `Aluno ${indice}`,
    descricao: `dúvida ${indice}`,
  }));
}

/** O componente sob teste, com o card mais simples que serve. */
function montar(props = {}) {
  return render(
    <FilaDeChamados
      chamados={[]}
      carregando={false}
      renderizarCard={(chamado) => (
        <div className="problema-card" key={chamado.id}>
          {chamado.descricao}
        </div>
      )}
      {...props}
    />
  );
}

/** Os cards realmente no DOM. */
function cardsNaTela() {
  return document.querySelectorAll('.problema-card');
}

describe('paginação de 30 em 30 (AC-CHAMADO-09)', () => {
  it('desenha só a primeira página quando há mais do que cabe nela', () => {
    montar({ chamados: chamados(200) });

    expect(cardsNaTela()).toHaveLength(CHAMADOS_POR_PAGINA);
  });

  it('desenha tudo quando cabe numa página só', () => {
    montar({ chamados: chamados(7) });

    expect(cardsNaTela()).toHaveLength(7);
  });

  it('oferece "carregar mais" e diz quantos faltam', () => {
    montar({ chamados: chamados(200) });

    expect(
      screen.getByRole('button', { name: new RegExp(`${200 - CHAMADOS_POR_PAGINA}`) })
    ).toBeInTheDocument();
  });

  it('carregar mais acrescenta uma página, e não a lista inteira', async () => {
    montar({ chamados: chamados(200) });

    await userEvent.click(screen.getByRole('button', { name: /carregar mais/i }));

    expect(cardsNaTela()).toHaveLength(CHAMADOS_POR_PAGINA * 2);
  });

  it('o botão some quando a última página entra', async () => {
    montar({ chamados: chamados(CHAMADOS_POR_PAGINA + 1) });

    await userEvent.click(screen.getByRole('button', { name: /carregar mais/i }));

    expect(screen.queryByRole('button', { name: /carregar mais/i })).toBeNull();
    expect(cardsNaTela()).toHaveLength(CHAMADOS_POR_PAGINA + 1);
  });

  it('não oferece paginação quando não há o que paginar', () => {
    montar({ chamados: chamados(3) });

    expect(screen.queryByRole('button', { name: /carregar mais/i })).toBeNull();
  });

  it('preserva a página aberta quando a fila muda embaixo dela', async () => {
    // O `onSnapshot` reemite a cada chamado novo da turma. Voltar para a
    // primeira página a cada reemissão jogaria o professor de volta ao topo no
    // meio da fila, várias vezes por aula.
    const { rerender } = montar({ chamados: chamados(200) });
    await userEvent.click(screen.getByRole('button', { name: /carregar mais/i }));

    rerender(
      <FilaDeChamados
        chamados={chamados(201)}
        carregando={false}
        renderizarCard={(chamado) => (
          <div className="problema-card" key={chamado.id}>
            {chamado.descricao}
          </div>
        )}
      />
    );

    expect(cardsNaTela()).toHaveLength(CHAMADOS_POR_PAGINA * 2);
  });

  it('200 chamados na mesma sala cabem no orçamento de tempo', () => {
    // O orçamento: 1500ms para montar a fila de 200 numa máquina de CI, que é
    // ordens de grandeza mais lenta do que o navegador do laboratório e roda
    // com outras suítes em paralelo. O número que **realmente** protege o
    // AC-CHAMADO-09 é o de cards no DOM, logo abaixo: ele não depende de
    // quanto a máquina estava ocupada, e é ele que quebra se alguém remover a
    // paginação.
    const inicio = Date.now();
    montar({ chamados: chamados(200) });
    const gasto = Date.now() - inicio;

    expect(cardsNaTela()).toHaveLength(CHAMADOS_POR_PAGINA);
    expect(gasto).toBeLessThan(1500);
  });
});

describe('estado vazio (AC-CHAMADO-10)', () => {
  it('explica o vazio em vez de deixar a área em branco', () => {
    montar({ chamados: [] });

    expect(screen.getByText(/Nenhuma dúvida por aqui ainda/i)).toBeInTheDocument();
  });

  it('diz qual é a próxima ação, e não só que está vazio', () => {
    montar({ chamados: [] });

    expect(screen.getByRole('status')).toHaveTextContent(/[+]|abrir/i);
  });

  it('aceita uma mensagem própria — a tela do professor não abre chamado', () => {
    montar({ chamados: [], textoVazio: 'A turma ainda não abriu nenhuma dúvida hoje.' });

    expect(
      screen.getByText('A turma ainda não abriu nenhuma dúvida hoje.')
    ).toBeInTheDocument();
  });

  it('não mostra o vazio enquanto ainda está carregando', () => {
    montar({ chamados: [], carregando: true });

    expect(screen.queryByText(/Nenhuma dúvida por aqui ainda/i)).toBeNull();
  });
});

describe('esqueleto de carregamento (AC-ANIM-04)', () => {
  it('desenha o esqueleto enquanto o primeiro snapshot não chega', () => {
    montar({ chamados: [], carregando: true });

    expect(document.querySelectorAll('.esqueleto').length).toBeGreaterThan(0);
  });

  it('anuncia a espera a quem usa leitor de tela', () => {
    montar({ chamados: [], carregando: true });

    expect(screen.getByRole('status')).toHaveTextContent(/carregando/i);
  });

  it('o esqueleto some quando os dados chegam', () => {
    montar({ chamados: chamados(2), carregando: false });

    expect(document.querySelectorAll('.esqueleto')).toHaveLength(0);
  });

  it('não desenha esqueleto por cima de uma fila que já tem conteúdo', () => {
    // A reemissão do `onSnapshot` não é um carregamento inicial: trocar a fila
    // cheia por barras cinzas a cada chamado novo da turma piscaria a tela.
    montar({ chamados: chamados(3), carregando: true });

    expect(document.querySelectorAll('.esqueleto')).toHaveLength(0);
    expect(cardsNaTela()).toHaveLength(3);
  });
});

describe('erro de leitura (AC-ANIM-04)', () => {
  it('mostra o erro com "tentar novamente" quando a leitura falha', async () => {
    const tentarNovamente = jest.fn();
    montar({ chamados: [], erro: 'Não foi possível carregar a fila.', tentarNovamente });

    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(tentarNovamente).toHaveBeenCalledTimes(1);
  });

  it('o erro tem prioridade sobre o estado vazio — são coisas diferentes', () => {
    montar({ chamados: [], erro: 'Não foi possível carregar a fila.' });

    expect(screen.queryByText(/Nenhuma dúvida por aqui ainda/i)).toBeNull();
    expect(
      within(screen.getByRole('alert')).getByText(/Não foi possível carregar/)
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// A fila montada pelas telas de verdade. Os casos acima provam a casca
// isolada; estes provam que as duas telas a ligaram nos estados certos.

describe('a fila nas telas de verdade (AC-ANIM-04, AC-CHAMADO-09)', () => {
  const SALA = 'sala-a';
  const CHAMADOS = `salas/${SALA}/chamados`;
  const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };

  beforeEach(() => {
    __resetarAuth();
    __resetarFirestore();
    __definirRelogioDoServidor('2026-09-23T12:00:00.000Z');
    __definirUsuarioAtual(ANA);
  });

  it('a recusa do servidor vira erro com "tentar novamente", e não fila vazia', async () => {
    // "Não deu para ler" e "não há dúvida nenhuma" são coisas diferentes. Até
    // a v0.9.0 as duas produziam a mesma área vazia, e o aluno não tinha como
    // saber que devia recarregar (AC-ANIM-04).
    __recusarLeituraEm(CHAMADOS);

    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/Não foi possível carregar/);
    expect(screen.queryByText(/Nenhuma dúvida por aqui ainda/i)).toBeNull();
  });

  it('"tentar novamente" refaz a inscrição e a fila carrega', async () => {
    __recusarLeituraEm(CHAMADOS);
    __semearColecao(CHAMADOS, [
      {
        id: 'c1',
        autorUid: ANA.uid,
        autorNome: 'Ana Souza',
        email: ANA.email,
        descricao: 'o VS Code não abre',
        horario: Timestamp.fromDate(new Date('2026-09-23T10:00:00.000Z')),
        atendido: false,
      },
    ]);

    renderComProvedores(<TelaAluno salaId={SALA} />);
    await screen.findByRole('alert');

    await userEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(await screen.findByText('o VS Code não abre')).toBeInTheDocument();
  });

  it('sala sem chamado nenhum explica o vazio (AC-CHAMADO-10)', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(await screen.findByText(/Nenhuma dúvida por aqui ainda/i)).toBeInTheDocument();
  });

  it('a tela do professor diz que a turma não chamou, e não "toque no +"', async () => {
    renderComProvedores(<TelaProfessor salaId={SALA} />);

    expect(await screen.findByText(/A turma ainda não chamou/i)).toBeInTheDocument();
  });

  it('200 chamados na sala desenham 30 cards, e não 200 (AC-CHAMADO-09)', async () => {
    __semearColecao(
      CHAMADOS,
      Array.from({ length: 200 }, (_, indice) => ({
        id: `c${indice}`,
        autorUid: ANA.uid,
        autorNome: 'Ana Souza',
        email: ANA.email,
        descricao: `dúvida ${indice}`,
        horario: Timestamp.fromDate(new Date(Date.UTC(2026, 8, 23, 10, indice))),
        horarioIso: new Date(Date.UTC(2026, 8, 23, 10, indice)).toISOString(),
        atendido: false,
      }))
    );

    renderComProvedores(<TelaAluno salaId={SALA} />);

    await waitFor(() => expect(cardsNaTela().length).toBeGreaterThan(0));
    expect(cardsNaTela()).toHaveLength(CHAMADOS_POR_PAGINA);
  });
});
