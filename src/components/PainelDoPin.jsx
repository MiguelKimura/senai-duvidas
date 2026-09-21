// O PIN em destaque, com cópia num clique — AC-SALA-03.
//
// Aparece em dois lugares: quando a sala nasce e quando o PIN é regerado
// (AC-SALA-09). Nos dois, a regra é a mesma — o número está só na memória
// desta aba, porque o banco guarda apenas o resumo dele (AC-SEC-05). Fechar a
// aba perde o PIN, e a única saída é regerar. O aviso não é decoração: é a
// diferença entre o professor anotar agora e a turma inteira ficar de fora.
import React, { useCallback, useState } from 'react';

/** Quanto tempo o "Copiado!" fica na tela. */
const DURACAO_DO_AVISO_MS = 3000;

/**
 * Mostra o PIN e oferece a cópia.
 *
 * @param {{pin: string, titulo?: string}} props
 */
export default function PainelDoPin({ pin, titulo = 'PIN da sala' }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = useCallback(async () => {
    try {
      // Navegador antigo ou página sem HTTPS não tem a API. Aí não há o que
      // fazer além de deixar o número selecionável na tela, que é o estado em
      // que ele já está.
      await navigator.clipboard?.writeText(pin);
      setCopiado(true);
      setTimeout(() => setCopiado(false), DURACAO_DO_AVISO_MS);
    } catch {
      setCopiado(false);
    }
  }, [pin]);

  return (
    <div className="painel-do-pin">
      <h2>{titulo}</h2>

      <p className="painel-do-pin-numero" data-testid="pin-em-destaque">
        {pin}
      </p>

      <button type="button" className="salas-acao" onClick={copiar}>
        Copiar PIN
      </button>

      {copiado && (
        <span className="painel-do-pin-copiado" role="status">
          Copiado!
        </span>
      )}

      <p className="painel-do-pin-aviso">
        Anote agora: o PIN aparece uma única vez. O sistema guarda só o resumo dele, então
        ninguém — nem o suporte — consegue recuperá-lo depois. Se perder, gere um novo.
      </p>
    </div>
  );
}
