// Uma conversa direta aberta — AC-DM-03, AC-DM-05.
//
// Reusa `ListaMensagens` e `CampoMensagem` inteiros. Uma conversa privada é uma
// conversa: tem horário, cor por autor, agrupamento e rolagem pelas mesmas
// regras, e escrever um segundo conjunto de componentes "parecidos" seria
// garantir que as duas telas divergissem na primeira correção.
import React, { useEffect } from 'react';
import ListaMensagens from './ListaMensagens';
import CampoMensagem from './CampoMensagem';
import { useMensagens } from '../../hooks/useMensagens';
import { enviarMensagemDireta, marcarConversaComoLida } from '../../services/chat';

/**
 * A conversa privada entre duas pessoas da sala.
 *
 * @param {object} props
 * @param {string} props.salaId
 * @param {{id: string, outroUid: string, outroNome: string}} props.conversa
 * @param {{uid: string, nome: string}} props.pessoa quem está lendo.
 * @param {() => void} props.aoVoltar
 * @param {boolean} [props.somenteLeitura] sala arquivada (AC-SALA-10).
 */
export default function Conversa({ salaId, conversa, pessoa, aoVoltar, somenteLeitura = false }) {
  const { mensagens, temMais, carregando, carregarAnteriores } = useMensagens(salaId, {
    conversaId: conversa.id,
  });

  // Abrir a conversa é o ato de lê-la (AC-DM-05). A falha é engolida de
  // propósito: não conseguir zerar o contador é um número errado num badge, e
  // derrubar a conversa por causa disso seria trocar um defeito pequeno por um
  // grande.
  useEffect(() => {
    marcarConversaComoLida(salaId, conversa.id, pessoa.uid).catch(() => {});
  }, [salaId, conversa.id, pessoa.uid, mensagens.length]);

  const enviar = (texto) =>
    enviarMensagemDireta(salaId, conversa.id, pessoa, conversa.outroUid, texto);

  return (
    <div className="conversa">
      <header className="conversa-cabecalho">
        <button type="button" className="conversa-voltar" onClick={aoVoltar}>
          Voltar para as conversas
        </button>
        <h4>{conversa.outroNome}</h4>
      </header>

      <ListaMensagens
        mensagens={mensagens}
        uid={pessoa.uid}
        temMais={temMais}
        carregando={carregando}
        aoCarregarAnteriores={carregarAnteriores}
      />

      <CampoMensagem aoEnviar={enviar} somenteLeitura={somenteLeitura} />
    </div>
  );
}
