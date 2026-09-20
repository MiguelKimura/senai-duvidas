import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaGithub, FaGoogle } from 'react-icons/fa';
import '../styles/Login.css';
import { useAuth } from '../contexts/AuthContext';

// Tela de entrada — AC-AUTH-02 a AC-AUTH-05.
//
// O que saiu daqui na task 01, e por quê:
//   * o observador de sessão próprio, que competia com os de `App.js` e
//     `firebase.js` e fazia a tela piscar. Quem observa a sessão agora é o
//     `AuthProvider`, e este componente só reage ao contexto;
//   * os `alert()`, que bloqueiam a aba e somem sem deixar o texto na tela;
//   * a leitura direta de `usuarios/{uid}`, que vivia aqui e decidia rota. A
//     resolução do papel é do `perfilUsuario`, e é a mesma para todo caminho
//     de login.

/** Para onde cada papel entra depois de autenticar. */
const ROTA_INICIAL = {
  aluno: '/aluno',
  professor: '/professor',
};

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const { usuario, papel, carregando, erro, entrarComEmail, entrarComGoogle, entrarComGithub } =
    useAuth();

  // Sessão já resolvida (recém-autenticada ou restaurada do IndexedDB): este
  // componente sai de cena. `replace` para o "voltar" do navegador não devolver
  // a pessoa ao login já autenticada, que redirecionaria de novo.
  useEffect(() => {
    if (!carregando && usuario && papel) {
      navigate(ROTA_INICIAL[papel] || '/', { replace: true });
    }
  }, [carregando, usuario, papel, navigate]);

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    setEnviando(true);
    await entrarComEmail(email, senha);
    setEnviando(false);
  };

  const entrarPorProvedor = async (entrar) => {
    setEnviando(true);
    await entrar();
    setEnviando(false);
  };

  // Enquanto o provider resolve a sessão inicial, não se mostra o formulário:
  // é o mesmo instante em que a v0.2.0 piscava a tela de login para quem já
  // estava autenticado (AC-AUTH-09).
  if (carregando) {
    return (
      <div className="login-container">
        <p className="login-carregando" role="status">
          Carregando...
        </p>
      </div>
    );
  }

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
              disabled={enviando}
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
              disabled={enviando}
            />
          </div>

          {erro && (
            <p className="login-erro" role="alert">
              {erro}
            </p>
          )}

          <div className="button-container">
            <button type="submit" disabled={enviando}>
              {enviando ? 'Carregando...' : 'Entrar'}
            </button>
          </div>
        </form>

        <div className="login-social">
          <p className="login-social-titulo">ou entre com</p>
          <button
            type="button"
            className="botao-social botao-google"
            disabled={enviando}
            onClick={() => entrarPorProvedor(entrarComGoogle)}
          >
            <FaGoogle aria-hidden="true" /> Entrar com Google
          </button>
          <button
            type="button"
            className="botao-social botao-github"
            disabled={enviando}
            onClick={() => entrarPorProvedor(entrarComGithub)}
          >
            <FaGithub aria-hidden="true" /> Entrar com GitHub
          </button>
        </div>

        <br />
        <p>
          Não tem uma conta? <a href="/cadastro">Cadastre-se</a>
        </p>
      </div>
    </div>
  );
}

export default Login;
