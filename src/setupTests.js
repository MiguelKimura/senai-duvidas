// Configuração global da suíte unitária, carregada pelo Jest do react-scripts
// antes de cada arquivo de teste (jest.setupFilesAfterEach).
//
// Traz os matchers de DOM (`toBeInTheDocument`, `toHaveTextContent`, ...) e
// garante que nenhum teste unitário toque a rede ou o projeto de produção:
// os módulos do Firebase têm mocks manuais em `src/__mocks__/firebase/`.
import '@testing-library/jest-dom';
import { configure } from '@testing-library/dom';
import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';
import { instalarSuporteAHsl } from './test-utils/corDeFundo';

// O jsdom do react-scripts descarta `hsl()`. Toda cor desta base é `hsl()`,
// então sem isto as asserções de cor passam a valer nada. Ver corDeFundo.js.
instalarSuporteAHsl();

// O teto de espera de `waitFor`, `findBy*` e companhia.
//
// O padrão é um segundo, e ele passou a apertar na task 04: o upload de um
// anexo atravessa `FileReader`, `createImageBitmap` e `canvas.toBlob` antes de
// chegar ao Storage, e cada um desses passos é um ciclo a mais do laço de
// eventos. Com a suíte inteira rodando em paralelo numa máquina carregada, um
// segundo vira um sorteio — e o teste que falha não é o que está errado, é o
// que teve azar de agendamento. Cinco segundos só custam tempo quando algo
// realmente quebrou.
configure({ asyncUtilTimeout: 5000 });

// Guarda-chuva contra o erro mais caro que esta suíte pode cometer: falar com o
// projeto real `senai-duvidas`. Os testes unitários rodam inteiramente em
// memória; os de integração usam o emulador com `projectId` de teste.
beforeEach(() => {
  jest.clearAllMocks();
});

// Web Crypto e TextEncoder, que o jsdom do react-scripts não traz.
//
// O PIN da sala é sorteado com `crypto.getRandomValues` e resumido com
// `crypto.subtle` — as duas APIs padrão de navegador que a task 03 usa
// (AC-SALA-02, AC-SEC-05). O Node tem as duas, e são a mesma implementação
// que o Chrome usa; sem elas aqui, o teste provaria um substituto em vez de
// provar o código que roda no laboratório.
if (typeof globalThis.TextEncoder === 'undefined') globalThis.TextEncoder = TextEncoder;
if (typeof globalThis.TextDecoder === 'undefined') globalThis.TextDecoder = TextDecoder;

if (!globalThis.crypto || !globalThis.crypto.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
