import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { enviarConfirmacaoDeEmail } from '../services/auth';
import { DOMINIO_DE_PROFESSOR, ehEmailDeProfessor } from '../utils/professorPorDominio';
import { db, auth } from '../firebase';
import { verificarPermissao } from '../utils/permissoes'; // Importa a função de verificação
import { traduzirErroDeAuth } from '../utils/errosAuth';
import { useAuth } from '../contexts/AuthContext';

import '../styles/Cadastro.css';

const Cadastro = () => {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [tipo, setTipo] = useState('aluno');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();
  const { tentarNovamente } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage('');

    try {
      // Duas portas para o cadastro de professor: e-mail institucional
      // (@sp.senai.br), que ainda vai ser confirmado por link, ou e-mail
      // incluído à mão em `autorizados`. A checagem aqui só evita oferecer o
      // caminho a quem não pode; quem garante é a Security Rule.
      const emailInstitucional = ehEmailDeProfessor(email);
      const autorizado =
        tipo === 'professor' && !emailInstitucional
          ? await verificarPermissao(email.trim().toLowerCase())
          : false;

      if (tipo === 'professor' && !emailInstitucional && !autorizado) {
        setErrorMessage(
          `Para se cadastrar como professor, use o seu e-mail @${DOMINIO_DE_PROFESSOR}.`
        );
        setIsLoading(false);
        return;
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
      const usuarioRef = doc(db, 'usuarios', user.uid);
      //
      // O e-mail institucional nasce `aluno` e sobe para `professor` quando o
      // link de confirmação for aberto (services/perfilUsuario.js). Gravar
      // `professor` antes da confirmação seria recusado pela rule.
      await setDoc(usuarioRef, {
        nome,
        email,
        tipo: autorizado ? 'professor' : 'aluno',
        uid: user.uid, // Armazena o ID do usuário para referência
        criadoEm: serverTimestamp(),
        provedor: 'password',
      });

      // O link de confirmação é o "PIN" do professor: só quem tem a caixa de
      // entrada @sp.senai.br consegue abri-lo. `MinhasSalas` mostra o aviso
      // e o botão "Já confirmei" enquanto isso.
      if (emailInstitucional) {
        await enviarConfirmacaoDeEmail(user);
      }

      // A tela inicial de todo mundo é a lista de salas: o aluno novo vê ali
      // o campo do PIN, e não cai numa sala sozinho.
      // O primeiro login (disparado pela criação da conta) resolveu o papel
      // antes de este documento existir, e gravou `aluno`. Refazer a
      // resolução agora é o que faz o professor autorizado já cair em
      // "Minhas salas" com o "Criar sala", sem sair e entrar de novo.
      tentarNovamente();
      navigate('/salas');
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
            {tipo === 'professor' && (
              <p className="cadastro-dica">
                Use o seu e-mail @{DOMINIO_DE_PROFESSOR}. Vamos mandar um link de confirmação
                para ele — o acesso de professor é liberado depois que você abrir o link.
              </p>
            )}
          </div>

          {errorMessage && <div className="error-message">{errorMessage}</div>}

          <div className="button-container">
            <button type="submit" disabled={isLoading}>
              {isLoading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Cadastro;
