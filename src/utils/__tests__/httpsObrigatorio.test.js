// AC-SEC-06 — o app roda apenas sob HTTPS.
//
// O laboratório é rede compartilhada. Em HTTP, o token do Firebase e o conteúdo
// do chat viajam legíveis para qualquer máquina do mesmo switch, e basta um
// aluno com um sniffer para pegar a sessão da professora. O Firebase Auth
// também só devolve a credencial do popup em origem segura.
//
// A outra metade do AC-SEC-06 — a lista de domínios autorizados do Firebase
// Auth — é configuração do console, não código; está registrada em
// `docs/PROTECAO-BRANCHES.md` e marcada como 🟡 em `docs/CRITERIOS-DE-ACEITE.md`.
import { garantirHttps } from '../httpsObrigatorio';

/** Um `window.location` de mentira, que registra a troca em vez de navegar. */
function localizacao(href) {
  const url = new URL(href);

  return {
    protocol: url.protocol,
    hostname: url.hostname,
    href: url.href,
    replace: jest.fn(),
  };
}

describe('garantirHttps — produção', () => {
  it('troca http por https mantendo caminho, porta e query', () => {
    const local = localizacao('http://duvidas.senai.br/aluno?sala=3b#topo');

    garantirHttps(local);

    expect(local.replace).toHaveBeenCalledWith('https://duvidas.senai.br/aluno?sala=3b#topo');
  });

  it('não redireciona quem já está em https', () => {
    const local = localizacao('https://duvidas.senai.br/aluno');

    garantirHttps(local);

    expect(local.replace).not.toHaveBeenCalled();
  });

  it('devolve true quando redirecionou, para o chamador não seguir montando', () => {
    expect(garantirHttps(localizacao('http://duvidas.senai.br/'))).toBe(true);
    expect(garantirHttps(localizacao('https://duvidas.senai.br/'))).toBe(false);
  });
});

describe('garantirHttps — desenvolvimento', () => {
  // `npm start` serve em http://localhost:3000 e os emuladores em 127.0.0.1.
  // Redirecionar ali deixaria o projeto impossível de rodar na máquina.
  it.each([
    'http://localhost:3000/aluno',
    'http://127.0.0.1:3000/aluno',
    'http://[::1]:3000/aluno',
  ])('não redireciona %s', (href) => {
    const local = localizacao(href);

    garantirHttps(local);

    expect(local.replace).not.toHaveBeenCalled();
  });
});

describe('garantirHttps — ambientes esquisitos', () => {
  it('não quebra sem location nenhum', () => {
    expect(() => garantirHttps(undefined)).not.toThrow();
    expect(garantirHttps(undefined)).toBe(false);
  });

  it('ignora protocolos que não são http, como o file:// de um build aberto à mão', () => {
    const local = localizacao('file:///C:/build/index.html');

    garantirHttps(local);

    expect(local.replace).not.toHaveBeenCalled();
  });
});

// Um guarda que ninguém chama não guarda nada. `src/index.js` fica fora da
// cobertura (é o bootstrap do CRA, sem como renderizar num teste), então a
// ligação é verificada lendo o arquivo — mesma abordagem de
// `src/__tests__/ci.test.js`, que confere o workflow, e de
// `src/styles/__tests__/tokens.test.js`, que confere o CSS.
describe('a aplicação chama o guarda antes de montar', () => {
  const fs = require('fs');
  const path = require('path');
  const indexJs = fs.readFileSync(
    path.join(__dirname, '..', '..', 'index.js'),
    'utf8'
  );

  it('src/index.js importa garantirHttps', () => {
    expect(indexJs).toMatch(/import\s*\{\s*garantirHttps\s*\}\s*from\s*'\.\/utils\/httpsObrigatorio'/);
  });

  it('chama garantirHttps antes do createRoot, e não depois', () => {
    const chamada = indexJs.indexOf('garantirHttps(');
    const render = indexJs.indexOf('createRoot');

    expect(chamada).toBeGreaterThan(-1);
    expect(chamada).toBeLessThan(render);
  });

  it('não monta a aplicação quando o redirecionamento começou', () => {
    // A página está sendo trocada: renderizar por cima só faz o usuário ver um
    // lampejo da tela de login antes de a navegação acontecer.
    expect(indexJs).toMatch(/if\s*\(\s*!garantirHttps\(/);
  });
});
