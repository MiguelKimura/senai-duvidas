// Esqueleto do ciclo 7: o hook existe e não escuta nada ainda.
import { useEffect } from 'react';

export default function useColarImagem(aoColar, { ativo = true } = {}) {
  useEffect(() => {
    if (!ativo || !aoColar) return undefined;

    return undefined;
  }, [aoColar, ativo]);
}
