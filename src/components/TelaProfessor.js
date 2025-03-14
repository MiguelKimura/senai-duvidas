import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore'; // Usando onSnapshot
import '../styles/TelaProfessor.css';

function TelaProfessor() {
  const [problemas, setProblemas] = useState([]);

  useEffect(() => {
    // Escuta em tempo real os chamados no Firestore
    const unsubscribe = onSnapshot(collection(db, "chamados"), (querySnapshot) => {
      const problemasList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProblemas(problemasList);
    });

    // Cleanup para quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  // Função para excluir um chamado
  const handleDelete = async (id) => {
    try {
      // Excluir o chamado do Firestore
      await deleteDoc(doc(db, "chamados", id));
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
        {problemas.length === 0 ? (
          <p>Nenhum chamado encontrado.</p>
        ) : (
          problemas.map((problema) => (
            <div
              key={problema.id}
              className="problema-card"
              style={{ backgroundColor: problema.cor }}
            >
              <p><strong>{problema.nome}</strong></p>
              <p>{problema.descricao}</p>
              <p><em>{new Date(problema.horario).toLocaleString()}</em></p>

              {/* Botão de exclusão */}
              <button onClick={() => handleDelete(problema.id)} className="delete-btn">
                Excluir
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default TelaProfessor;
