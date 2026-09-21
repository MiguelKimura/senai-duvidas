import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Cadastro from './components/Cadastro';
import TelaAluno from './components/TelaAluno';
import TelaProfessor from './components/TelaProfessor';
import MinhasSalas from './components/MinhasSalas';
import EntrarComPin from './components/EntrarComPin';
import CriarSala from './components/CriarSala';
import Sala from './components/Sala';
import RotaProtegida from './components/RotaProtegida';
import Footer from './components/Footer';

// O App é só roteamento.
//
// Até a v0.2.0 ele também era uma das três implementações de autenticação:
// observava o estado do Firebase Auth, montava os provedores sociais e — o
// problema central — montava o usuário com o tipo lido do armazenamento do
// navegador, caindo em "aluno" quando não havia nada. Quem decidia quem era
// professor era o navegador de cada aluno.
//
// Tudo isso foi para o `AuthProvider` (sessão e papel), para
// `services/auth.js` (chamadas ao SDK) e para `RotaProtegida` (quem entra
// onde). Aqui ficou o mapa de rotas.
//
// A v0.5.0 acrescenta as rotas de sala e **não aposenta** `/aluno` nem
// `/professor`. As duas antigas continuam abrindo as telas sem `salaId`, que
// leem as coleções globais — é o fallback de leitura da migração, no nível da
// navegação. Elas saem na 1.0.0, junto com as coleções globais.

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route
              path="/salas"
              element={
                <RotaProtegida>
                  <MinhasSalas />
                </RotaProtegida>
              }
            />
            <Route
              path="/salas/entrar"
              element={
                <RotaProtegida>
                  <EntrarComPin />
                </RotaProtegida>
              }
            />
            <Route
              path="/salas/nova"
              element={
                <RotaProtegida papel="professor">
                  <CriarSala />
                </RotaProtegida>
              }
            />
            {/* Sem `papel` de propósito: quem decide o que abrir aqui é o
                vínculo com a sala, não o papel global. Ver components/Sala. */}
            <Route
              path="/sala/:salaId"
              element={
                <RotaProtegida>
                  <Sala />
                </RotaProtegida>
              }
            />
            <Route
              path="/aluno"
              element={
                <RotaProtegida papel="aluno">
                  <TelaAluno />
                </RotaProtegida>
              }
            />
            <Route
              path="/professor"
              element={
                <RotaProtegida papel="professor">
                  <TelaProfessor />
                </RotaProtegida>
              }
            />
          </Routes>
          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
