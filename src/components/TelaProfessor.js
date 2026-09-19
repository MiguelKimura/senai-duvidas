import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import '../styles/TelaProfessor.css';
import Chat from './Chat';

function TelaProfessor() {
  const [problemas, setProblemas] = useState([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "chamados"), (querySnapshot) => {
      const problemasList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        let horario = data.horario;
        if (horario instanceof Timestamp) {
          horario = horario.toDate();
        } else if (typeof horario === 'string') {
          horario = new Date(horario);
        } else {
          horario = new Date();
        }

        return { id: doc.id, ...data, horario };
      });

      problemasList.sort((a, b) => a.horario - b.horario);
      setProblemas(problemasList);
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, "chamados", id));
      alert('Chamado excluído com sucesso!');
    } catch (error) {
      console.error("Erro ao excluir o chamado:", error);
      alert('Erro ao excluir o chamado. Tente novamente mais tarde.');
    }
  };

  const visualizarAnexo = (anexoUrl) => {
    window.open(anexoUrl, '_blank');
  };

  return (
    <div className="tela-professor">
      <h1>Chamados dos Alunos</h1>

      <div className="problemas-list">
        {problemas.map((problema) => (
          <div
            key={problema.id}
            className="problema-card"
            style={{ backgroundColor: problema.cor }}
          >
            <div className="card-header">
              <div className="user-name-wrapper">
                <p className="user-name"><strong>{problema.nome}</strong></p>
              </div>

              {/* Exibindo o ícone para visualizar imagem no canto superior direito do card */}
              {problema.imagem && (
                <div 
                  className="view-image-icon" 
                  onClick={() => visualizarAnexo(problema.imagem)}
                  title="Ver imagem"
                >
                  👁️
                </div>
              )}
            </div>

            <p>{problema.descricao}</p>
            <p><em>{new Date(problema.horario).toLocaleString()}</em></p>

            {/* Botão de exclusão posicionado abaixo do conteúdo do card */}
            <div className="delete-button-container">
              <button 
                className="delete-button" 
                onClick={() => handleDelete(problema.id)}
              >
                Excluir
              </button>
            </div>
          </div>
        ))}
      </div>
      <Chat/>
    </div>
  );
}

export default TelaProfessor;
