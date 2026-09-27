// As preferências de interface do usuário — AC-PERK-08.
//
// O `AuthContext` traz o documento `usuarios/{uid}` uma vez, no login, e não o
// reemite: não há `onSnapshot` sobre ele, e não deveria haver — seria um
// listener por aluno, aberto a aula inteira, para um documento que muda duas
// vezes por ano. Por isso o estado corrente mora aqui: o perfil dá o valor
// inicial, e a partir daí quem sabe o que o aluno escolheu é este hook.
//
// A escrita é otimista, com volta atrás. Marcar a caixa e esperar o Firestore
// responder deixaria a interface travada por uma rede de laboratório; marcar e
// **não** voltar atrás quando o servidor recusa seria pior, porque a tela
// passaria a afirmar um estado que o banco não tem.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { lerPreferencias, salvarPreferencias } from '../services/perfilUsuario';

/** O que a tela diz quando o servidor recusa a gravação. */
export const ERRO_AO_SALVAR =
  'Não foi possível salvar sua preferência agora. Tente de novo em instantes.';

/**
 * As preferências de quem está logado, com gravação.
 *
 * @returns {{
 *   preferencias: {animacoes: boolean, som: boolean},
 *   alterar: (chave: string, valor: boolean) => Promise<void>,
 *   erro: string|null
 * }}
 */
export function usePreferencias() {
  const { usuario, perfil } = useAuth();

  const [preferencias, setPreferencias] = useState(() => lerPreferencias(perfil));
  const [erro, setErro] = useState(null);

  // O perfil chega depois do primeiro render: entre o `onAuthStateChanged` e o
  // fim de `garantirPerfil` existe uma ida ao Firestore, e até lá o valor
  // inicial é o padrão seguro.
  useEffect(() => {
    setPreferencias(lerPreferencias(perfil));
  }, [perfil]);

  const alterar = useCallback(
    async (chave, valor) => {
      if (!usuario) return;

      const anteriores = preferencias;
      const novas = { ...anteriores, [chave]: valor };

      setErro(null);
      setPreferencias(novas);

      try {
        await salvarPreferencias(usuario.uid, novas);
      } catch {
        // A caixa volta ao que o banco tem. Deixá-la marcada faria a tela
        // prometer um silêncio que o próximo carregamento não vai cumprir.
        setPreferencias(anteriores);
        setErro(ERRO_AO_SALVAR);
      }
    },
    [usuario, preferencias]
  );

  return { preferencias, alterar, erro };
}
