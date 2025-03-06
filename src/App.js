import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';
import { app } from './firebase';
import Login from './components/Login';
import Cadastro from './components/Cadastro';
import TelaAluno from './components/TelaAluno';
import TelaProfessor from './components/TelaProfessor';
import Footer from './components/Footer'; // Importe o Footer

function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const auth = getAuth(app);
  const providerGoogle = new GoogleAuthProvider();
  const providerGithub = new GithubAuthProvider();

  // Função para monitorar o estado de autenticação do usuário
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUsuarioLogado({
          nome: user.displayName,
          tipo: 'aluno', // ou 'professor', você pode fazer isso dinâmico com a lógica do seu app
          email: user.email,
        });
      } else {
        setUsuarioLogado(null);
      }
    });

    return () => unsubscribe();
  }, [auth]);

  // Função para login com Google
  const handleLoginGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, providerGoogle);
      const user = result.user;
      setUsuarioLogado({
        nome: user.displayName,
        tipo: 'aluno', // Ajuste com base na lógica do seu app
        email: user.email,
      });
    } catch (error) {
      console.error('Erro ao fazer login com Google:', error.message);
    }
  };

  // Função para login com GitHub
  const handleLoginGithub = async () => {
    try {
      const result = await signInWithPopup(auth, providerGithub);
      const user = result.user;
      setUsuarioLogado({
        nome: user.displayName,
        tipo: 'aluno', // Ajuste com base na lógica do seu app
        email: user.email,
      });
    } catch (error) {
      console.error('Erro ao fazer login com GitHub:', error.message);
    }
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route exact path="/" element={<Login setUsuarioLogado={setUsuarioLogado} handleLoginGoogle={handleLoginGoogle} handleLoginGithub={handleLoginGithub} />} />
          <Route path="/cadastro" element={<Cadastro setUsuarioLogado={setUsuarioLogado} />} />
          <Route 
            path="/aluno" 
            element={usuarioLogado?.tipo === 'aluno' ? <TelaAluno /> : <Login setUsuarioLogado={setUsuarioLogado} handleLoginGoogle={handleLoginGoogle} handleLoginGithub={handleLoginGithub} />} 
          />
          <Route 
            path="/professor" 
            element={usuarioLogado?.tipo === 'professor' ? <TelaProfessor /> : <Login setUsuarioLogado={setUsuarioLogado} handleLoginGoogle={handleLoginGoogle} handleLoginGithub={handleLoginGithub} />} 
          />
        </Routes>

        {/* Adicionando o Footer aqui para aparecer em todas as páginas */}
        <Footer />
      </div>
    </Router>
  );
}

export default App;
