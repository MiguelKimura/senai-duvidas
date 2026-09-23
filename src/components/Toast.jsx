// Esqueleto: a superfície existe, o comportamento não. Serve para o teste
// falhar por asserção — "o toast não apareceu" — e não por import quebrado.
import React, { createContext, useContext } from 'react';

export const DURACAO_MINIMA_MS = 4000;
export const TIPO_SUCESSO = 'sucesso';
export const TIPO_ERRO = 'erro';
export const TIPO_AVISO = 'aviso';
export const TIPO_INFORMACAO = 'informacao';

const Contexto = createContext(null);

export function ProvedorDeToasts({ children }) {
  return <Contexto.Provider value={{}}>{children}</Contexto.Provider>;
}

export function useToasts() {
  useContext(Contexto);

  return { mostrar: () => {}, fechar: () => {} };
}
