// A lista de mensagens — AC-CHAT-03, AC-CHAT-05, AC-CHAT-06.
//
// É aqui que mora o agrupamento (AC-CHAT-03), porque agrupar é uma decisão
// sobre a mensagem **anterior** — e o balão não conhece a anterior. A lista
// conhece, e passa `agrupada` para baixo.
//
// A regra do agrupamento tem duas condições, e a segunda existe por experiência
// de sala: mesmo autor **e** perto no tempo. Sem o corte de tempo, a resposta
// que o professor dá às 14h gruda na frase que ele disse às 8h, e a conversa
// fica com um bloco só, sem cabeçalho, atravessando a manhã inteira.
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import ListaMensagens from '../ListaMensagens';
import { PAPEL_DE_PROFESSOR } from '../../../services/salas';

const ANA = 'uid-ana';
const BRUNO = 'uid-bruno';

/** Uma mensagem no minuto `minuto` da manhã de 10/03/2026 em Brasília. */
function mensagem(id, autorUid, texto, minuto = 0) {
  return {
    id,
    autorUid,
    autorNome: autorUid === ANA ? 'Ana Souza' : 'Bruno Dias',
    texto,
    horario: Timestamp.fromDate(new Date(Date.UTC(2026, 2, 10, 12, minuto))),
  };
}

/** Os cabeçalhos de autor visíveis, na ordem do DOM. */
function autoresNaTela() {
  return [...document.querySelectorAll('.mensagem-autor')].map(
    (elemento) => elemento.textContent
  );
}

/** Os textos dos balões, na ordem do DOM. */
function textosNaTela() {
  return [...document.querySelectorAll('.mensagem-texto')].map(
    (elemento) => elemento.textContent
  );
}

function mensagensAgrupadas() {
  return document.querySelectorAll('.mensagem--agrupada');
}

describe('ListaMensagens — agrupamento (AC-CHAT-03)', () => {
  it('mostra o nome uma vez só num bloco do mesmo autor', () => {
    render(
      <ListaMensagens
        mensagens={[
          mensagem('m1', ANA, 'primeira', 0),
          mensagem('m2', ANA, 'segunda', 1),
          mensagem('m3', ANA, 'terceira', 2),
        ]}
      />
    );

    expect(autoresNaTela()).toEqual(['Ana Souza']);
    expect(textosNaTela()).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('volta a mostrar o nome quando outra pessoa fala', () => {
    render(
      <ListaMensagens
        mensagens={[
          mensagem('m1', ANA, 'primeira', 0),
          mensagem('m2', BRUNO, 'respondendo', 1),
          mensagem('m3', ANA, 'de novo', 2),
        ]}
      />
    );

    expect(autoresNaTela()).toEqual(['Ana Souza', 'Bruno Dias', 'Ana Souza']);
  });

  it('não agrupa mensagens do mesmo autor distantes no tempo', () => {
    render(
      <ListaMensagens
        mensagens={[mensagem('m1', ANA, 'de manhã', 0), mensagem('m2', ANA, 'à tarde', 360)]}
      />
    );

    expect(autoresNaTela()).toEqual(['Ana Souza', 'Ana Souza']);
    expect(mensagensAgrupadas()).toHaveLength(0);
  });

  it('a primeira mensagem da lista nunca é continuação de nada', () => {
    render(<ListaMensagens mensagens={[mensagem('m1', ANA, 'primeira', 0)]} />);

    expect(mensagensAgrupadas()).toHaveLength(0);
  });

  it('agrupa mensagem legada pelo e-mail, quando não há autorUid', () => {
    const legada = (id, texto) => ({
      id,
      nome: 'Autor Antigo',
      email: 'antigo@senai.br',
      texto,
      horario: '2026-03-10T12:00:00.000Z',
    });

    render(<ListaMensagens mensagens={[legada('m1', 'primeira'), legada('m2', 'segunda')]} />);

    expect(autoresNaTela()).toEqual(['Autor Antigo']);
  });

  it('não agrupa duas pessoas diferentes que ainda não têm autorUid', () => {
    render(
      <ListaMensagens
        mensagens={[
          { id: 'm1', nome: 'Ana', email: 'ana@senai.br', texto: 'oi', horario: null },
          { id: 'm2', nome: 'Bruno', email: 'bruno@senai.br', texto: 'oi', horario: null },
        ]}
      />
    );

    expect(autoresNaTela()).toEqual(['Ana', 'Bruno']);
  });
});

describe('ListaMensagens — lado e selo', () => {
  it('marca como minhas as mensagens do uid que está lendo', () => {
    render(
      <ListaMensagens
        uid={ANA}
        mensagens={[mensagem('m1', ANA, 'minha', 0), mensagem('m2', BRUNO, 'dele', 1)]}
      />
    );

    const [primeira, segunda] = document.querySelectorAll('.mensagem');
    expect(primeira).toHaveClass('mensagem--minha');
    expect(segunda).toHaveClass('mensagem--de-outro');
  });

  it('repassa o selo de professor ao balão', () => {
    render(
      <ListaMensagens
        mensagens={[{ ...mensagem('m1', BRUNO, 'atenção', 0), autorPapel: PAPEL_DE_PROFESSOR }]}
      />
    );

    expect(screen.getByText('Professor')).toBeInTheDocument();
  });
});

describe('ListaMensagens — buscar as anteriores (AC-CHAT-06)', () => {
  it('oferece o botão quando há conversa antes da janela', () => {
    render(<ListaMensagens mensagens={[mensagem('m1', ANA, 'oi', 0)]} temMais />);

    expect(screen.getByRole('button', { name: /anteriores/i })).toBeInTheDocument();
  });

  it('não oferece o botão quando a conversa inteira já está na tela', () => {
    render(<ListaMensagens mensagens={[mensagem('m1', ANA, 'oi', 0)]} temMais={false} />);

    expect(screen.queryByRole('button', { name: /anteriores/i })).not.toBeInTheDocument();
  });

  it('chama quem sabe paginar, em vez de paginar por conta própria', async () => {
    const carregarAnteriores = jest.fn();

    render(
      <ListaMensagens
        mensagens={[mensagem('m1', ANA, 'oi', 0)]}
        temMais
        aoCarregarAnteriores={carregarAnteriores}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /anteriores/i }));

    expect(carregarAnteriores).toHaveBeenCalledTimes(1);
  });
});

describe('ListaMensagens — estados vazios', () => {
  it('convida a começar quando não há mensagem nenhuma', () => {
    render(<ListaMensagens mensagens={[]} />);

    expect(screen.getByText(/nenhuma mensagem/i)).toBeInTheDocument();
  });

  it('avisa que está carregando em vez de dizer que a conversa está vazia', () => {
    render(<ListaMensagens mensagens={[]} carregando />);

    expect(screen.queryByText(/nenhuma mensagem/i)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('ListaMensagens — ponto de extensão da task 07', () => {
  it('pede as insígnias de cada autor a quem souber montá-las', () => {
    const insigniasDe = jest.fn(() => <span data-testid="perk">🔥</span>);

    render(
      <ListaMensagens mensagens={[mensagem('m1', ANA, 'oi', 0)]} insigniasDe={insigniasDe} />
    );

    expect(insigniasDe).toHaveBeenCalledWith(expect.objectContaining({ id: 'm1' }));
    expect(screen.getByTestId('perk')).toBeInTheDocument();
  });
});
