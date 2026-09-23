import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { limit, onSnapshot, query } from 'firebase/firestore';

import { LIMITE_DE_CHAMADOS, PAPEL_DE_PROFESSOR, colecaoDeChamados } from '../services/salas';
import { excluirChamado, marcarAtendido } from '../services/chamados';

import { usePerksDaSala } from '../hooks/usePerksDaSala';
import {
  DESCRICAO_DA_CONFIRMACAO,
  TITULO_DA_CONFIRMACAO,
  useExclusaoComDesfazer,
} from '../hooks/useExclusaoComDesfazer';
import { TIPO_ERRO, useToasts } from './Toast';
import CardDoChamado from './CardDoChamado';
import ConfirmarAcao from './ConfirmarAcao';
import FilaDeChamados from './FilaDeChamados';
import InsigniasDoAluno from './perks/InsigniasDoAluno';
import PainelDePerks from './perks/PainelDePerks';
import '../styles/TelaProfessor.css';
import Chat from './chat/Chat';
import BotaoSair from './BotaoSair';

/** O que a tela diz quando o servidor recusa marcar o chamado. */
export const AVISO_DE_FALHA_AO_ATENDER =
  'Não foi possível atualizar o chamado. Tente de novo em instantes.';

/** O que a tela diz quando o servidor recusa a leitura da fila. */
export const ERRO_AO_CARREGAR =
  'Não foi possível carregar a fila de dúvidas. Verifique a conexão.';

/** A turma ainda não abriu nada — o professor não é quem abre chamado. */
export const FILA_VAZIA = 'Nenhuma dúvida por aqui ainda. A turma ainda não chamou.';

// A tela do professor, agora dentro de uma sala (AC-SALA-07).
//
// A fila que ele vê é a da turma dele, e não mais a da escola inteira. Sem
// `salaId`, cai na coleção global da v0.4.0 pelo mesmo fallback da tela do
// aluno — o que mantém a tela útil enquanto a migração não rodou.
//
// A v0.10.0 troca o `alert()` da exclusão por toast e acrescenta o "marcar
// como atendido" (AC-CHAMADO-06). Os dois resolvem o mesmo problema pelo qual
// o professor apagava chamado: tirar da frente o que já foi resolvido. Marcar
// preserva o histórico da aula; apagar, não — e por isso marcar é um clique e
// apagar pede confirmação.
function TelaProfessor({ salaId = null, somenteLeitura = false, ehDono = false }) {
  const [problemas, setProblemas] = useState([]);
  // Mesma distinção da tela do aluno: "ainda carregando", "não há dúvida" e
  // "não deu para ler" são três coisas, e a v0.9.0 mostrava a mesma área vazia
  // para as três (AC-ANIM-04, AC-CHAMADO-10).
  const [carregando, setCarregando] = useState(true);
  const [erroDaFila, setErroDaFila] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  const { mostrar } = useToasts();

  // A fila que a tela desenha sai daqui, e não do estado cru: a ordem dela
  // depende dos perks da sala, e quem os carrega — uma vez, não uma por card —
  // é este hook (AC-PERK-02, AC-PERF-03).
  const { fila, perks, perksPorUid, agoraServidor } = usePerksDaSala(salaId, problemas);

  const excluir = useCallback((chamado) => excluirChamado(salaId, chamado), [salaId]);

  const { emConfirmacao, pedirExclusao, confirmar, cancelar, estaSaindo, estaOculto } =
    useExclusaoComDesfazer({ excluir });

  const visiveis = useMemo(
    () => fila.filter((problema) => !estaOculto(problema.id)),
    [fila, estaOculto]
  );

  /**
   * Alterna o atendimento do chamado (AC-CHAMADO-06).
   *
   * Sem confirmação de propósito: a ação é reversível no mesmo botão, e uma
   * caixa de diálogo a cada chamado atendido atrapalharia justamente o
   * professor que está dando conta da fila.
   */
  const alternarAtendido = useCallback(
    async (chamado) => {
      try {
        await marcarAtendido(salaId, chamado.id, !chamado.atendido);
      } catch {
        mostrar({ tipo: TIPO_ERRO, texto: AVISO_DE_FALHA_AO_ATENDER });
      }
    },
    [salaId, mostrar]
  );

  // A mesma insígnia do card, ao lado do nome no chat. O índice e o instante
  // são os que a sala já carregou: o chat não abre consulta de perk nenhuma
  // (AC-PERK-05, AC-PERF-03).
  const insigniasDe = useCallback(
    (mensagem) => (
      <InsigniasDoAluno
        perks={perksPorUid}
        uid={mensagem.autorUid}
        agoraServidor={agoraServidor}
      />
    ),
    [perksPorUid, agoraServidor]
  );

  const tentarNovamente = useCallback(() => setTentativa((atual) => atual + 1), []);

  useEffect(() => {
    // AC-PERF-03: mesmo teto da tela do aluno, pela mesma razão.
    const consulta = query(colecaoDeChamados(salaId), limit(LIMITE_DE_CHAMADOS));

    setCarregando(true);
    setErroDaFila(null);

    const unsubscribe = onSnapshot(
      consulta,
      (querySnapshot) => {
        // A fila do professor é a mesma do aluno, e a ordem dela é decidida no
        // mesmo lugar: `services/filaChamados.js`. O professor não preenche
        // `horarioIso` de ninguém — quem faz isso é o cliente do autor.
        //
        // O estado guarda a lista **crua**: ordenar aqui, antes de os perks
        // chegarem, faria a fila reordenar sozinha na frente da turma quando o
        // segundo snapshot chegasse.
        setProblemas(
          querySnapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
        );
        setCarregando(false);
      },
      () => {
        setCarregando(false);
        setErroDaFila(ERRO_AO_CARREGAR);
      }
    );

    return () => unsubscribe();
  }, [salaId, tentativa]);

  // `useCallback` porque o card é `React.memo`: sem ela, os 30 cards da página
  // reconciliariam a cada reemissão do `onSnapshot` (AC-CHAMADO-09).
  const renderizarCard = useCallback(
    (problema, indice) => (
      <CardDoChamado
        key={problema.id}
        chamado={problema}
        indice={indice}
        saindo={estaSaindo(problema.id)}
        perksPorUid={perksPorUid}
        agoraServidor={agoraServidor}
        acoes={
          somenteLeitura ? null : (
            /* As duas ações do professor sobre o chamado. Somem na sala
               arquivada, que é somente leitura (AC-SALA-10). */
            <div className="delete-button-container">
              {/* `aria-pressed` porque é um interruptor, e não um comando: o
                  leitor de tela anuncia "Atendido, ativado" em vez de deixar a
                  pessoa adivinhar qual é o estado atual. */}
              <button
                type="button"
                className="atendido-button"
                aria-pressed={Boolean(problema.atendido)}
                onClick={() => alternarAtendido(problema)}
              >
                Atendido
              </button>

              <button className="delete-button" onClick={() => pedirExclusao(problema)}>
                Excluir
              </button>
            </div>
          )
        }
      />
    ),
    [estaSaindo, perksPorUid, agoraServidor, somenteLeitura, alternarAtendido, pedirExclusao]
  );

  return (
    <div className="tela-professor">
      <BotaoSair />
      <h1>Chamados dos Alunos</h1>

      {/* Só o dono da sala concede: é o que a rule cobra do outro lado
          (AC-PERK-07). Um professor que não é o dono desta turma vê a fila e
          o chat, e nada mais. */}
      {ehDono && (
        <PainelDePerks
          salaId={salaId}
          perks={perks}
          agoraServidor={agoraServidor}
          somenteLeitura={somenteLeitura}
        />
      )}

      <FilaDeChamados
        chamados={visiveis}
        carregando={carregando}
        erro={erroDaFila}
        tentarNovamente={tentarNovamente}
        textoVazio={FILA_VAZIA}
        renderizarCard={renderizarCard}
      />

      {/* A confirmação do AC-CHAMADO-04. O professor apaga o chamado de um
          aluno: o clique errado aqui custa a dúvida de outra pessoa. */}
      {emConfirmacao && (
        <ConfirmarAcao
          titulo={TITULO_DA_CONFIRMACAO}
          descricao={DESCRICAO_DA_CONFIRMACAO}
          rotuloConfirmar="Excluir"
          destrutiva
          aoConfirmar={confirmar}
          aoCancelar={cancelar}
        />
      )}

      {/* Quem chega a esta tela é o professor da sala, pelo vínculo que
          `Sala.jsx` conferiu. O papel vai junto porque é ele que libera o
          `!clear` na interface — a autorização que vale é a da rule. */}
      <Chat
        salaId={salaId}
        papelNaSala={PAPEL_DE_PROFESSOR}
        somenteLeitura={somenteLeitura}
        insigniasDe={insigniasDe}
      />
    </div>
  );
}

export default TelaProfessor;
