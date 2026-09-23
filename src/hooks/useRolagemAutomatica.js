// A rolagem da conversa — AC-CHAT-05.
//
// A regra tem duas metades, e a segunda é a que costuma faltar:
//
//   1. chegou mensagem e a pessoa estava no fim  -> acompanha, em silêncio;
//   2. chegou mensagem e a pessoa tinha subido   -> avisa, e não mexe em nada.
//
// Um chat que só implementa a primeira metade é pior do que um que não rola:
// quem subiu para reler o que o professor explicou é arrancado dali toda vez
// que alguém da turma digita, e não há como terminar de ler nada.
//
// O hook não sabe o que é uma mensagem. Ele recebe uma **chave** que muda
// quando a conversa muda — o id da última mensagem serve — e reage a isso. É o
// que permite usá-lo igual na aba da sala e na conversa direta.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Quantos pixels de sobra ainda contam como "no fim".
 *
 * Não é zero por dois motivos. Zoom de navegador e fontes fracionárias deixam
 * `scrollHeight - scrollTop - clientHeight` num valor como 0,5 mesmo com a
 * barra encostada embaixo. E a última linha de um balão ficar meio pixel para
 * fora não é alguém lendo o histórico.
 */
export const TOLERANCIA_DO_FIM = 24;

/** A barra de rolagem está encostada no fim, dentro da tolerância. */
function estaNoFim(elemento) {
  if (!elemento) return true;

  return (
    elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight <= TOLERANCIA_DO_FIM
  );
}

/**
 * Mantém a conversa acompanhando o fim, sem atropelar quem está lendo.
 *
 * @param {string|number|null} chave muda quando há mensagem nova. O id da
 *   última mensagem é a escolha natural: a mesma chave duas vezes não é
 *   novidade, e o hook não redesenha nada por causa disso.
 * @returns {{
 *   referencia: React.RefObject<HTMLElement>,
 *   temNovas: boolean,
 *   irParaOFim: () => void
 * }}
 */
export function useRolagemAutomatica(chave) {
  const referencia = useRef(null);
  const [temNovas, setTemNovas] = useState(false);

  // Onde a pessoa estava ANTES de a mensagem nova chegar. Precisa ser `ref`, e
  // não estado: o valor é lido dentro do efeito que reage à chave, e um estado
  // atualizado no `scroll` ainda não teria propagado naquele instante.
  const seguindoOFim = useRef(true);
  const ultimaChave = useRef(chave);

  /** Encosta a rolagem no fim e desliga o aviso. */
  const irParaOFim = useCallback(() => {
    const elemento = referencia.current;

    if (elemento) elemento.scrollTop = elemento.scrollHeight;

    seguindoOFim.current = true;
    setTemNovas(false);
  }, []);

  // `useLayoutEffect` porque a rolagem precisa acontecer no mesmo quadro em que
  // o balão entrou: com `useEffect`, o navegador chega a pintar a conversa na
  // posição antiga e a tela pula.
  useLayoutEffect(() => {
    if (chave === ultimaChave.current) return;

    ultimaChave.current = chave;

    if (seguindoOFim.current) {
      irParaOFim();
      return;
    }

    setTemNovas(true);
  }, [chave, irParaOFim]);

  // A primeira pintura abre a conversa no fim: é a mensagem de agora que
  // interessa a quem acabou de entrar, não a de duas horas atrás.
  useLayoutEffect(() => {
    irParaOFim();
  }, [irParaOFim]);

  useEffect(() => {
    const elemento = referencia.current;
    if (!elemento) return undefined;

    const aoRolar = () => {
      const noFim = estaNoFim(elemento);
      seguindoOFim.current = noFim;

      // Voltar ao fim por conta própria já viu o que havia para ver: manter o
      // aviso aceso depois disso seria pedir um clique que não faz nada.
      if (noFim) setTemNovas(false);
    };

    elemento.addEventListener('scroll', aoRolar);

    return () => elemento.removeEventListener('scroll', aoRolar);
  }, []);

  return { referencia, temNovas, irParaOFim };
}
