// `prefers-reduced-motion` lido do sistema operacional — AC-ANIM-05.
//
// O CSS já respeita a preferência com `@media (prefers-reduced-motion: reduce)`,
// e para a maioria das animações isso basta. Não basta aqui: a premiação em
// tela cheia não é um `transition` que se possa zerar — ela tem um cronômetro
// que a fecha sozinha, e quem pediu menos movimento precisa de tempo para ler
// em vez de um card que some em dois segundos e meio. A decisão é de
// comportamento, e comportamento mora no JavaScript.
import { useEffect, useState } from 'react';

export const CONSULTA_DE_MOVIMENTO_REDUZIDO = '(prefers-reduced-motion: reduce)';

/**
 * A consulta de mídia, ou `null` onde `matchMedia` não existe.
 *
 * O jsdom dos testes não a traz, e navegadores antigos podem não trazer a
 * consulta específica. `null` significa "não dá para saber", e quem não sabe
 * não deve supor que a pessoa pediu menos movimento — a animação é o requisito.
 */
function consultar() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;

  try {
    return window.matchMedia(CONSULTA_DE_MOVIMENTO_REDUZIDO);
  } catch {
    return null;
  }
}

/**
 * A pessoa pediu menos movimento ao sistema operacional.
 *
 * Reage à mudança em tempo real: quem liga a opção no meio da aula não precisa
 * recarregar a página. `addEventListener` com queda para `addListener` — o
 * segundo é o que o Safari expõe até versões recentes, e a lista de
 * compatibilidade do projeto inclui navegadores desatualizados de laboratório.
 *
 * @returns {boolean}
 */
export function useMovimentoReduzido() {
  const [reduzido, setReduzido] = useState(() => {
    const consulta = consultar();

    return Boolean(consulta && consulta.matches);
  });

  useEffect(() => {
    const consulta = consultar();
    if (!consulta) return undefined;

    const aoMudar = (evento) => setReduzido(Boolean(evento.matches));

    setReduzido(Boolean(consulta.matches));

    if (typeof consulta.addEventListener === 'function') {
      consulta.addEventListener('change', aoMudar);
      return () => consulta.removeEventListener('change', aoMudar);
    }

    if (typeof consulta.addListener === 'function') {
      consulta.addListener(aoMudar);
      return () => consulta.removeListener(aoMudar);
    }

    return undefined;
  }, []);

  return reduzido;
}
