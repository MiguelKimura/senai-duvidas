// Uma escolha de sim ou não guardada neste navegador (v1.1.0).
//
// Para conveniências de quem está na máquina — como o "Não perguntar mais" da
// exclusão —, e não para nada que precise valer em outro lugar. A chave leva
// o uid, porque a máquina do laboratório é compartilhada: a escolha de um
// professor não pode valer para o próximo que entrar.
//
// Navegador com armazenamento bloqueado não quebra a tela: a leitura vale
// "não", e a escrita vale só até a aba fechar (AC-SESSAO-06).
import { useCallback, useEffect, useRef, useState } from 'react';

function gravar(chave, valor) {
  try {
    if (valor) window.localStorage.setItem(chave, '1');
    else window.localStorage.removeItem(chave);
  } catch (_erro) {
    // Ver acima.
  }
}

function ler(chave) {
  if (!chave) return false;

  try {
    return window.localStorage.getItem(chave) === '1';
  } catch (_erro) {
    return false;
  }
}

/**
 * @param {string|null} chave `null` enquanto não se sabe quem está logado.
 * @returns {[boolean, (valor: boolean) => void]}
 */
export function usePreferenciaLocal(chave) {
  const [valor, setValor] = useState(() => ler(chave));
  // A escolha feita antes de se saber quem está logado. Ela é gravada assim
  // que a chave chega, em vez de ser apagada pela leitura do navegador.
  const pendente = useRef(undefined);

  useEffect(() => {
    if (!chave) return;

    if (pendente.current !== undefined) {
      gravar(chave, pendente.current);
      pendente.current = undefined;
      return;
    }

    setValor(ler(chave));
  }, [chave]);

  const definir = useCallback(
    (novo) => {
      setValor(Boolean(novo));

      if (chave) gravar(chave, Boolean(novo));
      else pendente.current = Boolean(novo);
    },
    [chave]
  );

  return [valor, definir];
}
