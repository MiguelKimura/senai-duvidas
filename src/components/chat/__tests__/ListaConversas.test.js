// A lista de conversas diretas — AC-DM-05, AC-DM-06.
//
// Componente sem banco: recebe as conversas já ordenadas pelo serviço e decide
// como elas aparecem. A ordenação é do servidor (`orderBy('ultimaMensagem.
// horario', 'desc')`) porque reordenar aqui daria a ilusão de ordem correta com
// uma janela cortada no lugar errado.
//
// O contador de não lidas é a única coisa que a lista calcula, e ela calcula
// olhando para o **próprio uid** dentro do mapa `naoLidas`. É o que impede o
// erro clássico de mostrar ao professor o número de mensagens que o aluno não
// leu.
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Timestamp } from 'firebase/firestore';
import ListaConversas from '../ListaConversas';

const ANA = 'uid-ana';
const CARLOS = 'uid-carlos';
const BRUNO = 'uid-bruno';

function conversa(id, outroUid, outroNome, { naoLidas = {}, texto = 'oi', minuto = 0 } = {}) {
  return {
    id,
    participantes: [ANA, outroUid].sort(),
    participantesNomes: { [ANA]: 'Ana Souza', [outroUid]: outroNome },
    naoLidas,
    ultimaMensagem: {
      texto,
      autorUid: outroUid,
      horario: Timestamp.fromDate(new Date(Date.UTC(2026, 2, 10, 12, minuto))),
    },
  };
}

/** Os itens da lista, na ordem do DOM. */
function itens() {
  return [...document.querySelectorAll('.conversa-item')];
}

describe('ListaConversas — o que cada linha mostra', () => {
  it('mostra o nome da OUTRA pessoa, não o de quem está lendo', () => {
    render(<ListaConversas uid={ANA} conversas={[conversa('c1', CARLOS, 'Carlos Lima')]} />);

    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
    expect(screen.queryByText('Ana Souza')).not.toBeInTheDocument();
  });

  it('mostra uma prévia da última mensagem', () => {
    render(
      <ListaConversas
        uid={ANA}
        conversas={[
          conversa('c1', CARLOS, 'Carlos Lima', { texto: 'me procure depois da aula' }),
        ]}
      />
    );

    expect(screen.getByText(/me procure depois da aula/)).toBeInTheDocument();
  });

  it('mostra o horário da última mensagem, em HH:mm de Brasília', () => {
    render(
      <ListaConversas
        uid={ANA}
        conversas={[conversa('c1', CARLOS, 'Carlos Lima', { minuto: 30 })]}
      />
    );

    expect(screen.getByText('09:30')).toBeInTheDocument();
  });

  it('aguenta uma conversa recém-criada, ainda sem mensagem nenhuma', () => {
    const vazia = { ...conversa('c1', CARLOS, 'Carlos Lima'), ultimaMensagem: null };

    expect(() => render(<ListaConversas uid={ANA} conversas={[vazia]} />)).not.toThrow();
    expect(screen.getByText('Carlos Lima')).toBeInTheDocument();
  });
});

describe('ListaConversas — contador de não lidas (AC-DM-05)', () => {
  it('mostra o contador de quem está lendo', () => {
    render(
      <ListaConversas
        uid={ANA}
        conversas={[
          conversa('c1', CARLOS, 'Carlos Lima', { naoLidas: { [ANA]: 3, [CARLOS]: 0 } }),
        ]}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('NÃO mostra o contador do outro lado', () => {
    // O erro clássico: exibir quantas mensagens o outro deixou de ler.
    render(
      <ListaConversas
        uid={ANA}
        conversas={[
          conversa('c1', CARLOS, 'Carlos Lima', { naoLidas: { [ANA]: 0, [CARLOS]: 7 } }),
        ]}
      />
    );

    expect(screen.queryByText('7')).not.toBeInTheDocument();
  });

  it('não desenha uma bolinha com zero dentro', () => {
    render(
      <ListaConversas
        uid={ANA}
        conversas={[conversa('c1', CARLOS, 'Carlos Lima', { naoLidas: { [ANA]: 0 } })]}
      />
    );

    expect(document.querySelector('.conversa-nao-lidas')).toBeNull();
  });

  it('conversa sem o mapa naoLidas não quebra a lista', () => {
    const semMapa = { ...conversa('c1', CARLOS, 'Carlos Lima'), naoLidas: undefined };

    expect(() => render(<ListaConversas uid={ANA} conversas={[semMapa]} />)).not.toThrow();
  });
});

describe('ListaConversas — ordem e seleção (AC-DM-06)', () => {
  it('preserva a ordem que o servidor entregou', () => {
    render(
      <ListaConversas
        uid={ANA}
        conversas={[
          conversa('recente', CARLOS, 'Carlos Lima', { minuto: 50 }),
          conversa('antiga', BRUNO, 'Bruno Dias', { minuto: 5 }),
        ]}
      />
    );

    expect(itens().map((item) => item.textContent)).toEqual([
      expect.stringContaining('Carlos Lima'),
      expect.stringContaining('Bruno Dias'),
    ]);
  });

  it('avisa quem souber abrir, com o id da conversa e o nome do outro', async () => {
    const aoAbrir = jest.fn();
    render(
      <ListaConversas
        uid={ANA}
        conversas={[conversa('c1', CARLOS, 'Carlos Lima')]}
        aoAbrir={aoAbrir}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /Carlos Lima/ }));

    expect(aoAbrir).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1', outroUid: CARLOS, outroNome: 'Carlos Lima' })
    );
  });

  it('sem conversa nenhuma, explica o que fazer em vez de mostrar uma lista vazia', () => {
    render(<ListaConversas uid={ANA} conversas={[]} />);

    expect(screen.getByText(/nenhuma conversa/i)).toBeInTheDocument();
  });
});
