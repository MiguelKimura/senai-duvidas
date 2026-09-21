// A rolagem da conversa.
//
// PASSO 1: o comportamento da v0.7.0, que é não ter nenhum. O hook devolve a
// referência e nada mais — é o incumbente contra o qual
// `__tests__/useRolagemAutomatica.test.js` está vermelho.
import { useRef } from 'react';

export function useRolagemAutomatica() {
  const referencia = useRef(null);

  return { referencia, temNovas: false, irParaOFim: () => {} };
}
