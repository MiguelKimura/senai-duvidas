import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { db, auth } from '../firebase';
import { collection, addDoc, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import '../styles/TelaAluno.css';
import Chat from './Chat';


function TelaAluno() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [problemas, setProblemas] = useState([]);
  const [usuarioNome, setUsuarioNome] = useState('');

  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUsuarioNome(user.displayName || "Aluno");
    }

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

      problemasList.sort((a, b) => a.horario - b.horario); // Ordenando os problemas pela data
      setProblemas(problemasList);
    });

    return () => unsubscribe(); // Limpar o listener quando o componente for desmontado
  }, []);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const addProblema = async (descricao, imagem) => {
    if (!descricao) return;

    const user = auth.currentUser;
    if (!user) return;

    const novaCor = `hsl(${Math.random() * 360}, 70%, 80%)`;
    const horario = new Date().toISOString();

    const novoProblema = {
      nome: usuarioNome,
      email: user.email,
      descricao,
      horario,
      cor: novaCor,
      imagem: imagem || null, // Salva a imagem (se houver)
    };

    try {
      await addDoc(collection(db, "chamados"), novoProblema);
      closeModal();
    } catch (error) {
      console.error("Erro ao adicionar problema:", error);
    }
  };

  const removerProblema = async (id) => {
    try {
      await deleteDoc(doc(db, "chamados", id));
    } catch (error) {
      console.error("Erro ao excluir chamado:", error);
    }
  };

  // Função para abrir a imagem
  const visualizarImagem = (imagemUrl) => {
    window.open(imagemUrl, '_blank');
  };

  return (
    <div className="tela-aluno">
      <h1>Bem-vindo, {usuarioNome}!</h1>
      <p>Aqui estão os problemas registrados.</p>
      <button className="add-button" onClick={openModal}>+</button>
      <div className="problemas-list">
        {problemas.map((problema) => (
          <div
            key={problema.id}
            className="problema-card"
            style={{ backgroundColor: problema.cor }}
          >
            <div className="card-header">
              <p className="user-name"><strong>{problema.nome}</strong></p>
              {/* Exibir ícone para visualizar a imagem no canto superior direito do card, caso haja imagem */}
              {problema.imagem && (
                <div 
                  className="view-image-icon" 
                  onClick={() => visualizarImagem(problema.imagem)}
                  title="Ver imagem"
                >
                  👁️
                </div>
              )}
            </div>
            
            <p>{problema.descricao}</p>
            <p><em>{new Date(problema.horario).toLocaleString()}</em></p>
            
            {problema.email === auth.currentUser?.email && (
              <button className="delete-button" onClick={() => removerProblema(problema.id)}>
                Excluir
              </button>
            )}
          </div>
        ))}
      </div>
      {isModalOpen && <Modal onClose={closeModal} onSubmit={addProblema} />}

      <Chat />
    </div>
  );
}

export default TelaAluno;
