// A lista de conversas diretas — AC-DM-05, AC-DM-06.
//
// Componente sem banco: recebe as conversas já ordenadas e decide como elas
// aparecem. A ordenação é do servidor, e é de propósito: reordenar aqui daria
// a ilusão de ordem certa sobre uma janela cortada no lugar errado.
import React from 'react';
import { formatarHora } from '../../services/tempo';

/** Quantos caracteres da última mensagem cabem na prévia. */
const TAMANHO_DA_PREVIA = 60;

export const TEXTO_CARREGANDO = 'Carregando as suas conversas...';

/** Quantas linhas cinzas o esqueleto desenha. */
const LINHAS_DO_ESQUELETO = 3;

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
 * @param {boolean} [props.carregando] antes do primeiro snapshot.
 * @param {(conversa: {id: string, outroUid: string, outroNome: string}) => void} [props.aoAbrir]
 */
export default function ListaConversas({ uid, conversas = [], carregando = false, aoAbrir }) {
  // "Não há conversa" e "ainda não sei se há" são coisas diferentes, e a lista
  // dizia a primeira nos dois casos. Quem abriu a aba para retomar uma
  // conversa lia que ela não existe (AC-ANIM-04).
  //
  // Só o carregamento **inicial**: com conversas já na tela, trocá-las por
  // barras cinzas a cada reemissão do `onSnapshot` piscaria a lista inteira.
  if (carregando && conversas.length === 0) {
    return (
      <>
        <p className="conversas-aviso" role="status">
          {TEXTO_CARREGANDO}
        </p>
        <div className="esqueleto-lista" aria-hidden="true">
          {Array.from({ length: LINHAS_DO_ESQUELETO }, (_, indice) => (
            <div className="esqueleto conversas-esqueleto-item" key={indice} />
          ))}
        </div>
      </>
    );
  }

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
