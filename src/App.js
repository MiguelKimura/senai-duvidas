import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RotaProtegida from './components/RotaProtegida';
import Footer from './components/Footer';
import { ProvedorDeToasts } from './components/Toast';

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
// A v0.5.0 acrescentou as rotas de sala sem aposentar `/aluno` e
// `/professor`, que abriam as telas sem `salaId` e liam as coleções globais —
// o fallback de leitura da migração. A v1.1.0 aposenta as duas: elas
// redirecionam para `/salas`. Os dados das coleções globais eram de uma turma
// que já se formou, e a tela sem sala fazia o aluno novo "entrar numa sala"
// sem PIN nenhum. Os endereços continuam respondendo, para não quebrar
// favorito antigo (`docs/MIGRACOES.md`).
//
// ---------------------------------------------------------------------------
// Code-splitting por rota (AC-PERF-02)
// ---------------------------------------------------------------------------
//
// Cada tela de rota entra por `lazy(() => import(...))`, e o webpack emite um
// pedaço por tela. Até a 1.0.0 havia um `main.js` só: o aluno que abria o
// endereço para fazer login baixava, antes de digitar o e-mail, a tela do
// professor, o painel da turma, o painel de perks, a animação de premiação em
// tela cheia e o `marked` inteiro para renderizar markdown que ele ainda não
// tinha escrito.
//
// Na máquina do laboratório, com cache quente, isso não se nota. No celular do
// aluno no pátio, em 3G, é a diferença entre entrar na aula e desistir — que é
// exatamente o cenário do AC-PERF-01.
//
// O que **não** está dividido, e por quê: `RotaProtegida`, `Footer`,
// `AuthProvider` e `ProvedorDeToasts` aparecem em toda rota. Dividi-los custaria
// uma segunda ida à rede para carregar o que vai ser usado de qualquer forma.
const Login = lazy(() => import('./components/Login'));
const Cadastro = lazy(() => import('./components/Cadastro'));
const MinhasSalas = lazy(() => import('./components/MinhasSalas'));
const EntrarComPin = lazy(() => import('./components/EntrarComPin'));
const CriarSala = lazy(() => import('./components/CriarSala'));
const Sala = lazy(() => import('./components/Sala'));

/**
 * O que aparece enquanto o pedaço da rota está vindo pela rede.
 *
 * `fallback={null}` seria uma linha mais curta e uma tela branca: quem usa
 * leitor de tela não teria nada para ouvir, e é o mesmo defeito que o
 * AC-AUTH-09 proíbe no portão de autenticação. O texto é o mesmo
 * "Carregando..." do resto do app de propósito — a espera pela rede e a espera
 * pelo papel são a mesma coisa para quem está olhando.
 */
function CarregandoRota() {
  return (
    <p className="carregando-rota" role="status" aria-live="polite">
      Carregando...
    </p>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        {/* A pilha de avisos fica ACIMA das rotas: um toast disparado ao
            excluir um chamado precisa sobreviver à navegação que a exclusão
            possa causar, e uma pilha por tela some no meio do aviso
            (AC-ANIM-07). */}
        <ProvedorDeToasts>
          <div className="App">
            {/* Um `Suspense` só, em volta de todas as rotas: a troca de rota
                troca o pedaço, e um limite por rota repetiria a mesma espera
                oito vezes sem mudar nada do que o usuário vê. */}
            <Suspense fallback={<CarregandoRota />}>
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
                <Route path="/aluno" element={<Navigate to="/salas" replace />} />
                <Route path="/professor" element={<Navigate to="/salas" replace />} />
              </Routes>
            </Suspense>
            <Footer />
          </div>
        </ProvedorDeToasts>
      </AuthProvider>
    </Router>
  );
}

export default App;
