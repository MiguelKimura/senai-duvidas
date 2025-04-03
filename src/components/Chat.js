import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { FaArrowRight, FaComments } from 'react-icons/fa'; 
import '../styles/Chat.css';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, getDocs } from 'firebase/firestore';


// Função para gerar uma cor única para o usuário com base em um valor único (email)
const gerarCorParaUsuario = (valorUnico) => {
  let hash = 0;
  for (let i = 0; i < valorUnico.length; i++) {
    hash = (hash << 5) - hash + valorUnico.charCodeAt(i);
  }

  const h = Math.abs(hash) % 360;
  const s = 90;
  const l = 60;

  return `hsl(${h}, ${s}%, ${l}%)`;
};

function Chat() {
  const [mensagens, setMensagens] = useState([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [usuarioNome, setUsuarioNome] = useState('');
  const [usuarioEmail, setUsuarioEmail] = useState('');
  const [chatAberto, setChatAberto] = useState(false);

  // Recuperando o nome e o e-mail do usuário logado
  useEffect(() => {
    const user = auth.currentUser;
    if (user) {
      setUsuarioNome(user.displayName || "Aluno");
      setUsuarioEmail(user.email);
    }
  }, []);

  // Subscribing ao banco de dados para receber as mensagens em tempo real
  useEffect(() => {
    const q = query(collection(db, 'chat'), orderBy('horario'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const mensagensList = querySnapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });
      setMensagens(mensagensList);
    });

    return () => unsubscribe();
  }, []);

  // Função para excluir todas as mensagens (comando !clear)
  const limparMensagens = async () => {
    const q = query(collection(db, 'chat'));
    const querySnapshot = await getDocs(q); // Usando getDocs para buscar os documentos de forma síncrona
    querySnapshot.forEach(async (doc) => {
      await deleteDoc(doc.ref); // Deleta todas as mensagens
    });
  };

  // Enviar nova mensagem
  const enviarMensagem = async () => {
    if (novaMensagem.trim() === '') return;

    // Se a mensagem for o comando !clear, chama a função de limpar mensagens
    if (novaMensagem.trim().toLowerCase() === '!clear') {
      await limparMensagens();
      setNovaMensagem('');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    const novaMensagemData = {
      texto: novaMensagem,
      nome: usuarioNome,
      horario: new Date(),
      email: user.email
    };

    try {
      await addDoc(collection(db, 'chat'), novaMensagemData);
      setNovaMensagem('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  // Função para abrir/fechar o chat
  const toggleChat = () => {
    setChatAberto(!chatAberto);
  };

  // Função para capturar o pressionamento da tecla Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      enviarMensagem();
    }
  };

  // Resetando o chat à meia-noite
  useEffect(() => {
    const resetarChatAmeiaNoite = () => {
      const agora = new Date();
      const proximaMeiaNoite = new Date();
      proximaMeiaNoite.setHours(24, 0, 0, 0); // Definindo a próxima meia-noite

      const tempoParaProximaMeiaNoite = proximaMeiaNoite - agora;
      if (tempoParaProximaMeiaNoite > 0) {
        setTimeout(() => {
          limparMensagens(); // Limpa as mensagens à meia-noite
        }, tempoParaProximaMeiaNoite);
      }
    };

    resetarChatAmeiaNoite();
  }, []);

  return (
    <div className="chat-container">
      <button className="toggle-chat-btn" onClick={toggleChat}>
        {chatAberto ? <FaComments /> : <FaComments />}
      </button>

      {chatAberto && (
        <div className="chat-box">
          <div className="chat-header">
            <h3>Chat</h3>
          </div>

          <div className="mensagens-list">
            {mensagens.map((mensagem) => {
              const corUsuario = gerarCorParaUsuario(mensagem.email || usuarioEmail);
              const isMinhaMensagem = mensagem.email === usuarioEmail;

              return (
                <div 
                  key={mensagem.id} 
                  className={`mensagem-card ${isMinhaMensagem ? 'minha-mensagem' : 'mensagem-outro-usuario'}`}
                >
                  <div 
                    className="fala-box" 
                    style={{ backgroundColor: corUsuario }}
                  >
                    <strong>{mensagem.nome}</strong>: {mensagem.texto}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="input-container">
            <input
              type="text"
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escreva uma mensagem"
            />
            <button className="enviar-btn" onClick={enviarMensagem}>
              <FaArrowRight />
            </button>
          </div>
          <div className="credits">Desenvolvido por Lívia Duarte</div>
        </div>
      )}
    </div>
  );
}

export default Chat;
