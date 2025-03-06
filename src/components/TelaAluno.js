import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { db, auth } from '../firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import '../styles/TelaAluno.css';

function TelaAluno() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [problemas, setProblemas] = useState([]);
  const [usuarioNome, setUsuarioNome] = useState('');

  useEffect(() => {
    // Obtém o usuário autenticado
    const user = auth.currentUser;
    if (user) {
      setUsuarioNome(user.displayName || "Aluno");
    }

    // Buscar os chamados do Firestore
    const fetchProblemas = async () => {
      const querySnapshot = await getDocs(collection(db, "chamados"));
      const problemasList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProblemas(problemasList);
    };

    fetchProblemas();
  }, []);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const addProblema = async (descricao) => {
    if (!descricao) return;

    const novaCor = `hsl(${Math.random() * 360}, 70%, 80%)`;
    const horario = new Date().toLocaleString();

    const novoProblema = {
      nome: usuarioNome,
      descricao,
      horario,
      cor: novaCor,
    };

    // Salvar no Firestore
    const docRef = await addDoc(collection(db, "chamados"), novoProblema);
    setProblemas([...problemas, { id: docRef.id, ...novoProblema }]);
    closeModal();
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
            <p><em>{problema.horario}</em></p>
          </div>
        ))}
      </div>

      {isModalOpen && <Modal onClose={closeModal} onSubmit={addProblema} />}
    </div>
  );
}

export default TelaAluno;
