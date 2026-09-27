// A janela da conversa — AC-CHAT-06, AC-PERF-03, AC-PERF-04.
//
// Este é o arquivo que mede a maior economia de leitura do roadmap. Até a
// v0.7.0 o chat escutava a conversa com `orderBy('horario')` e o teto de 300:
// **as 300 mais antigas**. Numa sala em novembro, isso é a conversa de março —
// paga por todo aluno, toda vez que a tela abre, e nunca a que alguém quer ler.
//
// A afirmação que importa aqui é sobre a **consulta**, não sobre a tela. Com 12
// mensagens no banco, contar balões dá 12 com `limit(50)` e dá 12 sem limite
// nenhum: é o corte que precisa ser verificado, e é ele que `__consultasAtivas`
// expõe.
import { act, renderHook, waitFor } from '@testing-library/react';
import {
  __consultasAtivas,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import { useMensagens } from '../useMensagens';
import { MENSAGENS_POR_PAGINA } from '../../services/chat';
import { LIMITE_DE_MENSAGENS } from '../../services/salas';

const CHAT_DA_SALA = 'salas/sala-a/chat';

/** Semeia `quantidade` mensagens, uma por segundo, na ordem em que foram ditas. */
function semearConversa(quantidade) {
  __semearColecao(
    CHAT_DA_SALA,
    Array.from({ length: quantidade }, (_, indice) => ({
      id: `m${String(indice).padStart(4, '0')}`,
      autorUid: 'uid-ana',
      autorNome: 'Ana Souza',
      texto: `Mensagem ${indice}`,
      horario: new Date(Date.UTC(2026, 2, 10, 12, 0, indice)),
    }))
  );
}

/** A consulta da conversa da sala, entre as que estão inscritas agora. */
function consultaDaConversa() {
  return __consultasAtivas().find((consulta) => consulta.caminho === CHAT_DA_SALA);
}

beforeEach(() => {
  __resetarFirestore();
});

describe('useMensagens — a janela de 50 (AC-CHAT-06, AC-PERF-03)', () => {
  it('consulta com limit(50), e não com o teto de 300 da v0.7.0', async () => {
    renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(consultaDaConversa()).toBeDefined());
    expect(consultaDaConversa().quantidade).toBe(MENSAGENS_POR_PAGINA);
  });

  it('pede as mensagens em ordem decrescente: as 50 MAIS RECENTES', async () => {
    // Com `orderBy('horario')` crescente e `limit`, o Firestore devolve as
    // mais ANTIGAS — a conversa de março numa sala em novembro.
    renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(consultaDaConversa()).toBeDefined());
    expect(consultaDaConversa().ordenacoes).toEqual([
      { __tipo: 'orderBy', campo: 'horario', direcao: 'desc' },
    ]);
  });

  it('com 120 mensagens no banco, entrega 50', async () => {
    semearConversa(120);

    const { result } = renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(result.current.mensagens).toHaveLength(MENSAGENS_POR_PAGINA));
  });

  it('as 50 entregues são as últimas, e chegam em ordem crescente para a tela', async () => {
    semearConversa(120);

    const { result } = renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(result.current.mensagens).toHaveLength(MENSAGENS_POR_PAGINA));
    const textos = result.current.mensagens.map((mensagem) => mensagem.texto);
    expect(textos[0]).toBe('Mensagem 70');
    expect(textos[textos.length - 1]).toBe('Mensagem 119');
  });

  it('com menos de 50 mensagens, entrega todas', async () => {
    semearConversa(12);

    const { result } = renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(result.current.mensagens).toHaveLength(12));
  });
});

describe('useMensagens — buscar as anteriores sob demanda (AC-CHAT-06)', () => {
  it('avisa que há mais quando a janela veio cheia', async () => {
    semearConversa(120);

    const { result } = renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(result.current.temMais).toBe(true));
  });

  it('não avisa que há mais quando a conversa cabe na janela', async () => {
    semearConversa(12);

    const { result } = renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(result.current.mensagens).toHaveLength(12));
    expect(result.current.temMais).toBe(false);
  });

  it('carregarAnteriores traz as 50 anteriores, sem perder as que já estavam', async () => {
    semearConversa(120);

    const { result } = renderHook(() => useMensagens('sala-a'));
    await waitFor(() => expect(result.current.mensagens).toHaveLength(50));

    act(() => result.current.carregarAnteriores());

    await waitFor(() => expect(result.current.mensagens).toHaveLength(100));
    expect(result.current.mensagens[0].texto).toBe('Mensagem 20');
    expect(result.current.mensagens[99].texto).toBe('Mensagem 119');
  });

  it('carregar duas vezes chega ao começo e desliga o aviso de "há mais"', async () => {
    semearConversa(120);

    const { result } = renderHook(() => useMensagens('sala-a'));
    await waitFor(() => expect(result.current.mensagens).toHaveLength(50));

    act(() => result.current.carregarAnteriores());
    await waitFor(() => expect(result.current.mensagens).toHaveLength(100));

    act(() => result.current.carregarAnteriores());
    await waitFor(() => expect(result.current.mensagens).toHaveLength(120));
    expect(result.current.temMais).toBe(false);
  });

  it('a janela não cresce além do teto da sala, aconteça o que acontecer', async () => {
    semearConversa(LIMITE_DE_MENSAGENS + 40);

    const { result } = renderHook(() => useMensagens('sala-a'));
    await waitFor(() => expect(result.current.mensagens).toHaveLength(50));

    for (let vez = 0; vez < 20; vez += 1) {
      act(() => result.current.carregarAnteriores());
    }

    await waitFor(() => expect(consultaDaConversa().quantidade).toBe(LIMITE_DE_MENSAGENS));
    expect(result.current.mensagens.length).toBeLessThanOrEqual(LIMITE_DE_MENSAGENS);
  });
});

describe('useMensagens — tempo real e listeners (AC-PERF-04)', () => {
  it('reage a uma mensagem nova sem recarregar nada', async () => {
    semearConversa(3);

    const { result } = renderHook(() => useMensagens('sala-a'));
    await waitFor(() => expect(result.current.mensagens).toHaveLength(3));

    act(() =>
      __semearColecao(CHAT_DA_SALA, [
        {
          id: 'nova',
          autorUid: 'uid-bruno',
          autorNome: 'Bruno Dias',
          texto: 'Alguém tem o link?',
          horario: new Date(Date.UTC(2026, 2, 10, 13, 0, 0)),
        },
      ])
    );

    await waitFor(() => expect(result.current.mensagens).toHaveLength(4));
    expect(result.current.mensagens[3].texto).toBe('Alguém tem o link?');
  });

  it('cancela o listener ao desmontar', async () => {
    const { unmount } = renderHook(() => useMensagens('sala-a'));
    await waitFor(() => expect(__ouvintesAtivos()).toBe(1));

    unmount();

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('carregar anteriores NÃO acumula listener: troca a janela, não empilha', async () => {
    semearConversa(120);

    const { result } = renderHook(() => useMensagens('sala-a'));
    await waitFor(() => expect(__ouvintesAtivos()).toBe(1));

    act(() => result.current.carregarAnteriores());

    await waitFor(() => expect(result.current.mensagens).toHaveLength(100));
    expect(__ouvintesAtivos()).toBe(1);
  });

  it('trocar de sala não acumula listener', async () => {
    const { result, rerender } = renderHook(({ sala }) => useMensagens(sala), {
      initialProps: { sala: 'sala-a' },
    });
    await waitFor(() => expect(__ouvintesAtivos()).toBe(1));

    rerender({ sala: 'sala-b' });

    await waitFor(() => expect(consultaDaConversa()).toBeUndefined());
    expect(__ouvintesAtivos()).toBe(1);
    expect(result.current.mensagens).toEqual([]);
  });

  it('trocar de sala volta a janela para 50, sem herdar a paginação da anterior', async () => {
    semearConversa(120);

    const { result, rerender } = renderHook(({ sala }) => useMensagens(sala), {
      initialProps: { sala: 'sala-a' },
    });
    await waitFor(() => expect(result.current.mensagens).toHaveLength(50));
    act(() => result.current.carregarAnteriores());
    await waitFor(() => expect(result.current.mensagens).toHaveLength(100));

    rerender({ sala: 'sala-b' });

    await waitFor(() =>
      expect(
        __consultasAtivas().find((consulta) => consulta.caminho === 'salas/sala-b/chat')
          .quantidade
      ).toBe(MENSAGENS_POR_PAGINA)
    );
  });
});

describe('useMensagens — compatibilidade retroativa', () => {
  it('sem salaId, escuta a coleção global da v0.4.0 (fallback de leitura)', async () => {
    __semearColecao('chat', [
      {
        id: 'antiga',
        nome: 'Autor Antigo',
        email: 'antigo@senai.br',
        texto: 'Mensagem global antiga',
        horario: new Date('2025-03-10T13:45:00.000Z'),
      },
    ]);

    const { result } = renderHook(() => useMensagens(null));

    await waitFor(() => expect(result.current.mensagens).toHaveLength(1));
    expect(result.current.mensagens[0].texto).toBe('Mensagem global antiga');
  });

  it('ordena uma coleção mista de Timestamp e string ISO pelo instante real', async () => {
    // O `orderBy` do Firestore ordena por TIPO antes de ordenar por valor, e a
    // ordem final por isso é decidida no cliente, como em toda tela do app.
    __semearColecao(CHAT_DA_SALA, [
      {
        id: 'nova',
        autorUid: 'uid-ana',
        autorNome: 'Ana',
        texto: 'depois',
        horario: new Date('2026-03-10T15:00:00.000Z'),
      },
      {
        id: 'legada',
        nome: 'Autor Antigo',
        texto: 'antes',
        horario: '2026-03-10T09:00:00.000Z',
      },
    ]);

    const { result } = renderHook(() => useMensagens('sala-a'));

    await waitFor(() => expect(result.current.mensagens).toHaveLength(2));
    expect(result.current.mensagens.map((mensagem) => mensagem.texto)).toEqual([
      'antes',
      'depois',
    ]);
  });
});
