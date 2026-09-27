// A sonda dos emuladores diz qual é a causa, e não só qual porta não abriu — AC-TEST-06.
//
// Este arquivo nasceu de vinte minutos perdidos na execução de release da 1.0.0,
// e o que ele conserta é uma **mensagem de erro**, não um comportamento.
//
// **O que aconteceu.** `npm run test:rules` encerrou deixando o emulador de
// Firestore órfão — o próprio Firebase avisa `Firestore Emulator has exited upon
// receiving signal: SIGKILL` e o processo Java segue de pé, segurando a 8080.
// Logo depois, `npm run test:e2e` subiu. O `webServer` do Playwright tem
// `reuseExistingServer: !process.env.CI`, e a URL que ele espera é justamente a
// da 8080: achou a porta respondendo, concluiu que a Suíte estava de pé e **não
// subiu nada**. Auth e Storage nunca abriram, e a suíte morreu dizendo:
//
//     O emulador de Auth não respondeu em http://127.0.0.1:9099/.
//     Suba o Emulator Suite (`npm run emulators`) ou rode via `npm run test:e2e`.
//
// A frase está correta e não ajuda: quem a lê **estava** rodando por
// `npm run test:e2e`, então a única conclusão possível é que o conselho não se
// aplica — e a busca começa pelo lugar errado. O que faltava na mensagem era o
// dado que decide o diagnóstico: **o Firestore estava de pé**. Uma Suíte pela
// metade não é uma Suíte que não subiu; é uma porta ocupada por outra coisa.
//
// **A regra que fica.** Quando uma sonda estoura, a sonda varre as três portas
// antes de lançar, e a mensagem distingue os dois casos — nenhum de pé (a Suíte
// não subiu) de alguns de pé (há órfão segurando a porta). Um deles se resolve
// subindo os emuladores; o outro, encerrando um processo. Dizer "suba os
// emuladores" no segundo caso manda a pessoa para o lado oposto.
//
// A varredura recebe a sondagem por parâmetro: é o que deixa este teste provar o
// laço sem rede, sem emulador e sem esperar os 180 segundos do teto real.
const fs = require('fs');
const path = require('path');

const {
  PORTA_FIRESTORE,
  mensagemDeFalha,
  varrerSondas,
} = require('../../tests/e2e/fixtures/emulador');

const FONTE_DA_SONDA = fs.readFileSync(
  path.join(__dirname, '..', '..', 'tests', 'e2e', 'fixtures', 'emulador.js'),
  'utf8'
);

/** Uma sondagem falsa que responde `true` só para as portas listadas. */
const sondaQueAtende = (portas) => async (url) =>
  portas.some((porta) => url.includes(`:${porta}/`));

describe('a varredura das portas diz quem está de pé', () => {
  it('varre os três emuladores, e não só o que estourou', async () => {
    const varredura = await varrerSondas(sondaQueAtende([PORTA_FIRESTORE]));

    expect(varredura.map(({ nome }) => nome).sort()).toEqual(['Auth', 'Firestore', 'Storage']);
  });

  it('marca de pé quem responde, e caído quem não', async () => {
    const varredura = await varrerSondas(sondaQueAtende([PORTA_FIRESTORE]));
    const dePe = varredura.filter(({ respondeu }) => respondeu).map(({ nome }) => nome);

    expect(dePe).toEqual(['Firestore']);
  });

  it('não inventa que está de pé quando nada responde', async () => {
    const varredura = await varrerSondas(sondaQueAtende([]));

    expect(varredura.every(({ respondeu }) => respondeu === false)).toBe(true);
  });
});

describe('a mensagem de falha separa a Suíte que não subiu da porta ocupada', () => {
  const varredura = (dePe) =>
    ['Auth', 'Firestore', 'Storage'].map((nome) => ({ nome, respondeu: dePe.includes(nome) }));

  it('com nada de pé, manda subir a Suíte', () => {
    const mensagem = mensagemDeFalha('Auth', 'http://127.0.0.1:9099/', varredura([]));

    expect(mensagem).toContain('Auth');
    expect(mensagem).toContain('http://127.0.0.1:9099/');
    expect(mensagem).toMatch(/npm run (test:e2e|emulators)/);
    // Este é o caso em que "suba os emuladores" é o conselho certo — e é
    // justamente por isso que ele não pode aparecer no caso de baixo.
    expect(mensagem).not.toMatch(/órfão|orfão/i);
  });

  it('com o Firestore de pé, acusa o órfão na porta em vez de mandar subir a Suíte', () => {
    const mensagem = mensagemDeFalha('Auth', 'http://127.0.0.1:9099/', varredura(['Firestore']));

    // O dado que resolvia o diagnóstico e não estava na mensagem.
    expect(mensagem).toContain('Firestore');
    expect(mensagem).toMatch(/órfão/i);
    // E o mecanismo, porque sem ele a pessoa não entende por que a Suíte não
    // subiu tendo sido mandada a subir.
    expect(mensagem).toContain('reuseExistingServer');
    expect(mensagem).toContain(String(PORTA_FIRESTORE));
  });

  it('não lista como de pé o emulador que acabou de falhar', () => {
    // Uma varredura pode ser vencida por um emulador que sobe entre o estouro e
    // ela. Listar o próprio faltante como "de pé" faria a mensagem se
    // contradizer na mesma frase.
    const mensagem = mensagemDeFalha('Auth', 'http://127.0.0.1:9099/', varredura(['Auth']));

    expect(mensagem).not.toMatch(/Auth (já )?está de pé/);
  });
});

describe('quem espera as portas usa a varredura antes de desistir', () => {
  it('a espera lança pela mensagem de falha, e não por um texto solto', () => {
    // Lido como texto porque o caminho contrário — deixar `aguardarEmuladores()`
    // estourar de verdade — custaria os 180s do teto real dentro da suíte
    // unitária. A mesma técnica de `prontidaoDosEmuladores.test.js`.
    expect(FONTE_DA_SONDA).toMatch(/throw new Error\(\s*(await\s+)?mensagemDeFalha\(/);
  });

  it('a varredura acontece antes do `throw`, não depois', () => {
    const trechoDaEspera = FONTE_DA_SONDA.slice(
      FONTE_DA_SONDA.indexOf('function aguardarEmuladores')
    );

    expect(trechoDaEspera.indexOf('varrerSondas()')).toBeGreaterThan(-1);
    expect(trechoDaEspera.indexOf('varrerSondas()')).toBeLessThan(
      trechoDaEspera.indexOf('throw new Error')
    );
  });
});
