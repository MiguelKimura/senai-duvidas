import React, { useState } from 'react';
import '../styles/Modal.css'; // Adicione a estilização para o modal

function Modal({ onClose, onSubmit }) {
  const [descricao, setDescricao] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(descricao);
    setDescricao('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Descreva o seu problema</h2>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descreva o problema"
        />
        <button onClick={handleSubmit}>Concluir</button>
        <button className="close-button" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export default Modal;
