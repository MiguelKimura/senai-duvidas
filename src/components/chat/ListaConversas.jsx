// A lista de conversas diretas — AC-DM-05, AC-DM-06.
//
// Componente sem banco: recebe as conversas já ordenadas e decide como elas
// aparecem. A ordenação é do servidor, e é de propósito: reordenar aqui daria
// a ilusão de ordem certa sobre uma janela cortada no lugar errado.
import React from 'react';
import { formatarHora } from '../../services/tempo';

/** Quantos caracteres da última mensagem cabem na prévia. */
const TAMANHO_DA_PREVIA = 60;

/**
 * O outro lado da conversa.
 *
 * Uma conversa tem dois participantes e quem lê é um deles. O que interessa na
 * lista é sempre o outro — ninguém procura a própria conversa pelo próprio
 * nome.
 */
function outroLado(conversa, uid) {
  const participantes = conversa.participantes || [];
  const outroUid = participantes.find((participante) => participante !== uid) || null;
  const nomes = conversa.participantesNomes || {};

  return { outroUid, outroNome: nomes[outroUid] || 'Alguém da sala' };
}

/** Quantas mensagens **quem está lendo** ainda não viu (AC-DM-05). */
function naoLidasDe(conversa, uid) {
  return Number((conversa.naoLidas || {})[uid]) || 0;
}

function previa(conversa) {
  const texto = conversa.ultimaMensagem ? conversa.ultimaMensagem.texto || '' : '';

  return texto.length > TAMANHO_DA_PREVIA
    ? `${texto.slice(0, TAMANHO_DA_PREVIA)}…`
    : texto || 'Conversa sem mensagens ainda.';
}

/**
 * As conversas diretas de quem está lendo.
 *
 * @param {object} props
 * @param {string} props.uid quem está lendo.
 * @param {Array<object>} props.conversas já ordenadas pela mais recente.
 * @param {(conversa: {id: string, outroUid: string, outroNome: string}) => void} [props.aoAbrir]
 */
export default function ListaConversas({ uid, conversas = [], aoAbrir }) {
  if (conversas.length === 0) {
    return (
      <p className="conversas-aviso">
        Nenhuma conversa por aqui ainda. Comece uma em &quot;Nova conversa&quot;.
      </p>
    );
  }

  return (
    <ul className="conversas">
      {conversas.map((conversa) => {
        const { outroUid, outroNome } = outroLado(conversa, uid);
        const naoLidas = naoLidasDe(conversa, uid);

        return (
          <li key={conversa.id}>
            <button
              type="button"
              className="conversa-item"
              onClick={() => aoAbrir && aoAbrir({ id: conversa.id, outroUid, outroNome })}
            >
              <span className="conversa-nome">{outroNome}</span>
              <span className="conversa-previa">{previa(conversa)}</span>

              {conversa.ultimaMensagem && (
                <time className="conversa-horario">
                  {formatarHora(conversa.ultimaMensagem.horario)}
                </time>
              )}

              {/* Bolinha com zero dentro não informa nada e ainda chama atenção. */}
              {naoLidas > 0 && <span className="conversa-nao-lidas">{naoLidas}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
