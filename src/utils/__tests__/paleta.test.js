// A paleta do card e a conta de contraste que a guarda — AC-COR-03.
//
// Até a v0.6.0 a cor do card saía de `Math.random()`: `hsl(aleatório, 70%,
// 80%)`. Às vezes o card saía legível, às vezes saía um amarelo claro com
// texto cinza em cima. Ninguém escolheu aquilo, e ninguém conseguia consertar.
//
// A paleta troca o sorteio por uma lista curta de cores escolhidas. O valor
// desta lista não está em ela existir — está em ela ser **verificada**: o
// teste que percorre a paleta inteira exigindo 4,5:1 é o que impede que a
// próxima cor bonita e ilegível entre no arquivo sem ninguém perceber.
import { CONTRASTE_MINIMO, PALETA, corAutomatica, corDaPaleta, razaoContraste } from '../paleta';

describe('razaoContraste (fórmula WCAG de luminância relativa)', () => {
  it('dá 21 para o par de maior contraste possível, preto sobre branco', () => {
    expect(razaoContraste('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('dá 1 para uma cor contra ela mesma', () => {
    expect(razaoContraste('#ff0000', '#ff0000')).toBeCloseTo(1, 5);
  });

  it('não depende da ordem dos argumentos', () => {
    expect(razaoContraste('#000000', '#ffffff')).toBeCloseTo(
      razaoContraste('#ffffff', '#000000'),
      5
    );
  });

  // Os dois cinzas que a própria WCAG usa como exemplo da fronteira do AA:
  // #767676 passa por pouco, #777777 reprova por pouco. Se a conta estiver
  // errada em qualquer ponto da curva, um destes dois muda de lado.
  it('coloca #767676 sobre branco logo acima do mínimo AA', () => {
    expect(razaoContraste('#ffffff', '#767676')).toBeCloseTo(4.54, 2);
  });

  it('coloca #777777 sobre branco logo abaixo do mínimo AA', () => {
    expect(razaoContraste('#ffffff', '#777777')).toBeCloseTo(4.48, 2);
  });

  it('entende a forma curta de três dígitos', () => {
    expect(razaoContraste('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('recusa o que não é cor hexadecimal, em vez de devolver um número errado', () => {
    expect(() => razaoContraste('vermelho', '#000000')).toThrow();
  });
});

describe('PALETA (AC-COR-03)', () => {
  it('oferece de 8 a 10 cores, que é o que cabe numa linha sem virar catálogo', () => {
    expect(PALETA.length).toBeGreaterThanOrEqual(8);
    expect(PALETA.length).toBeLessThanOrEqual(10);
  });

  it('dá a cada cor um id, um nome em português, um fundo e um texto', () => {
    PALETA.forEach((cor) => {
      expect(cor).toMatchObject({
        id: expect.stringMatching(/^[a-z-]+$/),
        nome: expect.any(String),
        fundo: expect.stringMatching(/^#[0-9a-f]{6}$/),
        texto: expect.stringMatching(/^#[0-9a-f]{6}$/),
      });
    });
  });

  it('não repete fundo — duas opções idênticas na tela seriam uma só', () => {
    const fundos = PALETA.map((cor) => cor.fundo);
    expect(new Set(fundos).size).toBe(PALETA.length);
  });

  // O teste que existe para o futuro: quem acrescentar uma cor à paleta
  // descobre aqui, e não na aula, que o texto some em cima dela.
  it.each(PALETA.map((cor) => [cor.id, cor]))(
    'garante contraste AA (>= 4.5:1) entre texto e fundo em %s',
    (_id, cor) => {
      expect(razaoContraste(cor.fundo, cor.texto)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    }
  );
});

describe('corDaPaleta', () => {
  it('acha a entrada da paleta pelo valor de fundo gravado no chamado', () => {
    const [primeira] = PALETA;
    expect(corDaPaleta(primeira.fundo)).toEqual(primeira);
  });

  it('ignora diferença de caixa, porque CSS não diferencia', () => {
    const [primeira] = PALETA;
    expect(corDaPaleta(primeira.fundo.toUpperCase())).toEqual(primeira);
  });

  it('devolve null para a cor sorteada dos chamados antigos (AC-COR-05)', () => {
    expect(corDaPaleta('hsl(210, 70%, 80%)')).toBeNull();
  });

  it('devolve null para chamado sem cor nenhuma', () => {
    expect(corDaPaleta(undefined)).toBeNull();
  });
});

// A cor sorteada sai de `TelaAluno` e vira função aqui por um motivo prático:
// a prévia do painel avançado precisa mostrar **a** cor que o card vai ter, e
// não uma parecida. Duas expressões `Math.random()` em arquivos diferentes
// seriam duas cores diferentes na mesma tela.
describe('corAutomatica — o sorteio da v0.1.0, sem mudança de comportamento (AC-COR-05)', () => {
  it('devolve exatamente o formato que a v0.1.0 gravava', () => {
    expect(corAutomatica()).toMatch(/^hsl\(\d+(\.\d+)?, 70%, 80%\)$/);
  });

  it('varre o círculo de matizes inteiro, sem estourar 360', () => {
    const matizes = Array.from({ length: 200 }, () =>
      Number(/^hsl\(([\d.]+)/.exec(corAutomatica())[1])
    );

    expect(Math.min(...matizes)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...matizes)).toBeLessThan(360);
  });

  it('não devolve sempre a mesma cor', () => {
    const sorteios = new Set(Array.from({ length: 20 }, () => corAutomatica()));

    expect(sorteios.size).toBeGreaterThan(1);
  });
});
