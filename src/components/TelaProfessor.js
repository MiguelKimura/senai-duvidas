import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore'; // Importando deleteDoc
import '../styles/TelaProfessor.css';

function TelaProfessor() {
  const [problemas, setProblemas] = useState([]);

  useEffect(() => {
    // Buscar chamados do Firestore
    const fetchProblemas = async () => {
      const querySnapshot = await getDocs(collection(db, "chamados"));
      const problemasList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProblemas(problemasList);
    };

    fetchProblemas();
  }, []);

  // Função para excluir um chamado
  const handleDelete = async (id) => {
    try {
      // Excluir o chamado do Firestore
      await deleteDoc(doc(db, "chamados", id));
      
      // Atualizar a lista de chamados após a exclusão
      setProblemas(problemas.filter(problema => problema.id !== id));
      alert('Chamado excluído com sucesso!');
    } catch (error) {
      console.error("Erro ao excluir o chamado:", error);
      alert('Erro ao excluir o chamado. Tente novamente mais tarde.');
    }
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
            <p><strong>{problema.nome}</strong></p>
            <p>{problema.descricao}</p>
            <p><em>{problema.horario}</em></p>

            {/* Botão de exclusão */}
            <button onClick={() => handleDelete(problema.id)} className="delete-btn">
              Excluir
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TelaProfessor;
