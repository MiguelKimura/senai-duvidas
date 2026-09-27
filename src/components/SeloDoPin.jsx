// O PIN da sala sempre à vista para o dono (v1.1.0).
//
// Até a v1.1.0 o PIN aparecia uma única vez, na criação da sala: o sistema
// guardava só o resumo, e o professor que perdia o papel precisava gerar um
// novo. Agora o PIN fica guardado no segredo da sala — que só o dono lê — e
// este selo o mostra num canto da tela durante a aula inteira, para o aluno
// que chegou atrasado.
import React, { useCallback, useEffect, useState } from 'react';
import { lerPinGuardado, regerarPin } from '../services/salas';

const ERRO = 'Não foi possível gerar o PIN agora. Tente de novo em instantes.';

/**
 * @param {{salaId: string, podeGerar?: boolean}} props `podeGerar` é falso na
 *   sala arquivada, que não aceita mais ninguém.
 */
export default function SeloDoPin({ salaId, podeGerar = true }) {
  const [pin, setPin] = useState(null);
  const [carregado, setCarregado] = useState(false);
  const [erro, setErro] = useState(null);
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    let vivo = true;

    lerPinGuardado(salaId)
      .then((lido) => {
        if (!vivo) return;
        setPin(lido);
        setCarregado(true);
      })
      .catch(() => {
        if (vivo) setCarregado(true);
      });

    return () => {
      vivo = false;
    };
  }, [salaId]);

  const gerar = useCallback(async () => {
    setErro(null);
    setGerando(true);

    try {
      setPin(await regerarPin(salaId));
    } catch {
      setErro(ERRO);
    } finally {
      setGerando(false);
    }
  }, [salaId]);

  return (
    <section className="selo-do-pin" aria-label="PIN da sala">
      <span className="selo-do-pin-rotulo">PIN da sala</span>

      {pin ? (
        <span className="selo-do-pin-numero">{pin}</span>
      ) : (
        carregado && <span className="selo-do-pin-ausente">Ainda não guardado</span>
      )}

      {podeGerar && carregado && (
        <button type="button" className="selo-do-pin-gerar" disabled={gerando} onClick={gerar}>
          Gerar novo PIN
        </button>
      )}

      {erro && (
        <span className="selo-do-pin-erro" role="alert">
          {erro}
        </span>
      )}
    </section>
  );
}
