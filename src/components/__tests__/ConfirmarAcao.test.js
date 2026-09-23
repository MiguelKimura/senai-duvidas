// A confirmação de ação destrutiva — AC-ANIM-07, AC-ANIM-10, AC-CHAMADO-04.
//
// O que isto substitui é `window.confirm()` — que este projeto nunca chegou a
// usar, e é justamente o problema: a exclusão de chamado não pedia confirmação
// nenhuma. Um clique errado no botão vermelho perdia a dúvida do aluno, com a
// imagem do print junto, sem volta.
//
// Um diálogo próprio, e não o do navegador, pelo mesmo motivo do `Lightbox` da
// task 04: o do navegador bloqueia a aba, não é estilizável e, em parte dos
// laboratórios do SENAI, vem suprimido por política do Windows — nesse caso
// `window.confirm()` devolve `false` em silêncio, e a ação nunca acontece.
//
// O preço de um diálogo próprio é ter de ser um diálogo de verdade:
//
//   * foco preso dentro enquanto está aberto, senão quem navega por teclado
//     tabula para trás dele e fica interagindo com a página escondida;
//   * `Esc` fecha, porque é o que todo mundo já tenta;
//   * o foco volta a quem o abriu, senão a tabulação recomeça do topo da
//     página a cada confirmação;
//   * **o foco inicial vai no botão seguro.** Um `Enter` de reflexo num
//     diálogo que apareceu de repente não pode apagar nada.
import React, { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmarAcao from '../ConfirmarAcao';

/** O diálogo aberto por um botão de verdade, para haver a quem devolver o foco. */
function ComGatilho({ aoConfirmar = () => {}, aoCancelar = () => {}, ...resto }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div>
      <button type="button" onClick={() => setAberto(true)}>
        Excluir
      </button>

      {/* Um segundo focável fora do diálogo: é contra ele que a prisão do
          foco é verificada. Sem ele, o Tab não teria para onde escapar. */}
      <button type="button">Outra coisa</button>

      {aberto && (
        <ConfirmarAcao
          titulo="Excluir esta dúvida?"
          descricao="A dúvida e o print anexado saem da fila. Não dá para voltar atrás."
          rotuloConfirmar="Excluir"
          destrutiva
          aoConfirmar={() => {
            setAberto(false);
            aoConfirmar();
          }}
          aoCancelar={() => {
            setAberto(false);
            aoCancelar();
          }}
          {...resto}
        />
      )}
    </div>
  );
}

async function abrir(props = {}) {
  render(<ComGatilho {...props} />);
  await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
}

describe('ConfirmarAcao — a pergunta (AC-CHAMADO-04)', () => {
  it('mostra o título e o que vai acontecer', async () => {
    await abrir();

    expect(screen.getByText('Excluir esta dúvida?')).toBeInTheDocument();
    expect(screen.getByText(/print anexado saem da fila/)).toBeInTheDocument();
  });

  it('é um diálogo modal anunciado pelo próprio título', async () => {
    await abrir();

    const dialogo = screen.getByRole('dialog');

    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName('Excluir esta dúvida?');
  });

  it('confirmar chama quem pediu', async () => {
    const aoConfirmar = jest.fn();
    await abrir({ aoConfirmar });

    await userEvent.click(screen.getByRole('button', { name: 'Excluir', hidden: true }));

    expect(aoConfirmar).toHaveBeenCalledTimes(1);
  });

  it('cancelar NÃO chama a ação destrutiva', async () => {
    const aoConfirmar = jest.fn();
    const aoCancelar = jest.fn();
    await abrir({ aoConfirmar, aoCancelar });

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(aoConfirmar).not.toHaveBeenCalled();
    expect(aoCancelar).toHaveBeenCalledTimes(1);
  });

  it('marca a ação destrutiva na marcação, e não só na cor', async () => {
    await abrir();

    const confirmar = screen
      .getAllByRole('button', { name: 'Excluir' })
      .find((botao) => botao.closest('[role="dialog"]'));

    expect(confirmar).toHaveAttribute('data-destrutiva', 'true');
  });

  it('sem `destrutiva`, o botão de confirmar não se marca como tal', async () => {
    render(
      <ConfirmarAcao
        titulo="Arquivar a sala?"
        rotuloConfirmar="Arquivar"
        aoConfirmar={() => {}}
        aoCancelar={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: 'Arquivar' })).not.toHaveAttribute(
      'data-destrutiva'
    );
  });
});

describe('ConfirmarAcao — teclado e foco (AC-ANIM-10)', () => {
  it('o foco começa no botão SEGURO, não no destrutivo', async () => {
    await abrir();

    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('Esc cancela', async () => {
    const aoConfirmar = jest.fn();
    const aoCancelar = jest.fn();
    await abrir({ aoConfirmar, aoCancelar });

    await userEvent.keyboard('{Escape}');

    expect(aoCancelar).toHaveBeenCalledTimes(1);
    expect(aoConfirmar).not.toHaveBeenCalled();
  });

  it('devolve o foco ao botão que o abriu', async () => {
    await abrir();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Excluir' })).toHaveFocus();
  });

  it('prende o foco: do último focável o Tab volta ao primeiro', async () => {
    await abrir();

    const dentro = screen
      .getAllByRole('button', { hidden: true })
      .filter((botao) => botao.closest('[role="dialog"]'));

    dentro[dentro.length - 1].focus();
    await userEvent.tab();

    expect(dentro[0]).toHaveFocus();
  });

  it('prende o foco: do primeiro, Shift+Tab volta ao último', async () => {
    await abrir();

    const dentro = screen
      .getAllByRole('button', { hidden: true })
      .filter((botao) => botao.closest('[role="dialog"]'));

    dentro[0].focus();
    await userEvent.tab({ shift: true });

    expect(dentro[dentro.length - 1]).toHaveFocus();
  });

  it('o Tab nunca alcança o que está atrás do diálogo', async () => {
    await abrir();

    // Cinco tabulações dão a volta no diálogo várias vezes. Se em alguma delas
    // o foco escapasse, ele pousaria no botão "Outra coisa", que está fora.
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await userEvent.tab();
    }

    expect(screen.getByRole('button', { name: 'Outra coisa' })).not.toHaveFocus();
  });
});
