// A cor lembrada entre chamados — AC-COR-10.
//
// O aluno que escolhe azul escolhe azul de novo no chamado seguinte, e no
// outro. Fazer com que ele reescolha toda vez é pedir três cliques por
// chamado para chegar ao mesmo lugar.
//
// A preferência é **local**, e não do perfil no banco: ela é sobre o gosto de
// quem está naquela máquina naquela aula, não vale uma escrita no Firestore a
// cada chamado, e não tem por que atravessar a rede. A consequência aceita é
// que trocar de computador recomeça do zero — e o custo disso é um clique.
//
// Os dois casos que mais importam aqui são os de desconfiança. `localStorage`
// é editável pelo aluno no console do navegador, e o que sai dele vai direto
// para `style.backgroundColor` de um card que a turma inteira vê.
import { CHAVE_DA_COR, guardarCorPreferida, lerCorPreferida } from '../preferenciaDeCor';
import { PALETA } from '../paleta';

beforeEach(() => {
  window.localStorage.clear();
});

describe('preferenciaDeCor — o caminho normal', () => {
  it('não lembra nada de quem nunca escolheu (AC-COR-05)', () => {
    expect(lerCorPreferida()).toBeNull();
  });

  it('lembra a cor escolhida no chamado anterior', () => {
    guardarCorPreferida(PALETA[6].fundo);

    expect(lerCorPreferida()).toBe(PALETA[6].fundo);
  });

  it('esquece quando o aluno volta para a automática', () => {
    guardarCorPreferida(PALETA[6].fundo);
    guardarCorPreferida(null);

    expect(lerCorPreferida()).toBeNull();
    expect(window.localStorage.getItem(CHAVE_DA_COR)).toBeNull();
  });
});

describe('preferenciaDeCor — o que vem de fora não é confiável', () => {
  it('ignora cor que não está na paleta, venha ela de onde vier', () => {
    window.localStorage.setItem(CHAVE_DA_COR, '#123456');

    expect(lerCorPreferida()).toBeNull();
  });

  it('ignora um valor de CSS inteiro escrito à mão no console', () => {
    window.localStorage.setItem(CHAVE_DA_COR, 'red; background-image: url(//evil.example/x)');

    expect(lerCorPreferida()).toBeNull();
  });

  it('não grava cor fora da paleta nem quando o código pede', () => {
    guardarCorPreferida('#123456');

    expect(window.localStorage.getItem(CHAVE_DA_COR)).toBeNull();
  });
});

describe('preferenciaDeCor — quando não há storage', () => {
  /** Troca o `localStorage` por um que recusa tudo, como o modo privado faz. */
  function comStorageQuebrado(executar) {
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const quebrado = {
      getItem: () => {
        throw new DOMException('SecurityError');
      },
      setItem: () => {
        throw new DOMException('QuotaExceededError');
      },
      removeItem: () => {
        throw new DOMException('SecurityError');
      },
    };

    Object.defineProperty(window, 'localStorage', { configurable: true, value: quebrado });
    try {
      executar();
    } finally {
      Object.defineProperty(window, 'localStorage', original);
    }
  }

  // O aluno perde a preferência, e é só isso que ele perde. Uma exceção aqui
  // derrubaria o modal inteiro e ele não conseguiria abrir chamado nenhum.
  it('lê como se não houvesse preferência, em vez de lançar', () => {
    comStorageQuebrado(() => {
      expect(lerCorPreferida()).toBeNull();
    });
  });

  it('desiste de gravar em silêncio, em vez de lançar', () => {
    comStorageQuebrado(() => {
      expect(() => guardarCorPreferida(PALETA[0].fundo)).not.toThrow();
    });
  });
});
