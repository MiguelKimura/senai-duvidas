import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, GithubAuthProvider } from 'firebase/auth';
import { app } from './firebase';
import Login from './components/Login';
import Cadastro from './components/Cadastro';
import TelaAluno from './components/TelaAluno';
import TelaProfessor from './components/TelaProfessor';
import Footer from './components/Footer';

function App() {
  const [usuarioLogado, setUsuarioLogado] = useState(() => {
    const userData = localStorage.getItem('usuarioLogado');
    return userData ? JSON.parse(userData) : null;
  });

  const [carregando, setCarregando] = useState(true); // Estado para evitar renderização prematura
  const auth = getAuth(app);
  const providerGoogle = new GoogleAuthProvider();
  const providerGithub = new GithubAuthProvider();

  // Monitora a autenticação do usuário
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const usuario = {
          nome: user.displayName,
          tipo: localStorage.getItem('tipoUsuario') || 'aluno',
          email: user.email,
        };
        setUsuarioLogado(usuario);
        localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
      } else {
        setUsuarioLogado(null);
        localStorage.removeItem('usuarioLogado');
      }
      setCarregando(false); // Finaliza o carregamento
    });

    return () => unsubscribe();
  }, [auth]);

  // Login com Google
  const handleLoginGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, providerGoogle);
      const user = result.user;
      const usuario = {
        nome: user.displayName,
        tipo: localStorage.getItem('tipoUsuario') || 'aluno',
        email: user.email,
      };
      setUsuarioLogado(usuario);
      localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
    } catch (error) {
      console.error('Erro ao fazer login com Google:', error.message);
    }
  };

  // Login com GitHub
  const handleLoginGithub = async () => {
    try {
      const result = await signInWithPopup(auth, providerGithub);
      const user = result.user;
      const usuario = {
        nome: user.displayName,
        tipo: localStorage.getItem('tipoUsuario') || 'aluno',
        email: user.email,
      };
      setUsuarioLogado(usuario);
      localStorage.setItem('usuarioLogado', JSON.stringify(usuario));
    } catch (error) {
      console.error('Erro ao fazer login com GitHub:', error.message);
    }
  };

  // Exibe carregamento antes de renderizar a interface
  if (carregando) {
    return <p>Carregando...</p>;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Login setUsuarioLogado={setUsuarioLogado} handleLoginGoogle={handleLoginGoogle} handleLoginGithub={handleLoginGithub} />} />
          <Route path="/cadastro" element={<Cadastro setUsuarioLogado={setUsuarioLogado} />} />
          <Route 
            path="/aluno" 
            element={usuarioLogado?.tipo === 'aluno' ? <TelaAluno setUsuarioLogado={setUsuarioLogado} /> : <Login setUsuarioLogado={setUsuarioLogado} handleLoginGoogle={handleLoginGoogle} handleLoginGithub={handleLoginGithub} />} 
          />
          <Route 
            path="/professor" 
            element={usuarioLogado?.tipo === 'professor' ? <TelaProfessor /> : <Login setUsuarioLogado={setUsuarioLogado} handleLoginGoogle={handleLoginGoogle} handleLoginGithub={handleLoginGithub} />} 
          />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
  