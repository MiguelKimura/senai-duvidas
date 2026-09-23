// A aparência do card, num lugar só — AC-COR-03, AC-COR-04, AC-COR-05.
//
// O card do aluno e o do professor mostram o mesmo chamado e precisam mostrá-lo
// igual. Até a v0.5.0 os dois eram JSX copiado, e a task 04 encontrou as duas
// cópias já divergentes — uma chamava `visualizarImagem`, a outra
// `visualizarAnexo`. Uma função só é o que impede a terceira divergência.
import { corDaPaleta } from './paleta';

/**
 * As classes do card, incluindo as de movimento (AC-ANIM-02).
 *
 * `entra-na-lista` está em todo card, e o escalonamento vem do
 * `--indice-na-lista` que a tela escreve inline; `sai-da-lista` entra só
 * enquanto o card está sendo excluído. As duas são de `styles/animacoes.css`,
 * e somem sozinhas para quem pediu menos movimento ao sistema operacional.
 *
 * @param {{saindo?: boolean}} [estado]
 * @returns {string}
 */
export function classesDoCard({ saindo = false } = {}) {
  return saindo ? 'problema-card entra-na-lista sai-da-lista' : 'problema-card entra-na-lista';
}

/**
 * O `style` inline do card de um chamado.
 *
 * A cor de fundo é a que estiver gravada, seja ela da paleta ou o `hsl()`
 * sorteado dos chamados antigos — é o campo `cor` de sempre, sem tradução.
 *
 * A cor do **texto** só é definida quando a cor de fundo é da paleta, porque
 * só aí ela foi verificada contra o mínimo de contraste do WCAG. Para a cor
 * sorteada, o `style` sai sem `color` e o CSS do card continua mandando —
 * qualquer outra escolha mudaria a aparência de chamados que já existem
 * (AC-COR-05).
 *
 * @param {{cor?: string|null}} chamado
 * @returns {{backgroundColor: string|undefined, color: string|undefined}}
 */
export function estiloDoCard(chamado) {
  const cor = chamado && chamado.cor;
  const entrada = corDaPaleta(cor);

  return {
    backgroundColor: cor || undefined,
    color: entrada ? entrada.texto : undefined,
  };
}
