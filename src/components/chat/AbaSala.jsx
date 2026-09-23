// A conversa da turma — AC-CHAT-01 a AC-CHAT-10, AC-TEMPO-07.
//
// Junta as peças e guarda as duas decisões de comportamento desta aba:
//
// **O `!clear` (AC-CHAT-08).** Quem não é professor recebe a recusa de
// `services/chat.js` na cara, em português, sem que nada seja apagado. Quem é
// professor recebe uma pergunta antes — apagar a conversa da turma é
// irreversível e não pode acontecer por um Enter de reflexo.
//
// **A meia-noite (AC-TEMPO-07, ADR 0009).** A v0.7.0 cumpria "o chat começa
// limpo a cada dia" apagando as mensagens com um `setTimeout` de até 24 horas.
// Três problemas: o temporizador não sobrevivia a um refresh, a meia-noite era
// a da máquina, e o histórico da turma sumia para sempre. Aqui o dia corrente
// é um **filtro de exibição**. A promessa visível é a mesma; o custo dela não.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ListaMensagens from './ListaMensagens';
import CampoMensagem from './CampoMensagem';
import { useMensagens } from '../../hooks/useMensagens';
import {
  ehComandoLimpar,
  enviarMensagem,
  limparConversa,
} from '../../services/chat';
import { PAPEL_DE_PROFESSOR } from '../../services/salas';
import {
  estaPendente,
  mesmoDiaEmBrasilia,
  msAteProximaMeiaNoiteBrasilia,
} from '../../services/tempo';

const PERGUNTA_DO_CLEAR =
  'Apagar a conversa da turma? As mensagens não voltam, e todo mundo perde o histórico do dia.';

/**
 * As mensagens do dia de `agora`.
 *
 * Mensagem ainda sem carimbo do servidor — a que acabou de ser enviada — conta
 * como de hoje. Tratá-la como "de outro dia" faria a própria mensagem recém-
 * escrita piscar e sumir da tela enquanto o servidor responde.
 *
 * @param {Array<object>} mensagens
 * @param {Date} agora
 * @returns {Array<object>}
 */
export function mensagensDoDia(mensagens, agora) {
  return mensagens.filter(
    (mensagem) => estaPendente(mensagem.horario) || mesmoDiaEmBrasilia(mensagem.horario, agora)
  );
}

/**
 * O dia de Brasília em que estamos, que se atualiza sozinho na virada.
 *
 * A "verificação no carregamento" que o AC-TEMPO-07 pede é o valor inicial; o
 * temporizador existe só para quem deixa a aba aberta atravessar a meia-noite.
 * Ao contrário do da v0.7.0, o disparo dele **não escreve no banco** — troca
 * uma data no estado e nada mais. E ele se rearma, em vez de valer uma vez.
 */
function useDiaCorrente() {
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    const temporizador = setTimeout(
      () => setAgora(new Date()),
      // +1s para cair depois da virada, e não em cima dela.
      msAteProximaMeiaNoiteBrasilia(agora) + 1000
    );

    return () => clearTimeout(temporizador);
  }, [agora]);

  return agora;
}

/**
 * A aba da conversa pública da sala.
 *
 * @param {object} props
 * @param {string|null} props.salaId
 * @param {{uid: string, nome: string, email?: string, papel?: string}} props.pessoa
 * @param {boolean} [props.somenteLeitura] sala arquivada (AC-SALA-10).
 * @param {(mensagem: object) => React.ReactNode} [props.insigniasDe] AC-PERK-05.
 */
export default function AbaSala({ salaId, pessoa, somenteLeitura = false, insigniasDe }) {
  const { mensagens, temMais, carregando, carregarAnteriores } = useMensagens(salaId);
  const agora = useDiaCorrente();

  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);
  const [aviso, setAviso] = useState(null);

  const ehProfessor = pessoa && pessoa.papel === PAPEL_DE_PROFESSOR;

  const visiveis = useMemo(
    () => (mostrarHistorico ? mensagens : mensagensDoDia(mensagens, agora)),
    [mensagens, mostrarHistorico, agora]
  );

  /**
   * O que acontece quando alguém aperta Enter.
   *
   * Devolver uma promessa rejeitada é intencional: é assim que `CampoMensagem`
   * mostra a recusa e **mantém o texto no campo**. O `!clear` de um aluno passa
   * por aqui e sai como `ErroDeChat`, sem tocar no banco.
   */
  const enviar = useCallback(
    (texto) => {
      setAviso(null);

      if (!ehComandoLimpar(texto)) return enviarMensagem(salaId, pessoa, texto);

      if (!ehProfessor) return limparConversa(salaId, pessoa);

      setConfirmandoLimpeza(true);
      return Promise.resolve();
    },
    [salaId, pessoa, ehProfessor]
  );

  const confirmarLimpeza = useCallback(async () => {
    setConfirmandoLimpeza(false);

    try {
      const { apagadas } = await limparConversa(salaId, pessoa);
      setAviso(`Conversa limpa: ${apagadas} mensagens apagadas.`);
    } catch (falha) {
      // Falha de lote precisa aparecer. O defeito da v0.7.0 era exatamente o
      // contrário: o professor via o campo limpar e supunha que deu certo.
      setAviso(falha.message || 'Não foi possível limpar a conversa.');
    }
  }, [salaId, pessoa]);

  return (
    <div className="aba-sala">
      {aviso && (
        <p className="chat-aviso" role="status">
          {aviso}
        </p>
      )}

      {confirmandoLimpeza && (
        <div className="chat-confirmacao" role="alertdialog" aria-label="Limpar a conversa">
          <p>{PERGUNTA_DO_CLEAR}</p>
          <button type="button" onClick={confirmarLimpeza}>
            Apagar
          </button>
          <button type="button" onClick={() => setConfirmandoLimpeza(false)}>
            Cancelar
          </button>
        </div>
      )}

      <button
        type="button"
        className="chat-historico"
        onClick={() => setMostrarHistorico((atual) => !atual)}
      >
        {mostrarHistorico ? 'Ver só a conversa de hoje' : 'Ver dias anteriores'}
      </button>

      <ListaMensagens
        mensagens={visiveis}
        uid={pessoa ? pessoa.uid : null}
        temMais={mostrarHistorico && temMais}
        carregando={carregando}
        aoCarregarAnteriores={carregarAnteriores}
        insigniasDe={insigniasDe}
      />

      <CampoMensagem aoEnviar={enviar} somenteLeitura={somenteLeitura} />
    </div>
  );
}
