// A vitrine "Minhas conquistas" — AC-PERK-06.
//
// A animação acontece uma vez, a insígnia aparece enquanto o perk vale, e
// nenhuma das duas responde à pergunta que o aluno faz em dezembro: "o que eu
// ganhei esse ano?". É esta tela que responde.
//
// O perk vencido **não some** — muda de coluna. Apagá-lo transformaria o
// reconhecimento num aluguel de trinta dias, que é o oposto do que o cliente
// pediu, e é por isso que revogar é um campo e o `delete` está negado na rule.
//
// Sem banco: recebe os perks que a sala já carregou (AC-PERF-03).
import React from 'react';
import { perksDoAluno, rotuloDoTipo, separarConquistas } from '../../services/perks';
import { formatarDataHora } from '../../services/tempo';
import '../../styles/Perks.css';

/** O que a vitrine diz a quem ainda não foi premiado. */
export const VITRINE_VAZIA =
  'Você ainda não recebeu nenhuma premiação nesta sala. Elas aparecem aqui quando o professor conceder uma.';

/** A validade em texto, incluindo o caso do perk que não vence. */
function validade(perk) {
  if (!perk.expiraEm) return 'Permanente';

  return `Vale até ${formatarDataHora(perk.expiraEm)}`;
}

/** Uma linha da vitrine. */
function Conquista({ perk, ativo }) {
  const classes = `perk-vitrine-item${ativo ? '' : ' perk-vitrine-item--expirado'}`;

  return (
    <li className={classes}>
      <strong>
        {rotuloDoTipo(perk.tipo)} — nível {Number(perk.nivel) || 1}
      </strong>

      {/* A justificativa é o que dá sentido ao prêmio. Sem ela, a vitrine é
          uma lista de substantivos, e o aluno não sabe o que repetir. */}
      {perk.justificativa && <p className="perk-vitrine-justificativa">{perk.justificativa}</p>}

      <p className="perk-vitrine-origem">
        Concedida por {perk.concedidoPorNome || 'seu professor'} em{' '}
        {formatarDataHora(perk.concedidoEm)}
      </p>

      <p className="perk-vitrine-validade">
        {perk.revogadoEm ? 'Revogada pelo professor' : validade(perk)}
      </p>
    </li>
  );
}

/** Uma das colunas, ou nada quando ela está vazia. */
function Coluna({ titulo, perks, ativo }) {
  if (perks.length === 0) return null;

  return (
    <>
      <h4 className="perk-vitrine-coluna">{titulo}</h4>

      <ul className="perk-vitrine-lista" aria-label={titulo}>
        {perks.map((perk) => (
          <Conquista key={perk.id} perk={perk} ativo={ativo} />
        ))}
      </ul>
    </>
  );
}

/**
 * As premiações de quem está lendo, em duas colunas.
 *
 * @param {object} props
 * @param {Array<object>} props.perks os perks da sala, como a sala os leu.
 * @param {string|null} props.uid de quem é a vitrine.
 * @param {Date|import('firebase/firestore').Timestamp|string|null} props.agoraServidor
 *   o instante que decide a coluna de cada perk (AC-PERK-03).
 */
export default function VitrineDeConquistas({ perks = [], uid, agoraServidor }) {
  const meus = perksDoAluno(perks, uid);
  const { ativos, expirados } = separarConquistas(meus, agoraServidor);

  return (
    <section className="perk-vitrine" aria-label="Minhas conquistas">
      <h3>Minhas conquistas</h3>

      {meus.length === 0 ? (
        <p className="perk-vitrine-vazio">{VITRINE_VAZIA}</p>
      ) : (
        <>
          <Coluna titulo="Premiações ativas" perks={ativos} ativo />
          <Coluna titulo="Histórico" perks={expirados} ativo={false} />
        </>
      )}
    </section>
  );
}
