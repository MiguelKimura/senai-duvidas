// Quem decide que a premiação vai aparecer — AC-PERK-04.
//
// `AnimacaoDePerk` sabe aparecer, pular e sair; não sabe nada sobre o banco.
// Esta é a peça que junta as duas metades: acha o perk que o aluno ainda não
// viu, mostra um de cada vez e grava o recibo que impede a repetição.
//
// **A fila local existe por causa de uma corrida real.** Entre fechar a tela
// cheia e o servidor confirmar `visualizadoEm`, o `onSnapshot` da sala
// continua entregando o perk com o campo nulo. Decidir só pelo banco reabriria
// a premiação nesse intervalo — no meio de uma prova, na frente da turma. Por
// isso a lista de "já mostrei nesta sessão" mora aqui, em memória, e é ela que
// manda enquanto o carimbo não volta.
//
// **Uma de cada vez, e a mais antiga primeiro.** Três premiações empilhadas
// seriam três diálogos modais sobrepostos, e nenhum deles fechável na ordem
// certa. Em fila, o aluno lê uma, pula, lê a próxima.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import AnimacaoDePerk from './AnimacaoDePerk';
import { marcarPerkVisualizado, perksDoAluno } from '../../services/perks';
import { paraData } from '../../services/tempo';
import { usePreferencias } from '../../hooks/usePreferencias';

/**
 * Os perks que o aluno ainda não viu, do mais antigo para o mais novo.
 *
 * Revogado não entra: comemorar um prêmio que o professor acabou de tirar
 * seria pior do que não comemorar nada. Expirado **entra** — um perk de sete
 * dias concedido enquanto o aluno estava fora ainda merece ser anunciado
 * quando ele volta, e a vitrine já o mostrará no histórico.
 *
 * @param {Array<object>} perks os perks da sala.
 * @param {string|null|undefined} uid quem está lendo.
 * @returns {Array<object>}
 */
export function premiacoesPendentes(perks = [], uid) {
  return perksDoAluno(perks, uid)
    .filter((perk) => !perk.visualizadoEm && !perk.revogadoEm)
    .sort((a, b) => {
      const primeiro = paraData(a.concedidoEm);
      const segundo = paraData(b.concedidoEm);

      if (primeiro && segundo) return primeiro.getTime() - segundo.getTime();
      if (primeiro) return -1;
      if (segundo) return 1;

      // Sem carimbo dos dois lados, o id desempata — mesma razão da fila:
      // ordem idêntica em qualquer dispositivo (AC-PERK-09).
      return String(a.id) < String(b.id) ? -1 : 1;
    });
}

/**
 * A premiação em tela cheia do aluno, quando existe uma para mostrar.
 *
 * @param {object} props
 * @param {string|null} props.salaId onde gravar o recibo.
 * @param {Array<object>} props.perks os perks que a sala já carregou — este
 *   componente não abre consulta nenhuma (AC-PERF-03).
 * @param {string|null|undefined} props.uid quem está lendo.
 */
export default function PremiacaoDaSala({ salaId, perks = [], uid }) {
  const { preferencias } = usePreferencias();

  // `useState` com `Set`, e não `useRef`: fechar a premiação precisa
  // redesenhar para a seguinte entrar. O `ref` guarda o mesmo conjunto para
  // que o `fechar` não dependa do estado que ele mesmo acabou de trocar.
  const [vistos, setVistos] = useState(() => new Set());
  const jaVistos = useRef(vistos);
  jaVistos.current = vistos;

  const pendentes = useMemo(() => premiacoesPendentes(perks, uid), [perks, uid]);
  const atual = pendentes.find((perk) => !vistos.has(perk.id)) || null;

  const fechar = useCallback(() => {
    if (!atual) return;

    setVistos(new Set(jaVistos.current).add(atual.id));

    // Sem `await` e sem `catch` aqui: `marcarPerkVisualizado` já engole a
    // falha e devolve `false`. A premiação fecha na hora, independentemente
    // do que o servidor responda — a restrição de produção é explícita.
    marcarPerkVisualizado(salaId, atual.id);
  }, [atual, salaId]);

  if (!atual) return null;

  return (
    <AnimacaoDePerk
      key={atual.id}
      perk={atual}
      preferencias={preferencias}
      aoFechar={fechar}
    />
  );
}
