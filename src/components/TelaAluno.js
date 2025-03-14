import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import '../styles/TelaAluno.css';

function TelaAluno() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [problemas, setProblemas] = useState([]);
  const [usuarioNome, setUsuarioNome] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUsuarioNome(user.displayName || "Aluno");
    }

    // Escuta em tempo real os chamados no Firestore
    const unsubscribe = onSnapshot(collection(db, "chamados"), (querySnapshot) => {
      const problemasList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Ordena os chamados pelo horário, do mais antigo para o mais novo
      problemasList.sort((a, b) => new Date(a.horario) - new Date(b.horario));

      setProblemas(problemasList);
    });

    // Cleanup para quando o componente for desmontado
    return () => unsubscribe();
  }, []);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const addProblema = async (descricao) => {
    if (!descricao) return;

    const novaCor = `hsl(${Math.random() * 360}, 70%, 80%)`;
    const horario = new Date().toISOString(); // Usa ISO 8601 para garantir compatibilidade na ordenação

    const novoProblema = {
      nome: usuarioNome,
      descricao,
      horario,
      cor: novaCor,
    };

    try {
      // Salvar no Firestore
      await addDoc(collection(db, "chamados"), novoProblema);
      closeModal(); // Fecha o modal após a submissão
    } catch (error) {
      console.error("Erro ao adicionar problema:", error);
      alert('Erro ao adicionar o problema. Tente novamente mais tarde.');
    }
  };

  return (
    <div className="tela-aluno">
      <h1>Bem-vindo, {usuarioNome}!</h1>
      <p>Aqui estão seus problemas registrados.</p>

      <button className="add-button" onClick={openModal}>+</button>

      <div className="problemas-list">
        {problemas.map((problema) => (
          <div
            key={problema.id}
            className="problema-card"
            style={{ backgroundColor: problema.cor }}
          >
            <p><strong>{problema.nome}</strong></p>
            <p>{problema.descricao}</p>
            <p><em>{new Date(problema.horario).toLocaleString()}</em></p>
          </div>
        ))}
      </div>

      {isModalOpen && <Modal onClose={closeModal} onSubmit={addProblema} />}
    </div>
  );
}

export default TelaAluno;
