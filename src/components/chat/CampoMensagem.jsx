// O campo de digitação.
//
// PASSO 1: o campo da v0.7.0, extraído sem mudar nada — `input type="text"` sem
// maxLength, sem contador, sem estado de erro. É o incumbente contra o qual o
// teste está vermelho.
import React, { useState } from 'react';
import { FaArrowRight } from 'react-icons/fa';

export default function CampoMensagem({ aoEnviar, valorInicial = '' }) {
  const [texto, setTexto] = useState(valorInicial);

  const enviar = () => {
    if (texto.trim() === '') return;

    aoEnviar(texto);
    setTexto('');
  };

  return (
    <div className="campo-mensagem">
      <input
        type="text"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === 'Enter') {
            evento.preventDefault();
            enviar();
          }
        }}
        placeholder="Escreva uma mensagem"
      />
      <button type="button" className="enviar-btn" onClick={enviar} aria-label="Enviar">
        <FaArrowRight />
      </button>
    </div>
  );
}
