import React, { useState } from 'react';
import '../styles/Modal.css'; // Adicione a estilização para o modal

function Modal({ onClose, onSubmit }) {
  const [descricao, setDescricao] = useState('');
  const [imagemUrl, setImagemUrl] = useState(''); // Estado para armazenar a URL da imagem

  // Função para simular o envio do formulário
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Verificar se a URL foi inserida corretamente
    console.log('Imagem URL:', imagemUrl);

    // Enviando o chamado com a descrição e a URL da imagem (se houver)
    onSubmit(descricao, imagemUrl);
    setDescricao('');
    setImagemUrl(''); // Limpar o estado de imagem URL após o envio
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

        {/* Campo para adicionar o link da imagem */}
        <div className="image-url-container">
          <input
            type="text"
            value={imagemUrl}
            onChange={(e) => setImagemUrl(e.target.value)}
            placeholder="Cole o link da imagem"
          />
          {imagemUrl && (
            <div className="image-preview">
              <img src={imagemUrl} alt="Imagem Selecionada" />
            </div>
          )}
          <p>Digite o URL da imagem</p>
        </div>

        <button onClick={handleSubmit}>Concluir</button>
        <button className="close-button" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export default Modal;
