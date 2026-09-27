// Provider único de autenticação — AC-AUTH-06, AC-AUTH-08, AC-AUTH-09.
//
// Substitui as três implementações concorrentes da v0.2.0: o
// `onAuthStateChanged` de `App.js` (que lia o papel do localStorage), o
// `AuthContext.js` órfão e o listener solto no topo de `firebase.js`. Havendo
// um só, a tela de login deixa de piscar: não existe mais um segundo listener
// decidindo rota enquanto o primeiro ainda resolve.
//
// A API deste contexto é consumida pela task 03 (salas) e pela 09 (perks).
// `papel` é o papel **global** da pessoa; "professor desta sala" é checagem por
// sala e não mora aqui.
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  entrarComEmailESenha,
  entrarComGithub as entrarComGithubNoFirebase,
  entrarComGoogle as entrarComGoogleNoFirebase,
  observarAutenticacao,
  sair as sairDoFirebase,
} from '../services/auth';
import { garantirPerfil } from '../services/perfilUsuario';
import { traduzirErroDeAuth } from '../utils/errosAuth';

/**
 * Falha de leitura do Firestore ao resolver o papel. Não é erro de
 * autenticação: a pessoa entrou, o que faltou foi saber o que ela pode fazer.
 * Assumir "aluno" aqui seria decidir permissão por indisponibilidade de rede.
 */
const ERRO_AO_RESOLVER_PAPEL =
  'Não foi possível confirmar seu acesso agora. Verifique a conexão e tente novamente.';

/** Aviso exibido à conta legada de professor que saiu de `autorizados`. */
const AVISO_DE_REBAIXAMENTO =
  'Seu acesso de professor não está mais autorizado. Você entrou como aluno — ' +
  'procure o responsável pelo sistema para regularizar.';

/**
 * Chaves que a v0.2.0 gravava no navegador. `usuarioLogado` guardava a sessão
 * inteira e `tipoUsuario` decidia o papel. Nenhuma das duas é escrita a partir
 * desta versão; continuam listadas para serem **apagadas** no logout e não
 * ressuscitarem numa máquina de laboratório compartilhada (AC-AUTH-08).
 */
const CHAVES_LEGADAS = ['usuarioLogado', 'tipoUsuario'];

/**
 * @typedef {object} ContextoDeAutenticacao
 * @property {object|null} usuario usuário do Firebase Auth, ou `null` sem sessão.
 * @property {object|null} perfil documento `usuarios/{uid}`, ou `null`.
 * @property {'aluno'|'professor'|null} papel papel global, resolvido só pelo Firestore.
 * @property {boolean} carregando `true` enquanto o papel não está resolvido.
 * @property {string|null} erro mensagem em português, pronta para exibir.
 * @property {string|null} aviso mensagem não bloqueante (ex.: rebaixamento).
 * @property {(email: string, senha: string) => Promise<boolean>} entrarComEmail
 * @property {() => Promise<boolean>} entrarComGoogle
 * @property {() => Promise<boolean>} entrarComGithub
 * @property {() => Promise<void>} sair
 * @property {() => void} tentarNovamente refaz a resolução do papel após falha.
 * @property {() => void} limparErro
 */

const Contexto = createContext(null);

/** Estado de quem não tem sessão. Uma constante evita esquecer um campo. */
const SEM_SESSAO = { usuario: null, perfil: null, papel: null };

/** Apaga o que a versão anterior deixava gravado no navegador. */
function limparEstadoLocal() {
  CHAVES_LEGADAS.forEach((chave) => {
    try {
      window.localStorage.removeItem(chave);
      window.sessionStorage.removeItem(chave);
    } catch (erro) {
      // Navegador com armazenamento bloqueado (AC-SESSAO-06). Não há o que
      // limpar, e travar o logout por causa disso seria pior.
    }
  });
}

/**
 * Provider único da aplicação. Envolve o roteamento inteiro em `App.js` e os
 * testes em `src/test-utils/renderComProvedores.js`.
 *
 * @param {{children: React.ReactNode}} props
 */
export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(SEM_SESSAO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [tentativa, setTentativa] = useState(0);

  // `montado` evita atualizar estado depois do unmount: entre o
  // onAuthStateChanged e o fim de `garantirPerfil` existe uma ida ao Firestore,
  // e o componente pode sair da tela nesse intervalo.
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    setCarregando(true);

    const cancelar = observarAutenticacao(async (usuarioDoAuth) => {
      if (!montado.current) return;

      if (!usuarioDoAuth) {
        setSessao(SEM_SESSAO);
        setAviso(null);
        setCarregando(false);
        return;
      }

      setCarregando(true);

      try {
        const { perfil, papel, rebaixado } = await garantirPerfil(usuarioDoAuth);
        if (!montado.current) return;

        setSessao({ usuario: usuarioDoAuth, perfil, papel });
        setAviso(rebaixado ? AVISO_DE_REBAIXAMENTO : null);
        setErro(null);
      } catch (falha) {
        if (!montado.current) return;

        // Autenticado, porém sem papel: a interface mostra o erro e oferece
        // "tentar novamente". Nenhuma rota protegida abre neste estado.
        setSessao({ usuario: usuarioDoAuth, perfil: null, papel: null });
        setErro(ERRO_AO_RESOLVER_PAPEL);
      } finally {
        if (montado.current) setCarregando(false);
      }
    });

    return () => {
      montado.current = false;
      cancelar();
    };
  }, [tentativa]);

  /**
   * Executa um login e converte a falha em mensagem exibível.
   * @param {() => Promise<object>} login
   * @returns {Promise<boolean>} `true` quando a autenticação conclui.
   */
  const tentarEntrar = useCallback(async (login) => {
    setErro(null);

    try {
      await login();
      // O papel é resolvido pelo `observarAutenticacao` acima: é ele que
      // enxerga tanto este login quanto a sessão restaurada do IndexedDB.
      return true;
    } catch (falha) {
      if (montado.current) setErro(traduzirErroDeAuth(falha));
      return false;
    }
  }, []);

  const entrarComEmail = useCallback(
    (email, senha) => tentarEntrar(() => entrarComEmailESenha(email, senha)),
    [tentarEntrar]
  );

  const entrarComGoogle = useCallback(
    () => tentarEntrar(entrarComGoogleNoFirebase),
    [tentarEntrar]
  );

  const entrarComGithub = useCallback(
    () => tentarEntrar(entrarComGithubNoFirebase),
    [tentarEntrar]
  );

  const sair = useCallback(async () => {
    await sairDoFirebase();
    limparEstadoLocal();

    if (!montado.current) return;

    setSessao(SEM_SESSAO);
    setErro(null);
    setAviso(null);
    setCarregando(false);
  }, []);

  /** Refaz a inscrição e, com ela, a resolução do papel. */
  const tentarNovamente = useCallback(() => {
    setErro(null);
    setTentativa((anterior) => anterior + 1);
  }, []);

  const limparErro = useCallback(() => setErro(null), []);

  const valor = useMemo(
    () => ({
      usuario: sessao.usuario,
      perfil: sessao.perfil,
      papel: sessao.papel,
      carregando,
      erro,
      aviso,
      entrarComEmail,
      entrarComGoogle,
      entrarComGithub,
      sair,
      tentarNovamente,
      limparErro,
    }),
    [
      sessao,
      carregando,
      erro,
      aviso,
      entrarComEmail,
      entrarComGoogle,
      entrarComGithub,
      sair,
      tentarNovamente,
      limparErro,
    ]
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/**
 * Acessa o contexto de autenticação.
 * @returns {ContextoDeAutenticacao}
 * @throws {Error} quando usado fora de `<AuthProvider>` — falhar aqui é melhor
 *   do que devolver `undefined` e quebrar três componentes adiante.
 */
export function useAuth() {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }

  return contexto;
}
