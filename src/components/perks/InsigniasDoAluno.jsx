// A insígnia do perk — AC-PERK-05.
//
// A premiação em tela cheia acontece uma vez e acaba. A insígnia é o que
// sobra dela, e é o que torna o reconhecimento público — que é o valor que o
// cliente descreveu, e não a mecânica.
//
// No card do chamado ela tem uma segunda função, menos óbvia e mais
// importante: explicar por que aquele chamado está acima dos outros. Um
// chamado que fura a fila sem dizer o motivo parece erro do sistema, ou
// favorecimento; com a insígnia ao lado do nome, é uma decisão do professor,
// visível para a turma inteira.
//
// Sem banco e sem relógio: recebe o índice que a sala já carregou e o instante
// do servidor. É isso que permite usá-lo em cada card e em cada balão do chat
// sem uma consulta por elemento renderizado (AC-PERF-03).
import React from 'react';
import { perkEstaAtivo } from '../../services/filaChamados';
import { rotuloDoTipo } from '../../services/perks';
import '../../styles/Perks.css';

/** O símbolo de cada tipo. Decoração: o rótulo em texto vai sempre junto. */
const SIMBOLO_DO_TIPO = {
  prioridade: '⚡',
  destaque: '★',
  colaborador: '🤝',
  resolvedor: '🧩',
};

/**
 * Os perks de um aluno, aceitando o `Map` do índice e o objeto puro.
 *
 * Mesma leitura dupla de `filaChamados.perksDe`, pelo mesmo motivo: o `Map` é
 * o que a sala produz, o objeto é o que um teste — ou um chamador futuro —
 * escreveria à mão.
 */
function perksDe(indice, uid) {
  if (!uid || !indice) return [];

  const encontrados = typeof indice.get === 'function' ? indice.get(uid) : indice[uid];

  if (!encontrados) return [];

  return Array.isArray(encontrados) ? encontrados : [encontrados];
}

/**
 * As insígnias dos perks ativos de um aluno.
 *
 * Aluno sem perk não desenha nem o invólucro: um `<span>` vazio em cada card
 * de cada fila da escola mexeria no espaçamento de uma tela que o cliente
 * reconhece e que nenhuma task desta série tem permissão para repaginar.
 *
 * @param {object} props
 * @param {Map<string, Array<object>>|object} props.perks índice por uid, de
 *   `indexarPerksPorUid`.
 * @param {string|null|undefined} props.uid de quem são as insígnias.
 *   Ausente — como no chamado da v0.1.0, que não tem `autorUid` — não desenha.
 * @param {Date|import('firebase/firestore').Timestamp|string|null} props.agoraServidor
 *   o instante que julga a validade (AC-PERK-03). Nunca o relógio da máquina.
 */
export default function InsigniasDoAluno({ perks, uid, agoraServidor }) {
  const ativos = perksDe(perks, uid).filter((perk) => perkEstaAtivo(perk, agoraServidor));

  if (ativos.length === 0) return null;

  return (
    <span className="perk-insignias">
      {ativos.map((perk) => {
        const rotulo = rotuloDoTipo(perk.tipo);
        const nivel = Number(perk.nivel) || 1;

        return (
          <span
            key={perk.id}
            className={`perk-insignia perk-insignia--${perk.tipo}`}
            // O `title` carrega o nível porque o número sozinho, ao lado do
            // nome, seria lido como parte dele: "Ana Souza Colaborador 2".
            title={`${rotulo} — nível ${nivel}`}
          >
            <span aria-hidden="true">{SIMBOLO_DO_TIPO[perk.tipo] || '★'}</span>
            {rotulo}
          </span>
        );
      })}
    </span>
  );
}
