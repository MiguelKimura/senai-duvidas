// O balão de fala.
//
// PASSO 1: a marcação da v0.7.0, extraída de `components/Chat.js` sem mudar
// nada. É o incumbente contra o qual `__tests__/Mensagem.test.js` está vermelho.
import React from 'react';

function gerarCorParaUsuario(valorUnico) {
  let hash = 0;

  for (let i = 0; i < valorUnico.length; i += 1) {
    hash = (hash << 5) - hash + valorUnico.charCodeAt(i);
  }

  return `hsl(${Math.abs(hash) % 360}, 90%, 60%)`;
}

export default function Mensagem({ mensagem, ehMinha = false }) {
  const cor = gerarCorParaUsuario(mensagem.email || 'leitor@senai.br');

  return (
    <div className={`mensagem-card ${ehMinha ? 'minha-mensagem' : 'mensagem-outro-usuario'}`}>
      <div className="fala-box" style={{ backgroundColor: cor }}>
        <strong>{mensagem.autorNome || mensagem.nome}</strong>: {mensagem.texto}
      </div>
    </div>
  );
}
