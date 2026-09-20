// O PIN de entrada na sala — AC-SALA-02, AC-SALA-04, AC-SEC-05.
//
// Seis dígitos são um milhão de combinações. Dois números decidem se isso é
// pouco ou muito: quantas tentativas alguém consegue fazer (AC-SALA-12, provado
// nas rules) e quão previsível é o próximo PIN. Este arquivo cobre o segundo.
import {
  ERRO_DE_LIMITE,
  ERRO_DE_PIN,
  TAMANHO_DO_PIN,
  ehPinValido,
  gerarPin,
  gerarSal,
  hashDePin,
  normalizarPin,
} from '../pin';

describe('gerarPin — AC-SALA-02', () => {
  it('produz exatamente seis dígitos numéricos', () => {
    expect(gerarPin()).toMatch(/^[0-9]{6}$/);
  });

  it('produz seis dígitos em toda geração, quinhentas vezes seguidas', () => {
    const gerados = Array.from({ length: 500 }, gerarPin);

    expect(gerados.every((pin) => /^[0-9]{6}$/.test(pin))).toBe(true);
    expect(gerados.every((pin) => pin.length === TAMANHO_DO_PIN)).toBe(true);
  });

  it('não repete o mesmo PIN a cada chamada', () => {
    const gerados = new Set(Array.from({ length: 200 }, gerarPin));

    // Com um milhão de combinações, 200 sorteios repetidos seriam ~0.02
    // colisões esperadas. Um gerador travado devolveria 1 valor distinto.
    expect(gerados.size).toBeGreaterThan(190);
  });

  it('usa o gerador criptográfico do navegador, e nunca Math.random', () => {
    const sorteio = jest.spyOn(globalThis.crypto, 'getRandomValues');
    const mathRandom = jest.spyOn(Math, 'random');

    gerarPin();

    expect(sorteio).toHaveBeenCalled();
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it('sorteia os dez dígitos, sem faixa morta', () => {
    // Um `byte % 10` sem descarte enviesaria os dígitos 0 a 5. O teste não
    // prova ausência de viés, mas pega a falha grosseira: dígito que nunca sai.
    const digitos = new Set(Array.from({ length: 500 }, gerarPin).join(''));

    expect(digitos.size).toBe(10);
  });
});

describe('ehPinValido — o formato aceito', () => {
  it('aceita seis dígitos, inclusive com zeros à esquerda', () => {
    expect(ehPinValido('000000')).toBe(true);
    expect(ehPinValido('042317')).toBe(true);
  });

  it.each([
    ['curto demais', '12345'],
    ['longo demais', '1234567'],
    ['com letra', '12a456'],
    ['com espaço', '12 456'],
    ['vazio', ''],
  ])('recusa PIN %s', (_rotulo, valor) => {
    expect(ehPinValido(valor)).toBe(false);
  });

  it('recusa o que não é nem string', () => {
    expect(ehPinValido(123456)).toBe(false);
    expect(ehPinValido(null)).toBe(false);
    expect(ehPinValido(undefined)).toBe(false);
  });
});

describe('normalizarPin — o que o aluno digita', () => {
  it('tira espaços e traços que o aluno cola junto com o número', () => {
    expect(normalizarPin(' 12 34-56 ')).toBe('123456');
  });

  it('não corta o excesso: PIN de sete dígitos continua inválido', () => {
    expect(ehPinValido(normalizarPin('1234567'))).toBe(false);
  });

  it('devolve string vazia para o que não é string', () => {
    expect(normalizarPin(null)).toBe('');
    expect(normalizarPin(123456)).toBe('');
  });
});

describe('gerarSal — o sal por sala', () => {
  it('produz 32 caracteres hexadecimais', () => {
    expect(gerarSal()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('é diferente a cada sala', () => {
    const sais = new Set(Array.from({ length: 50 }, gerarSal));

    expect(sais.size).toBe(50);
  });
});

describe('hashDePin — o que vai para o banco no lugar do PIN (AC-SEC-05)', () => {
  it('é o SHA-256 de sal + PIN, em hexadecimal minúsculo', async () => {
    // Vetor fixo: o mesmo valor que `hashing.sha256('a1b2c3' + '123456')`
    // devolve nas Security Rules. É esse acordo que deixa o servidor conferir
    // o PIN sem que ninguém precise ler o segredo da sala.
    await expect(hashDePin('123456', 'a1b2c3')).resolves.toBe(
      '39c38e45f568ce9a99e26811f8dc1ba43071dba7e1b0f239974fd586d5ade1c3'
    );
  });

  it('muda quando o PIN muda, com o mesmo sal', async () => {
    await expect(hashDePin('654321', 'a1b2c3')).resolves.toBe(
      '63e81bfbec48c21f51423a39dc149c68b9b7fb48163b3194425bfed7f5a02a4c'
    );
  });

  it('muda quando o sal muda, com o mesmo PIN', async () => {
    const [comUmSal, comOutro] = await Promise.all([
      hashDePin('123456', await gerarSal()),
      hashDePin('123456', await gerarSal()),
    ]);

    expect(comUmSal).not.toBe(comOutro);
  });

  it('é determinístico: o mesmo par sempre dá o mesmo resumo', async () => {
    const sal = gerarSal();

    await expect(hashDePin('123456', sal)).resolves.toBe(await hashDePin('123456', sal));
  });

  it('não deixa o PIN legível dentro do resumo', async () => {
    const resumo = await hashDePin('123456', 'a1b2c3');

    expect(resumo).toMatch(/^[0-9a-f]{64}$/);
    expect(resumo).not.toContain('123456');
  });
});

describe('mensagens de erro — AC-SALA-04', () => {
  it('a recusa do PIN não revela se ele existe em outra sala', () => {
    expect(ERRO_DE_PIN).not.toMatch(/outra sala|existe|encontrad/i);
    expect(ERRO_DE_PIN).toMatch(/PIN/);
  });

  it('o bloqueio por tentativas diz quanto esperar', () => {
    expect(ERRO_DE_LIMITE).toMatch(/5 minutos/);
  });
});
