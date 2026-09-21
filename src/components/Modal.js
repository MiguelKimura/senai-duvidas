// O modal de novo chamado — AC-IMG-02, AC-IMG-09, AC-IMG-11.
//
// O modal deixa de ser "um textarea e um campo de URL" e passa a ter seções.
// Não é enfeite: a task 05 acrescenta o painel de opções avançadas — cor e
// markdown — dentro deste mesmo modal, e a diferença entre "acrescentar uma
// seção" e "reescrever o modal inteiro" é só esta organização existir antes.
//
// O ponto delicado é o id do chamado. O anexo sobe **antes** de o chamado
// existir, porque o aluno escolhe a imagem enquanto ainda está escrevendo.
// Para que o arquivo já nasça na pasta definitiva —
// `salas/{salaId}/chamados/{chamadoId}/` —, o modal reserva o id do documento
// na abertura, sem escrever nada no banco. A alternativa seria subir para um
// lugar provisório e mover depois, e o Storage não move objeto: copia, e paga
// duas vezes, em banda e em cota.
import React, { useRef, useState } from 'react';
import CampoAnexo from './CampoAnexo';
import { removerAnexo } from '../services/anexos';
import { reservarChamado } from '../services/salas';
import '../styles/Modal.css';

function Modal({ salaId = null, onClose, onSubmit }) {
  const [descricao, setDescricao] = useState('');
  const [anexo, setAnexo] = useState(null);

  // Reservado uma vez, na abertura. `useRef` com inicialização preguiçosa
  // porque `reservarChamado` sorteia um id novo a cada chamada — recalculá-lo
  // a cada render mudaria a pasta do anexo no meio do envio.
  const referencia = useRef(null);
  if (referencia.current === null) referencia.current = reservarChamado(salaId);

  const chamadoId = referencia.current.id;

  const handleSubmit = async (e) => {
    e.preventDefault();

    onSubmit(descricao, anexo, chamadoId);
    setDescricao('');
    setAnexo(null);
  };

  /**
   * Fechar sem concluir não pode deixar órfão no Storage.
   *
   * O anexo já subiu, e o chamado que o referenciaria nunca vai existir:
   * ninguém mais teria como chegar àquele caminho, e o arquivo ficaria
   * ocupando a cota da escola para sempre (AC-CHAMADO-08, mesmo espírito).
   */
  const fechar = () => {
    if (anexo && anexo.caminho) removerAnexo(anexo.caminho);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Descreva o seu problema</h2>

        <section className="modal-secao" data-testid="secao-descricao">
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descreva o problema"
          />
        </section>

        <section className="modal-secao" data-testid="secao-anexo">
          <CampoAnexo
            salaId={salaId}
            chamadoId={chamadoId}
            anexo={anexo}
            onAnexoMudou={setAnexo}
          />
        </section>

        {/* TODO(task-05): a seção de opções avançadas — cor do card e
            markdown — entra aqui, ao lado das duas de cima. */}

        <div className="buttons-container">
          <button onClick={handleSubmit}>Concluir</button>
          <button className="close-button" onClick={fechar}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
