// A lista de mensagens — AC-CHAT-03, AC-CHAT-05, AC-CHAT-06.
//
// Três responsabilidades, e nenhuma delas é falar com o banco:
//
//   * decidir quais mensagens continuam o bloco anterior (AC-CHAT-03);
//   * manter a rolagem colada no fim sem atropelar quem subiu (AC-CHAT-05);
//   * oferecer a conversa anterior à janela, sob demanda (AC-CHAT-06).
//
// O agrupamento mora aqui porque é uma decisão sobre a mensagem **anterior**, e
// um balão não conhece o balão de cima.
import React from 'react';
import Mensagem from './Mensagem';
import { useRolagemAutomatica } from '../../hooks/useRolagemAutomatica';
import { paraData } from '../../services/tempo';

/**
 * Quanto tempo duas falas do mesmo autor ainda contam como um bloco.
 *
 * Cinco minutos é a conversa contínua de uma aula. Sem este corte, a resposta
 * que o professor dá às 14h gruda na frase que ele disse às 8h: um bloco só,
 * com um cabeçalho lá em cima, atravessando a manhã inteira.
 */
export const INTERVALO_DE_AGRUPAMENTO_MS = 5 * 60 * 1000;

/**
 * Quem falou, na ordem da compatibilidade retroativa.
 *
 * `autorUid` primeiro; `email` para a mensagem da v0.1.0. O `nome` **não**
 * entra: dois alunos chamados "Ana" na mesma turma teriam as falas agrupadas
 * como se fossem a mesma pessoa, e é o tipo de erro que ninguém reporta porque
 * parece um detalhe de layout.
 */
function identidade(mensagem) {
  return mensagem.autorUid || mensagem.email || null;
}

/**
 * A mensagem continua o bloco da anterior (AC-CHAT-03).
 *
 * @param {object|undefined} anterior
 * @param {object} atual
 * @returns {boolean}
 */
export function ehContinuacao(anterior, atual) {
  if (!anterior) return false;

  const quem = identidade(atual);
  if (!quem || identidade(anterior) !== quem) return false;

  const antes = paraData(anterior.horario);
  const agora = paraData(atual.horario);

  // Sem horário legível nos dois lados não há como medir a distância, e
  // agrupar no escuro juntaria mensagens de horas diferentes. Mesma pessoa,
  // cabeçalho repetido: barato, e honesto.
  if (!antes || !agora) return false;

  return agora.getTime() - antes.getTime() <= INTERVALO_DE_AGRUPAMENTO_MS;
}

/**
 * A conversa, do mais antigo para o mais recente.
 *
 * @param {object} props
 * @param {Array<object>} props.mensagens já ordenadas por horário crescente.
 * @param {string|null} [props.uid] quem está lendo — decide o lado do balão.
 * @param {boolean} [props.temMais] há conversa antes da janela carregada.
 * @param {boolean} [props.carregando] a primeira página ainda não chegou.
 * @param {() => void} [props.aoCarregarAnteriores]
 * @param {(mensagem: object) => React.ReactNode} [props.insigniasDe] ponto de
 *   extensão da task 07.
 */
export default function ListaMensagens({
  mensagens = [],
  uid = null,
  temMais = false,
  carregando = false,
  aoCarregarAnteriores,
  insigniasDe,
}) {
  const ultima = mensagens[mensagens.length - 1];
  const { referencia, temNovas, irParaOFim } = useRolagemAutomatica(ultima ? ultima.id : null);

  return (
    <div className="mensagens">
      <div className="mensagens-rolagem" ref={referencia}>
        {temMais && (
          <button type="button" className="mensagens-anteriores" onClick={aoCarregarAnteriores}>
            Ver mensagens anteriores
          </button>
        )}

        {carregando && mensagens.length === 0 && (
          <p className="mensagens-aviso" role="status">
            Carregando a conversa...
          </p>
        )}

        {!carregando && mensagens.length === 0 && (
          <p className="mensagens-aviso">Nenhuma mensagem por aqui ainda. Comece a conversa.</p>
        )}

        <ul className="mensagens-lista">
          {mensagens.map((mensagem, indice) => (
            <Mensagem
              key={mensagem.id}
              mensagem={mensagem}
              ehMinha={Boolean(uid) && mensagem.autorUid === uid}
              agrupada={ehContinuacao(mensagens[indice - 1], mensagem)}
              insignias={insigniasDe ? insigniasDe(mensagem) : undefined}
            />
          ))}
        </ul>
      </div>

      {temNovas && (
        <button type="button" className="mensagens-novas" onClick={irParaOFim}>
          Novas mensagens
        </button>
      )}
    </div>
  );
}
