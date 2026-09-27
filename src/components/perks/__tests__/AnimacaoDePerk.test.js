// A animação de premiação — AC-PERK-04, AC-PERK-08, AC-ANIM-05, AC-ANIM-06.
//
// O cliente pediu "perks tipo o do Call of Duty, pra ter animações legais". A
// animação **é** o requisito, não o enfeite: uma notificação discreta no canto
// não entrega o que ele descreveu, que é o aluno sentir que ganhou alguma
// coisa na frente da turma.
//
// E o ambiente é uma sala com 40 pessoas e um projetor. Daí as três travas que
// este arquivo cobra, e que valem tanto quanto a animação em si:
//
//   * **botão de pular sempre visível**, e Esc fechando — ninguém fica refém
//     de três segundos de tela cheia no meio de uma prova;
//   * **`prefers-reduced-motion`** vira card estático com a MESMA informação,
//     não um card mais pobre;
//   * **som desligado por padrão**, ligado só por escolha explícita.
import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react-dom/test-utils';
import { renderComProvedores, fixarRelogio, restaurarRelogio } from '../../../test-utils';
import AnimacaoDePerk, { DURACAO_DA_ANIMACAO_MS } from '../AnimacaoDePerk';

const PERK = {
  id: 'perk-1',
  alunoUid: 'uid-ana',
  alunoNome: 'Ana Souza',
  tipo: 'prioridade',
  nivel: 2,
  justificativa: 'Ajudou o colega a achar o erro de compilação.',
  concedidoPorNome: 'Carlos Lima',
  expiraEm: null,
  revogadoEm: null,
  visualizadoEm: null,
};

/** Instala `matchMedia` no jsdom, que não o traz. */
function comMovimentoReduzido(reduzido) {
  window.matchMedia = jest.fn().mockImplementation((consulta) => ({
    matches: reduzido && consulta.includes('prefers-reduced-motion'),
    media: consulta,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
}

function renderizar(props = {}) {
  return renderComProvedores(
    <AnimacaoDePerk
      perk={PERK}
      preferencias={{ animacoes: true, som: false }}
      aoFechar={() => {}}
      {...props}
    />
  );
}

beforeEach(() => {
  comMovimentoReduzido(false);
});

afterEach(() => {
  delete window.matchMedia;
});

describe('AnimacaoDePerk — o que o aluno vê (AC-PERK-04)', () => {
  it('mostra o nome da premiação, o nível, a justificativa e quem concedeu', () => {
    renderizar();

    expect(screen.getByText(/Prioridade no Atendimento/i)).toBeInTheDocument();
    expect(screen.getByText(/nível 2/i)).toBeInTheDocument();
    expect(
      screen.getByText('Ajudou o colega a achar o erro de compilação.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Carlos Lima/)).toBeInTheDocument();
  });

  it('ocupa a tela como diálogo, e se anuncia para quem usa leitor de tela', () => {
    renderizar();

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo.className).toMatch(/perk-premiacao/);
  });

  it('não renderiza nada sem perk', () => {
    const { container } = renderizar({ perk: null });

    expect(container).toBeEmptyDOMElement();
  });

  it('aguenta perk sem justificativa sem deixar buraco na tela', () => {
    renderizar({ perk: { ...PERK, justificativa: null } });

    expect(screen.getByText(/Prioridade no Atendimento/i)).toBeInTheDocument();
  });
});

describe('AnimacaoDePerk — a saída sempre disponível (AC-PERK-04, AC-ANIM-10)', () => {
  it('o botão de pular está visível desde o primeiro quadro', () => {
    renderizar();

    expect(screen.getByRole('button', { name: /pular/i })).toBeVisible();
  });

  it('pular fecha a premiação', () => {
    const aoFechar = jest.fn();
    renderizar({ aoFechar });

    userEvent.click(screen.getByRole('button', { name: /pular/i }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('Esc fecha a premiação', () => {
    const aoFechar = jest.fn();
    renderizar({ aoFechar });

    userEvent.type(screen.getByRole('dialog'), '{esc}');

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('fecha sozinha quando a animação termina', () => {
    fixarRelogio('2026-09-22T12:00:00.000Z');
    const aoFechar = jest.fn();

    try {
      renderizar({ aoFechar });

      expect(aoFechar).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(DURACAO_DA_ANIMACAO_MS + 50);
      });

      expect(aoFechar).toHaveBeenCalledTimes(1);
    } finally {
      restaurarRelogio();
    }
  });

  // Fechar duas vezes gravaria o recibo duas vezes e, pior, poderia fechar a
  // premiação seguinte antes de ela aparecer.
  it('não avisa duas vezes quando o aluno pula e o tempo acaba em seguida', () => {
    fixarRelogio('2026-09-22T12:00:00.000Z');
    const aoFechar = jest.fn();

    try {
      renderizar({ aoFechar });

      userEvent.click(screen.getByRole('button', { name: /pular/i }));

      act(() => {
        jest.advanceTimersByTime(DURACAO_DA_ANIMACAO_MS + 50);
      });

      expect(aoFechar).toHaveBeenCalledTimes(1);
    } finally {
      restaurarRelogio();
    }
  });
});

describe('AnimacaoDePerk — movimento reduzido e preferências (AC-PERK-08, AC-ANIM-05)', () => {
  it('com prefers-reduced-motion, mostra card estático com a mesma informação', () => {
    comMovimentoReduzido(true);
    renderizar();

    const dialogo = screen.getByRole('dialog');

    expect(dialogo.className).toMatch(/perk-premiacao--estatica/);
    expect(screen.getByText(/Prioridade no Atendimento/i)).toBeInTheDocument();
    expect(
      screen.getByText('Ajudou o colega a achar o erro de compilação.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Carlos Lima/)).toBeInTheDocument();
  });

  it('o card estático continua tendo o botão de fechar', () => {
    comMovimentoReduzido(true);
    const aoFechar = jest.fn();
    renderizar({ aoFechar });

    userEvent.click(screen.getByRole('button', { name: /pular|fechar/i }));

    expect(aoFechar).toHaveBeenCalledTimes(1);
  });

  it('quem desligou animações nas preferências também recebe o card estático', () => {
    renderizar({ preferencias: { animacoes: false, som: false } });

    expect(screen.getByRole('dialog').className).toMatch(/perk-premiacao--estatica/);
  });

  // O card estático não pode fechar sozinho: quem pediu menos movimento
  // precisa de tempo para ler, e não de um cronômetro escondido.
  it('o card estático espera o aluno em vez de sumir no tempo da animação', () => {
    fixarRelogio('2026-09-22T12:00:00.000Z');
    comMovimentoReduzido(true);
    const aoFechar = jest.fn();

    try {
      renderizar({ aoFechar });

      act(() => {
        jest.advanceTimersByTime(DURACAO_DA_ANIMACAO_MS * 3);
      });

      expect(aoFechar).not.toHaveBeenCalled();
    } finally {
      restaurarRelogio();
    }
  });
});

describe('AnimacaoDePerk — o som (AC-PERK-04)', () => {
  /** O `<audio>` da premiação. */
  function audio() {
    return document.querySelector('audio');
  }

  it('o áudio existe mudo quando a preferência de som está desligada', () => {
    renderizar({ preferencias: { animacoes: true, som: false } });

    expect(audio()).toBeInTheDocument();
    expect(audio().muted).toBe(true);
    expect(audio()).not.toHaveAttribute('autoplay');
  });

  it('o áudio deixa de ser mudo quando o aluno optou pelo som', () => {
    renderizar({ preferencias: { animacoes: true, som: true } });

    expect(audio().muted).toBe(false);
  });

  it('sem preferência informada, o som fica desligado', () => {
    renderizar({ preferencias: undefined });

    expect(audio().muted).toBe(true);
  });

  // A restrição de produção é explícita: se o áudio falhar, a premiação
  // degrada sem lançar. Um `play()` rejeitado é o caso comum — o navegador
  // bloqueia áudio antes do primeiro gesto do usuário.
  it('a premiação continua na tela quando o navegador recusa tocar o áudio', () => {
    const tocar = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockRejectedValue(new Error('NotAllowedError'));

    try {
      renderizar({ preferencias: { animacoes: true, som: true } });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    } finally {
      tocar.mockRestore();
    }
  });

  it('não tenta tocar nada quando o som está desligado', () => {
    const tocar = jest
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);

    try {
      renderizar({ preferencias: { animacoes: true, som: false } });

      expect(tocar).not.toHaveBeenCalled();
    } finally {
      tocar.mockRestore();
    }
  });
});
