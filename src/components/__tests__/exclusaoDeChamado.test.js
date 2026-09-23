// A revisão do auto-delete — AC-CHAMADO-04, AC-CHAMADO-05, AC-CHAMADO-06,
// AC-CHAMADO-08, AC-ANIM-02.
//
// O cliente pediu esta revisão com todas as letras: *"auto delete da própria
// dúvida (caso ela já tenha sido resolvida): isso já existe, mas é bom
// revisar"*. O que existia era um botão vermelho que apagava a dúvida e o
// print no primeiro clique, sem perguntar nada e sem volta.
//
// O que esta versão acrescenta, e por quê:
//
//   * **confirmação** (AC-CHAMADO-04). O botão "Excluir" fica logo abaixo do
//     texto do card, e a fila rola: um toque errado no laboratório perdia a
//     dúvida com o print do erro junto;
//   * **desfazer por cinco segundos**. A confirmação protege contra o clique
//     errado; o desfazer protege contra a decisão errada — "resolvi" que
//     virou "não era isso" assim que o card sumiu. A exclusão é otimista: o
//     card sai da fila na hora e a gravação é adiada, então desfazer não
//     precisa recriar documento nenhum;
//   * **animação de saída** (AC-ANIM-02), para o aluno ver qual card saiu;
//   * **marcar como atendido** (AC-CHAMADO-06), que é o que o professor
//     queria quando apagava: tirar o chamado da frente sem perder o histórico.
//
// O que NÃO mudou, e está fixado aqui: quem pode excluir o quê. O botão
// continua aparecendo só para o autor na tela do aluno, e para o professor em
// qualquer card da sala dele. A autorização que vale é a rule —
// `tests/rules/salas.rules.test.js` — e esta tela só traduz.
import React from 'react';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import {
  Timestamp,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __documentosDe,
  __recusarEscritaEm,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import { __arquivosEnviados, __resetarStorage, __semearArquivos } from 'firebase/storage';
import TelaAluno from '../TelaAluno';
import TelaProfessor from '../TelaProfessor';
import { DURACAO_DA_SAIDA_MS, PRAZO_DE_DESFAZER_MS } from '../../hooks/useExclusaoComDesfazer';
import { fixarRelogio, renderComProvedores, restaurarRelogio } from '../../test-utils';

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn(),
}));

const SALA = 'sala-a';
const CHAMADOS = `salas/${SALA}/chamados`;

const AGORA = '2026-09-23T12:00:00.000Z';

const ANA = { uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', email: 'carlos@senai.br', displayName: 'Carlos Lima' };

let relogio;

/** Um chamado da Ana e um do Bruno, os dois abertos. */
function semearDois() {
  __semearColecao(CHAMADOS, [
    {
      id: 'da-ana',
      autorUid: ANA.uid,
      autorNome: 'Ana Souza',
      nome: 'Ana Souza',
      email: ANA.email,
      descricao: 'o VS Code não abre',
      horario: Timestamp.fromDate(new Date('2026-09-23T10:00:00.000Z')),
      atendido: false,
    },
    {
      id: 'do-bruno',
      autorUid: 'uid-bruno',
      autorNome: 'Bruno Alves',
      nome: 'Bruno Alves',
      email: 'bruno@senai.br',
      descricao: 'o cabo de rede caiu',
      horario: Timestamp.fromDate(new Date('2026-09-23T10:05:00.000Z')),
      atendido: false,
    },
  ]);
}

/** O card de um chamado, achado pela descrição. */
function cartaoDe(descricao) {
  return screen.getByText(descricao).closest('.problema-card');
}

/** O botão que confirma, de dentro do diálogo. */
function confirmar(nome = 'Excluir') {
  return within(screen.getByRole('dialog')).getByRole('button', { name: nome });
}

/** Abre a confirmação de exclusão do card indicado. */
async function pedirExclusao(descricao) {
  await userEvent.click(within(cartaoDe(descricao)).getByRole('button', { name: 'Excluir' }));
}

/** Deixa a animação de saída terminar, para o card sair da fila. */
function deixarSair() {
  act(() => relogio.avancar(DURACAO_DA_SAIDA_MS));
}

/**
 * Deixa a janela de desfazer vencer, para a gravação sair do limbo.
 *
 * Avança o prazo inteiro, e não `PRAZO - o que já passou`: o cronômetro do
 * toast nasce no mesmo instante do da animação de saída, então o prazo cheio
 * o cobre de qualquer forma.
 */
function deixarVencer() {
  act(() => relogio.avancar(PRAZO_DE_DESFAZER_MS));
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  __resetarStorage();
  __definirRelogioDoServidor(AGORA);
  relogio = fixarRelogio(AGORA);
  semearDois();
});

afterEach(() => {
  restaurarRelogio();
});

describe('o aluno exclui a própria dúvida, com confirmação (AC-CHAMADO-04)', () => {
  beforeEach(() => __definirUsuarioAtual(ANA));

  it('pergunta antes, nomeando o que vai acontecer', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    await pedirExclusao('o VS Code não abre');

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(within(dialogo).getByText(/print/i)).toBeInTheDocument();
  });

  it('cancelar NÃO exclui — nem da tela, nem do banco', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    await pedirExclusao('o VS Code não abre');
    await userEvent.click(confirmar('Cancelar'));

    deixarVencer();

    expect(screen.getByText('o VS Code não abre')).toBeInTheDocument();
    expect(__documentosDe(CHAMADOS)).toHaveLength(2);
  });

  it('Esc também cancela, e o chamado continua na fila', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    await pedirExclusao('o VS Code não abre');
    await userEvent.keyboard('{Escape}');

    deixarVencer();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(__documentosDe(CHAMADOS)).toHaveLength(2);
  });

  it('confirmar tira o card da fila na hora — sem esperar o servidor', async () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    await pedirExclusao('o VS Code não abre');
    await userEvent.click(confirmar());

    await waitFor(() =>
      expect(screen.queryByText('o VS Code não abre')).not.toBeInTheDocument()
    );

    // A exclusão é otimista: o card saiu, o documento ainda está lá. É o que
    // torna o "Desfazer" barato — não há o que recriar.
    expect(__documentosDe(CHAMADOS)).toHaveLength(2);
  });

  it('o botão de Excluir só aparece no chamado do próprio aluno (AC-CHAMADO-05)', () => {
    renderComProvedores(<TelaAluno salaId={SALA} />);

    expect(
      within(cartaoDe('o VS Code não abre')).getByRole('button', { name: 'Excluir' })
    ).toBeInTheDocument();
    expect(
      within(cartaoDe('o cabo de rede caiu')).queryByRole('button', { name: 'Excluir' })
    ).toBeNull();
  });
});

describe('a janela de desfazer (AC-CHAMADO-04)', () => {
  beforeEach(() => __definirUsuarioAtual(ANA));

  // Sem `waitFor`: com relógio congelado, ele avança os temporizadores em
  // busca da condição e consumiria parte da janela de desfazer — a contagem
  // dos casos abaixo deixaria de ser a do código e passaria a ser a do
  // agendamento do teste.
  async function excluirComConfirmacao() {
    renderComProvedores(<TelaAluno salaId={SALA} />);
    await pedirExclusao('o VS Code não abre');
    await userEvent.click(confirmar());
    deixarSair();

    expect(screen.queryByText('o VS Code não abre')).not.toBeInTheDocument();
  }

  it('oferece "Desfazer" no aviso', async () => {
    await excluirComConfirmacao();

    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('desfazer traz o chamado de volta para a fila', async () => {
    await excluirComConfirmacao();

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(screen.getByText('o VS Code não abre')).toBeInTheDocument();
  });

  it('desfazer não apaga nada, nem depois do prazo passar', async () => {
    await excluirComConfirmacao();
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    deixarVencer();
    deixarVencer();

    expect(__documentosDe(CHAMADOS)).toHaveLength(2);
  });

  it('o prazo vencido é o que finalmente apaga do banco', async () => {
    await excluirComConfirmacao();

    deixarVencer();

    await waitFor(() => expect(__documentosDe(CHAMADOS)).toHaveLength(1));
    expect(__documentosDe(CHAMADOS)[0].id).toBe('do-bruno');
  });

  it('a janela dura cinco segundos, nem um a menos', async () => {
    await excluirComConfirmacao();

    act(() => relogio.avancar(PRAZO_DE_DESFAZER_MS - DURACAO_DA_SAIDA_MS - 1));

    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
    expect(__documentosDe(CHAMADOS)).toHaveLength(2);
  });

  it('a falha do servidor devolve o chamado à fila e avisa, sem sumir em silêncio', async () => {
    await excluirComConfirmacao();
    __recusarEscritaEm(`${CHAMADOS}/da-ana`);

    deixarVencer();

    expect(await screen.findByText(/Não foi possível excluir/i)).toBeInTheDocument();
    expect(await screen.findByText('o VS Code não abre')).toBeInTheDocument();
    expect(__documentosDe(CHAMADOS)).toHaveLength(2);
  });
});

describe('a exclusão leva o anexo junto (AC-CHAMADO-08)', () => {
  beforeEach(() => __definirUsuarioAtual(ANA));

  it('apaga o arquivo do Storage quando a janela de desfazer vence', async () => {
    const caminho = `salas/${SALA}/chamados/com-anexo/print.png`;
    __semearArquivos([caminho]);
    __semearColecao(CHAMADOS, [
      {
        id: 'com-anexo',
        autorUid: ANA.uid,
        autorNome: 'Ana Souza',
        email: ANA.email,
        descricao: 'olha o erro',
        horario: Timestamp.fromDate(new Date('2026-09-23T10:10:00.000Z')),
        anexo: { caminho, url: 'https://exemplo.br/print.png', origem: 'storage' },
        atendido: false,
      },
    ]);

    renderComProvedores(<TelaAluno salaId={SALA} />);
    await pedirExclusao('olha o erro');
    await userEvent.click(confirmar());
    await waitFor(() => expect(screen.queryByText('olha o erro')).not.toBeInTheDocument());

    deixarVencer();

    await waitFor(() => expect(__arquivosEnviados()).toEqual([]));
  });

  it('desfazer preserva o anexo — o documento nunca chegou a sair', async () => {
    const caminho = `salas/${SALA}/chamados/com-anexo/print.png`;
    __semearArquivos([caminho]);
    __semearColecao(CHAMADOS, [
      {
        id: 'com-anexo',
        autorUid: ANA.uid,
        autorNome: 'Ana Souza',
        email: ANA.email,
        descricao: 'olha o erro',
        horario: Timestamp.fromDate(new Date('2026-09-23T10:10:00.000Z')),
        anexo: { caminho, url: 'https://exemplo.br/print.png', origem: 'storage' },
        atendido: false,
      },
    ]);

    renderComProvedores(<TelaAluno salaId={SALA} />);
    await pedirExclusao('olha o erro');
    await userEvent.click(confirmar());
    await waitFor(() => expect(screen.queryByText('olha o erro')).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    deixarVencer();

    expect(__arquivosEnviados()).toEqual([caminho]);
  });
});

describe('o professor marca como atendido (AC-CHAMADO-06)', () => {
  beforeEach(() => __definirUsuarioAtual(CARLOS));

  it('oferece a ação em todo card da sala', () => {
    renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);

    expect(
      within(cartaoDe('o VS Code não abre')).getByRole('button', { name: /Atendido/i })
    ).toBeInTheDocument();
    expect(
      within(cartaoDe('o cabo de rede caiu')).getByRole('button', { name: /Atendido/i })
    ).toBeInTheDocument();
  });

  it('grava o campo e o carimbo do servidor, sem tocar na autoria', async () => {
    renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);

    await userEvent.click(
      within(cartaoDe('o VS Code não abre')).getByRole('button', { name: /Atendido/i })
    );

    await waitFor(() =>
      expect(__documentosDe(CHAMADOS).find((doc) => doc.id === 'da-ana').atendido).toBe(true)
    );

    // O carimbo vem do SERVIDOR, e não do relógio desta máquina (AC-TEMPO-01):
    // até a resposta chegar ele é `null`, como em toda escrita deste projeto.
    act(() => __confirmarCarimbos());

    const chamado = __documentosDe(CHAMADOS).find((doc) => doc.id === 'da-ana');

    expect(chamado.atendidoEm.toDate()).toEqual(new Date(AGORA));
    expect(chamado.autorUid).toBe(ANA.uid);
  });

  it('o chamado atendido vai para o fim da fila, e não some', async () => {
    renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);

    await userEvent.click(
      within(cartaoDe('o VS Code não abre')).getByRole('button', { name: /Atendido/i })
    );

    await waitFor(() => {
      const descricoes = Array.from(document.querySelectorAll('.problema-card')).map(
        (card) => card.querySelector('.texto-markdown').textContent
      );

      expect(descricoes).toEqual(['o cabo de rede caiu', 'o VS Code não abre']);
    });
  });

  it('desmarcar devolve o chamado à fila aberta', async () => {
    renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);
    const atendido = () =>
      within(cartaoDe('o VS Code não abre')).getByRole('button', { name: /Atendido/i });

    await userEvent.click(atendido());
    await waitFor(() =>
      expect(__documentosDe(CHAMADOS).find((doc) => doc.id === 'da-ana').atendido).toBe(true)
    );

    await userEvent.click(atendido());

    await waitFor(() =>
      expect(__documentosDe(CHAMADOS).find((doc) => doc.id === 'da-ana').atendido).toBe(false)
    );

    // O carimbo some junto: um chamado reaberto com `atendidoEm` gravado
    // mentiria para qualquer métrica que viesse a lê-lo.
    expect(__documentosDe(CHAMADOS).find((doc) => doc.id === 'da-ana').atendidoEm).toBeNull();
  });

  it('marcar como atendido NÃO pede confirmação — é reversível num clique', async () => {
    renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);

    await userEvent.click(
      within(cartaoDe('o VS Code não abre')).getByRole('button', { name: /Atendido/i })
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sala arquivada não oferece nem excluir nem atender (AC-SALA-10)', () => {
    renderComProvedores(<TelaProfessor salaId={SALA} somenteLeitura ehDono />);

    expect(screen.queryByRole('button', { name: 'Excluir' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Atendido/i })).toBeNull();
  });
});

describe('compatibilidade do campo `atendido` (retroativa e futura)', () => {
  beforeEach(() => __definirUsuarioAtual(CARLOS));

  it('chamado da v0.1.0, sem o campo, conta como ABERTO e fica no topo', () => {
    __semearColecao(CHAMADOS, [
      {
        id: 'antigo',
        nome: 'Bruno Alves',
        email: 'bruno@senai.br',
        descricao: 'chamado da v0.1.0',
        horario: '2026-09-23T09:00:00.000Z',
        cor: 'hsl(210, 70%, 80%)',
      },
    ]);

    renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);

    const descricoes = Array.from(document.querySelectorAll('.problema-card')).map(
      (card) => card.querySelector('.texto-markdown').textContent
    );

    // O mais antigo primeiro, como sempre: ausência de `atendido` é "aberto",
    // nunca "desconhecido". Tratá-la como atendido jogaria a fila inteira de
    // antes da migração para o rodapé da tela.
    expect(descricoes[0]).toBe('chamado da v0.1.0');
  });

  it('marcar como atendido é aditivo: nenhum campo antigo é removido', async () => {
    __semearColecao(CHAMADOS, [
      {
        id: 'antigo',
        nome: 'Bruno Alves',
        email: 'bruno@senai.br',
        descricao: 'chamado da v0.1.0',
        horario: '2026-09-23T09:00:00.000Z',
        cor: 'hsl(210, 70%, 80%)',
        imagem: 'https://exemplo.br/print.png',
      },
    ]);

    renderComProvedores(<TelaProfessor salaId={SALA} ehDono />);
    await userEvent.click(
      within(cartaoDe('chamado da v0.1.0')).getByRole('button', { name: /Atendido/i })
    );

    await waitFor(() => {
      const chamado = __documentosDe(CHAMADOS).find((doc) => doc.id === 'antigo');

      // O que um cliente da v0.9.0 procura continua exatamente onde estava —
      // ele ignora `atendido` e renderiza o card como sempre renderizou.
      expect(chamado).toMatchObject({
        nome: 'Bruno Alves',
        email: 'bruno@senai.br',
        descricao: 'chamado da v0.1.0',
        cor: 'hsl(210, 70%, 80%)',
        imagem: 'https://exemplo.br/print.png',
        atendido: true,
      });
    });
  });
});
