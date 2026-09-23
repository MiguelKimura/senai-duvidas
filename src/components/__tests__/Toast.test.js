// Os avisos do app — AC-ANIM-07, AC-ANIM-04, AC-ANIM-10.
//
// O que isto substitui é o `alert()`. A task 01 já o tirou do login e do
// cadastro, e a razão está escrita lá: ele bloqueia a aba inteira, some sem
// deixar o texto na tela e, em parte dos laboratórios, vem suprimido junto com
// o bloqueador de pop-up — o aluno clica, nada acontece, e ninguém sabe se deu
// certo. `TelaProfessor` é o último lugar onde ele resistiu.
//
// Três regras que este arquivo cobra e que não são enfeite:
//
//   * **o erro não some sozinho.** Um aviso de falha que desaparece em quatro
//     segundos é um aviso que a pessoa não leu. Ele espera uma ação;
//   * **nada some antes de quatro segundos.** É o piso da WCAG 2.2.1 para
//     conteúdo temporizado, e é o tempo de alguém que estava olhando para o
//     teclado levantar os olhos;
//   * **o leitor de tela ouve.** `aria-live="polite"`: anuncia quando a pessoa
//     parar de digitar, em vez de interromper no meio da frase.
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  DURACAO_MINIMA_MS,
  ProvedorDeToasts,
  TIPO_AVISO,
  TIPO_ERRO,
  TIPO_INFORMACAO,
  TIPO_SUCESSO,
  useToasts,
} from '../Toast';
import { fixarRelogio, restaurarRelogio } from '../../test-utils';

/** Um botão por variante, para disparar o toast de dentro de um componente. */
function Disparador({ chamadas = [] }) {
  const { mostrar, fechar } = useToasts();

  return (
    <div>
      {chamadas.map(({ rotulo, ...toast }) => (
        <button key={rotulo} type="button" onClick={() => mostrar(toast)}>
          {rotulo}
        </button>
      ))}
      <button type="button" onClick={() => fechar('fixo')}>
        fechar o fixo
      </button>
    </div>
  );
}

function montar(chamadas) {
  return render(
    <ProvedorDeToasts>
      <Disparador chamadas={chamadas} />
    </ProvedorDeToasts>
  );
}

/** Avança o relógio dentro de `act`, para o React processar o que ele disparar. */
function avancar(relogio, ms) {
  act(() => relogio.avancar(ms));
}

let relogio;

beforeEach(() => {
  relogio = fixarRelogio('2026-09-23T12:00:00.000Z');
});

afterEach(() => {
  restaurarRelogio();
});

describe('Toast — as quatro variantes (AC-ANIM-07)', () => {
  it.each([
    ['sucesso', TIPO_SUCESSO],
    ['erro', TIPO_ERRO],
    ['aviso', TIPO_AVISO],
    ['informação', TIPO_INFORMACAO],
  ])('mostra o texto de um toast de %s', async (rotulo, tipo) => {
    montar([{ rotulo, tipo, texto: `aviso de ${rotulo}` }]);

    await userEvent.click(screen.getByRole('button', { name: rotulo }));

    expect(screen.getByText(`aviso de ${rotulo}`)).toBeInTheDocument();
  });

  it('distingue a variante na marcação, e não só na cor', async () => {
    // Cor sozinha não é informação: quem não distingue vermelho de verde
    // precisa de outra pista, e o leitor de tela não enxerga cor nenhuma.
    montar([{ rotulo: 'erro', tipo: TIPO_ERRO, texto: 'deu ruim' }]);

    await userEvent.click(screen.getByRole('button', { name: 'erro' }));

    expect(screen.getByText('deu ruim').closest('[data-tipo]')).toHaveAttribute(
      'data-tipo',
      TIPO_ERRO
    );
  });
});

describe('Toast — quando some (AC-ANIM-07)', () => {
  it('não some antes de quatro segundos', async () => {
    montar([{ rotulo: 'ok', tipo: TIPO_SUCESSO, texto: 'chamado excluído' }]);
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));

    avancar(relogio, DURACAO_MINIMA_MS - 1);

    expect(screen.getByText('chamado excluído')).toBeInTheDocument();
  });

  it('some sozinho depois do prazo', async () => {
    montar([{ rotulo: 'ok', tipo: TIPO_SUCESSO, texto: 'chamado excluído' }]);
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));

    avancar(relogio, DURACAO_MINIMA_MS);

    expect(screen.queryByText('chamado excluído')).not.toBeInTheDocument();
  });

  it('respeita um prazo maior pedido por quem disparou', async () => {
    montar([
      { rotulo: 'longo', tipo: TIPO_SUCESSO, texto: 'com desfazer', duracaoMs: 5000 },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'longo' }));

    avancar(relogio, DURACAO_MINIMA_MS);
    expect(screen.getByText('com desfazer')).toBeInTheDocument();

    avancar(relogio, 1000);
    expect(screen.queryByText('com desfazer')).not.toBeInTheDocument();
  });

  it('nunca encurta o prazo abaixo do piso, mesmo se pedirem', async () => {
    montar([{ rotulo: 'curto', tipo: TIPO_SUCESSO, texto: 'piscou', duracaoMs: 500 }]);
    await userEvent.click(screen.getByRole('button', { name: 'curto' }));

    avancar(relogio, DURACAO_MINIMA_MS - 1);

    expect(screen.getByText('piscou')).toBeInTheDocument();
  });

  it('o de erro NÃO some sozinho — ele espera a pessoa', async () => {
    montar([{ rotulo: 'erro', tipo: TIPO_ERRO, texto: 'não deu para excluir' }]);
    await userEvent.click(screen.getByRole('button', { name: 'erro' }));

    avancar(relogio, DURACAO_MINIMA_MS * 10);

    expect(screen.getByText('não deu para excluir')).toBeInTheDocument();
  });

  it('o de erro sai quando a pessoa fecha', async () => {
    montar([{ rotulo: 'erro', tipo: TIPO_ERRO, texto: 'não deu para excluir' }]);
    await userEvent.click(screen.getByRole('button', { name: 'erro' }));

    await userEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));

    expect(screen.queryByText('não deu para excluir')).not.toBeInTheDocument();
  });
});

describe('Toast — a ação de desfazer (AC-CHAMADO-04)', () => {
  it('oferece o botão da ação que quem disparou pediu', async () => {
    const desfazer = jest.fn();
    montar([
      {
        rotulo: 'excluiu',
        tipo: TIPO_SUCESSO,
        texto: 'dúvida excluída',
        acao: { rotulo: 'Desfazer', aoAcionar: desfazer },
      },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'excluiu' }));

    expect(screen.getByRole('button', { name: 'Desfazer' })).toBeInTheDocument();
  });

  it('aciona e fecha o toast no clique', async () => {
    const desfazer = jest.fn();
    montar([
      {
        rotulo: 'excluiu',
        tipo: TIPO_SUCESSO,
        texto: 'dúvida excluída',
        acao: { rotulo: 'Desfazer', aoAcionar: desfazer },
      },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'excluiu' }));

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    expect(desfazer).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('dúvida excluída')).not.toBeInTheDocument();
  });

  it('não aciona a ação quando o prazo vence sem clique', async () => {
    const desfazer = jest.fn();
    montar([
      {
        rotulo: 'excluiu',
        tipo: TIPO_SUCESSO,
        texto: 'dúvida excluída',
        duracaoMs: 5000,
        acao: { rotulo: 'Desfazer', aoAcionar: desfazer },
      },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'excluiu' }));

    avancar(relogio, 5000);

    expect(desfazer).not.toHaveBeenCalled();
    expect(screen.queryByText('dúvida excluída')).not.toBeInTheDocument();
  });

  it('avisa quem disparou que o prazo venceu, para a gravação sair do limbo', async () => {
    // Sem este aviso a exclusão otimista ficaria pendurada para sempre: o card
    // sumiu da tela, o toast sumiu do canto e o documento continuaria no banco.
    const aoExpirar = jest.fn();
    montar([
      { rotulo: 'excluiu', tipo: TIPO_SUCESSO, texto: 'dúvida excluída', aoExpirar },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'excluiu' }));

    avancar(relogio, DURACAO_MINIMA_MS);

    expect(aoExpirar).toHaveBeenCalledTimes(1);
  });
});

describe('Toast — acessibilidade (AC-ANIM-10)', () => {
  it('anuncia com aria-live polite, sem interromper quem está digitando', async () => {
    montar([{ rotulo: 'ok', tipo: TIPO_SUCESSO, texto: 'gravado' }]);

    await userEvent.click(screen.getByRole('button', { name: 'ok' }));

    const regiao = screen.getByRole('status');

    expect(regiao).toHaveAttribute('aria-live', 'polite');
  });

  it('a região existe desde o primeiro render — senão o leitor não a observa', () => {
    // Uma região `aria-live` criada no mesmo instante em que recebe texto não é
    // anunciada: o leitor precisa já estar observando o nó quando ele muda.
    montar([]);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('todo toast tem botão de fechar alcançável por teclado', async () => {
    montar([{ rotulo: 'ok', tipo: TIPO_SUCESSO, texto: 'gravado' }]);
    await userEvent.click(screen.getByRole('button', { name: 'ok' }));

    const fechar = screen.getByRole('button', { name: 'Fechar aviso' });
    fechar.focus();

    expect(fechar).toHaveFocus();
  });

  it('empilha vários avisos em vez de um sobrescrever o outro', async () => {
    montar([
      { rotulo: 'um', tipo: TIPO_SUCESSO, texto: 'primeiro' },
      { rotulo: 'dois', tipo: TIPO_AVISO, texto: 'segundo' },
    ]);

    await userEvent.click(screen.getByRole('button', { name: 'um' }));
    await userEvent.click(screen.getByRole('button', { name: 'dois' }));

    expect(screen.getByText('primeiro')).toBeInTheDocument();
    expect(screen.getByText('segundo')).toBeInTheDocument();
  });
});
