// Os perks da sala, carregados uma vez e mantidos em memória — AC-PERF-03.
//
// A restrição da task é explícita: "perks ativos de uma sala cabem em uma
// consulta só, carregada uma vez por sessão e mantida em memória — nunca uma
// consulta por chamado renderizado". Este hook é o lugar onde isso é verdade.
//
// A tentação era resolver o perk dentro do card: cada `problema-card` sabe o
// `autorUid`, e uma leitura ali seria a linha mais curta de escrever. Também
// seriam 200 leituras por abertura do app no alvo declarado do projeto — por
// sessão, por aluno, em cada uma das 10 salas. Uma consulta por sala resolve
// a mesma pergunta e cabe no plano gratuito.
//
// O que sai daqui já vem mastigado para a fila: o índice por uid (consulta em
// O(1) durante a ordenação) e o instante do servidor, que é quem julga
// validade de perk (AC-PERK-03) — nunca o relógio da máquina.
import { useEffect, useMemo, useState } from 'react';
import { carimbosConhecidos, observarPerksDaSala } from '../services/perks';
import { indexarPerksPorUid, ordenarFila } from '../services/filaChamados';
import { agoraDoServidor } from '../services/tempo';

/**
 * Escuta os perks da sala e devolve a fila já ordenada com eles.
 *
 * `agoraServidor` é recalculado a cada mudança de chamados ou de perks, e não
 * a cada segundo: a expiração de um perk é medida em dias, e um `setInterval`
 * redesenhando a fila da turma inteira para adiantar essa conta em um minuto
 * custaria mais do que resolve. Qualquer escrita na sala — chamado novo,
 * premiação nova — já reposiciona o piso.
 *
 * @param {string|null} salaId sem sala não há perk: ele vive dentro da sala.
 * @param {Array<object>} chamados a fila crua, como veio do `onSnapshot`.
 * @returns {{perks: Array<object>, perksPorUid: Map<string, Array<object>>,
 *   agoraServidor: Date, fila: Array<object>}}
 */
export function usePerksDaSala(salaId, chamados = []) {
  const [perks, setPerks] = useState([]);

  useEffect(() => {
    // A sala mudou: o índice da anterior não vale mais nada, e mantê-lo
    // enquanto a consulta nova não responde daria prioridade, por um quadro,
    // a quem foi premiado em outra turma.
    setPerks([]);

    return observarPerksDaSala(salaId, setPerks);
  }, [salaId]);

  const agoraServidor = useMemo(
    () => agoraDoServidor(carimbosConhecidos(chamados, perks)),
    [chamados, perks]
  );

  const perksPorUid = useMemo(() => indexarPerksPorUid(perks), [perks]);

  const fila = useMemo(
    () => ordenarFila(chamados, perksPorUid, agoraServidor),
    [chamados, perksPorUid, agoraServidor]
  );

  return { perks, perksPorUid, agoraServidor, fila };
}
