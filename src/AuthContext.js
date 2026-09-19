import { createContext, useState, useEffect, useContext } from "react";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Estado de carregamento
  const auth = getAuth();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false); // Finaliza o carregamento após verificar o usuário
    });

    return () => unsubscribe(); // Evita vazamento de memória
    // TODO(task-01): `auth` falta nas dependências. Incluí-lo aqui recriaria a
    // inscrição a cada render, porque `getAuth()` é chamado no corpo do
    // componente. A task 01 unifica os três caminhos de autenticação e resolve
    // isso de uma vez; mexer agora mudaria comportamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Função para logout
  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
