// Esqueleto do ciclo 8: o campo por URL da v0.5.0, sem nada de novo.
import React from 'react';

export default function CampoAnexo({ onAnexoMudou, desabilitado = false }) {
  return (
    <div className="image-url-container">
      <input
        type="text"
        placeholder="Cole o link da imagem"
        disabled={desabilitado}
        onChange={(evento) => onAnexoMudou(evento.target.value || null)}
      />
      <p>Digite o URL da imagem</p>
    </div>
  );
}
