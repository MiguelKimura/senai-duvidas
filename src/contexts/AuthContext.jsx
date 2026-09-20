// Esqueleto do provider único. Existe para que o teste do ciclo falhe na
// asserção, e não no import.
import React, { createContext, useContext } from 'react';

const ContextoDeAutenticacao = createContext(null);

export function AuthProvider({ children }) {
  return (
    <ContextoDeAutenticacao.Provider value={{}}>{children}</ContextoDeAutenticacao.Provider>
  );
}

export function useAuth() {
  return useContext(ContextoDeAutenticacao) || {};
}
