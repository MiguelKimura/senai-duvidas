// Configuração global da suíte unitária, carregada pelo Jest do react-scripts
// antes de cada arquivo de teste (jest.setupFilesAfterEach).
//
// Traz os matchers de DOM (`toBeInTheDocument`, `toHaveTextContent`, ...) e
// garante que nenhum teste unitário toque a rede ou o projeto de produção:
// os módulos do Firebase têm mocks manuais em `src/__mocks__/firebase/`.
import '@testing-library/jest-dom';
import { instalarSuporteAHsl } from './test-utils/corDeFundo';

// O jsdom do react-scripts descarta `hsl()`. Toda cor desta base é `hsl()`,
// então sem isto as asserções de cor passam a valer nada. Ver corDeFundo.js.
instalarSuporteAHsl();

// Guarda-chuva contra o erro mais caro que esta suíte pode cometer: falar com o
// projeto real `senai-duvidas`. Os testes unitários rodam inteiramente em
// memória; os de integração usam o emulador com `projectId` de teste.
beforeEach(() => {
  jest.clearAllMocks();
});
