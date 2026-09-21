// A casca do chat.
//
// PASSO 1: o painel da v0.7.0 — botão sem nome acessível, sem abas, sem
// confirmação de `!clear`. É o incumbente contra o qual o teste está vermelho.
import React, { useState } from 'react';
import { FaComments } from 'react-icons/fa';

export default function Chat() {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="chat-container">
      <button className="toggle-chat-btn" onClick={() => setAberto(!aberto)} type="button">
        <FaComments />
      </button>

      {aberto && <div className="chat-box" />}
    </div>
  );
}
