import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { limit, onSnapshot, query } from 'firebase/firestore';
import { formatarDataHora } from '../services/tempo';
import { LIMITE_DE_CHAMADOS, PAPEL_DE_PROFESSOR, colecaoDeChamados } from '../services/salas';
import { excluirChamado, marcarAtendido } from '../services/chamados';
import { formatoDoTexto } from '../utils/markdown';
import { classesDoCard, estiloDoCard } from '../utils/cardDoChamado';
import { usePerksDaSala } from '../hooks/usePerksDaSala';
import {
  DESCRICAO_DA_CONFIRMACAO,
  TITULO_DA_CONFIRMACAO,
  useExclusaoComDesfazer,
} from '../hooks/useExclusaoComDesfazer';
import { TIPO_ERRO, useToasts } from './Toast';
import ConfirmarAcao from './ConfirmarAcao';
import InsigniasDoAluno from './perks/InsigniasDoAluno';
import PainelDePerks from './perks/PainelDePerks';
import '../styles/TelaProfessor.css';
import AnexoDoCard from './AnexoDoCard';
import TextoMarkdown from './TextoMarkdown';
import Chat from './chat/Chat';
import BotaoSair from './BotaoSair';

/** O que a tela diz quando o servidor recusa marcar o chamado. */
export const AVISO_DE_FALHA_AO_ATENDER =
  'Não foi possível atualizar o chamado. Tente de novo em instantes.';

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

  useEffect(() => {
    // AC-PERF-03: mesmo teto da tela do aluno, pela mesma razão.
    const consulta = query(colecaoDeChamados(salaId), limit(LIMITE_DE_CHAMADOS));

    const unsubscribe = onSnapshot(consulta, (querySnapshot) => {
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
    });

    return () => unsubscribe();
  }, [salaId]);

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

      <div className="problemas-list">
        {visiveis.map((problema, indice) => (
          <div
            key={problema.id}
            className={classesDoCard({ saindo: estaSaindo(problema.id) })}
            style={{ ...estiloDoCard(problema), '--indice-na-lista': indice }}
          >
            <div className="card-header">
              <div className="user-name-wrapper">
                <p className="user-name">
                  <strong>{problema.autorNome || problema.nome}</strong>
                  <InsigniasDoAluno
                    perks={perksPorUid}
                    uid={problema.autorUid}
                    agoraServidor={agoraServidor}
                  />
                </p>
              </div>

              {/* A mesma miniatura do card do aluno, pelo mesmo componente.
                  Até a v0.5.0 eram dois trechos de JSX copiados, e já tinham
                  divergido no nome da função que abriam. */}
              <AnexoDoCard chamado={problema} />
            </div>

            {/* O mesmo componente do card do aluno, pelo mesmo motivo do
                `AnexoDoCard`: a fila e a mesma, e o card precisa ser o
                mesmo (AC-COR-07). */}
            <TextoMarkdown texto={problema.descricao} formato={formatoDoTexto(problema)} />
            <p>
              <em>{formatarDataHora(problema.horario)}</em>
            </p>

            {/* As duas ações do professor sobre o chamado. Somem na sala
                arquivada, que é somente leitura (AC-SALA-10). */}
            {!somenteLeitura && (
              <div className="delete-button-container">
                {/* `aria-pressed` porque é um interruptor, e não um comando:
                    o leitor de tela anuncia "Atendido, ativado" em vez de
                    deixar a pessoa adivinhar qual é o estado atual. */}
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
            )}
          </div>
        ))}
      </div>

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
