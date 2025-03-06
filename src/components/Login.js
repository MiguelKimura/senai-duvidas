import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Login.css';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { getDoc, doc } from 'firebase/firestore';

const Login = ({ setUsuarioLogado }) => {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Função para login com e-mail e senha
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;
      console.log('Usuário autenticado:', user.uid);

      const usuarioDocRef = doc(db, 'usuarios', user.uid);
      const usuarioDocSnap = await getDoc(usuarioDocRef);

      if (usuarioDocSnap.exists()) {
        const usuario = usuarioDocSnap.data();
        console.log('Usuário encontrado no Firestore:', usuario);
        setUsuarioLogado(usuario);

        if (usuario.tipo) {
          console.log('Tipo de usuário:', usuario.tipo);
          navigate(usuario.tipo === 'aluno' ? '/aluno' : '/professor');
        } else {
          alert('Tipo de usuário não encontrado.');
        }
      } else {
        alert('Usuário não encontrado no banco de dados.');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      alert('Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>Login</h1>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <label htmlFor="senha">Senha</label>
            <input
              type="password"
              id="senha"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Carregando...' : 'Entrar'}
          </button>
        </form>

        <br />
        <p>
          Não tem uma conta? <a href="/cadastro">Cadastre-se</a>
        </p>
      </div>
    </div>
  );
};

export default Login;
