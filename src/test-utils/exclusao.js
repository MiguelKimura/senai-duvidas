// O fluxo de exclusão de chamado, do ponto de vista de quem clica.
//
// Até a v0.9.0 excluir era um clique. A v0.10.0 acrescentou a confirmação
// (AC-CHAMADO-04) e a janela de cinco segundos para desfazer, e com isso todo
// teste que só queria "o chamado sai do banco" passou a precisar de três
// passos e de um relógio congelado.
//
// Este helper existe para que esses testes continuem falando do que eles
// realmente afirmam. As asserções deles não mudaram — o que mudou foi quantos
// cliques levam até lá.
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DURACAO_DA_SAIDA_MS, PRAZO_DE_DESFAZER_MS } from '../hooks/useExclusaoComDesfazer';

/**
 * Exclui um chamado de ponta a ponta: pede, confirma e deixa o prazo vencer.
 *
 * Precisa de um relógio congelado por `fixarRelogio`: a janela de desfazer é
 * um temporizador de cinco segundos, e esperá-lo em tempo real custaria cinco
 * segundos por teste e estouraria o teto de `waitFor`.
 *
 * @param {{avancar: (ms: number) => void}} relogio o retorno de `fixarRelogio`.
 * @param {HTMLElement} [dentroDe] o card, quando há mais de um na tela.
 */
export async function excluirChamadoNaTela(relogio, dentroDe) {
  const escopo = dentroDe ? within(dentroDe) : screen;

  await userEvent.click(escopo.getByRole('button', { name: 'Excluir' }));

  const dialogo = screen.getByRole('dialog');
  await userEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }));

  // A saída do card e o vencimento da janela, nessa ordem. Os dois
  // temporizadores nascem no mesmo instante, então um avanço só cobre ambos.
  act(() => relogio.avancar(DURACAO_DA_SAIDA_MS + PRAZO_DE_DESFAZER_MS));
}
