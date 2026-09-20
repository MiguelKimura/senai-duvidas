import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth"; 
import { db, auth } from "../firebase"; 
import { verificarPermissao } from "../utils/permissoes"; // Importa a função de verificação
import { traduzirErroDeAuth } from "../utils/errosAuth";

import '../styles/Cadastro.css';

const Cadastro = () => {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState("aluno");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage("");

    try {
      // Verifica permissão antes de cadastrar como professor
      if (tipo === "professor") {
        const podeCadastrar = await verificarPermissao(email.trim().toLowerCase()); // Normaliza o e-mail
        if (!podeCadastrar) {
          setErrorMessage("Apenas usuários autorizados podem se cadastrar como professores.");
          setIsLoading(false);
          return;
        }
      }

      // Criar usuário no Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      // Atualizar nome do usuário no Firebase Authentication
      await updateProfile(user, { displayName: nome });

      // Criar um documento no Firestore para o usuário (AC-AUTH-01).
      //
      // `criadoEm` vem do servidor de propósito: o relógio das máquinas do
      // laboratório erra com frequência, e uma data de cadastro tirada do
      // cliente seria inventada. `criadoEm` e `provedor` são aditivos — um
      // leitor da versão anterior, que não os conhece, continua lendo `nome`,
      // `email`, `tipo` e `uid` como sempre leu.
      const usuarioRef = doc(db, "usuarios", user.uid);
      await setDoc(usuarioRef, {
        nome,
        email,
        tipo,
        uid: user.uid, // Armazena o ID do usuário para referência
        criadoEm: serverTimestamp(),
        provedor: "password",
      });

      // A confirmação é a própria tela que abre. O `alert()` que ficava aqui
      // bloqueava a aba e sumia sem deixar texto nenhum na página.
      navigate(tipo === "aluno" ? "/aluno" : "/professor");
    } catch (error) {
      // Um único tradutor para todo o projeto (AC-AUTH-05). A cadeia de `if`
      // que vivia aqui tinha um ramo final que despejava `error.message` na
      // tela — código do Firebase lido por um aluno no meio da aula.
      setErrorMessage(traduzirErroDeAuth(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cadastro-container">
      <div className="cadastro-box">
        <h2>Cadastro</h2>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="nome">Nome</label>
            <input
              type="text"
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label htmlFor="email">E-mail</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
            />
          </div>
          <div className="input-group">
            <label htmlFor="tipo">Tipo</label>
            <select id="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="aluno">Aluno</option>
              <option value="professor">Professor</option>
            </select>
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <div className="button-container">
            <button type="submit" disabled={isLoading}>
              {isLoading ? "Cadastrando..." : "Cadastrar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Cadastro;
