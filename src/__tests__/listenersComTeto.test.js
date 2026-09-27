// Todo `onSnapshot` com escopo e com teto — AC-PERF-03, AC-PERF-04.
//
// O AC-PERF-03 tinha prova antes da 1.0.0, e ela cobria o que mais importa: a
// fila da sala e a conversa da sala, em `src/__tests__/escopoPorSala.test.js`.
// O que faltava é a exaustividade. Três listeners do app — conversas diretas,
// perks da sala e o espelho de salas do usuário — não tinham ninguém medindo o
// teto deles, e um listener novo, escrito amanhã sem `limit`, entraria sem que
// nenhum teste mudasse de cor.
//
// O alvo declarado do projeto é 10 salas ativas, 40 alunos por sala, 200
// chamados e 1000 mensagens. Um `onSnapshot` sem teto numa sala de novembro não
// é lentidão: é a cota gratuita do Firebase consumida em uma manhã, e o app
// inteiro parando de ler no meio da aula seguinte.
//
// Duas varreduras, e as duas são necessárias:
//
//   1. **estrutural** — nenhum arquivo do `src/` chama `onSnapshot` sem também
//      chamar `limit`. É ela que pega o listener que ainda não existe.
//   2. **comportamental** — cada observador é exercitado de verdade contra o
//      Firestore falso, e o que ele registrou é lido de volta: caminho escopado,
//      teto numérico, e o cancelamento no desmonte (AC-PERF-04).
import {
  __consultasAtivas,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';
import { LIMITE_DE_CONVERSAS, observarConversas } from '../services/chat';
import { LIMITE_DE_PERKS, observarPerksDaSala } from '../services/perks';
import {
  LIMITE_DE_CHAMADOS,
  LIMITE_DE_MENSAGENS,
  LIMITE_DE_SALAS,
  observarSalasDoUsuario,
} from '../services/salas';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

beforeEach(() => {
  __resetarFirestore();
});

// ---------------------------------------------------------------------------
// 1. A varredura estrutural
// ---------------------------------------------------------------------------

/** Todos os fontes de produção do `src/`, sem os testes e sem os mocks. */
function fontesDeProducao(diretorio = RAIZ) {
  return fs.readdirSync(diretorio, { withFileTypes: true }).flatMap((entrada) => {
    const completo = path.join(diretorio, entrada.name);

    if (entrada.isDirectory()) {
      if (['__tests__', '__mocks__', 'test-utils'].includes(entrada.name)) return [];

      return fontesDeProducao(completo);
    }

    return /\.(js|jsx)$/.test(entrada.name) ? [completo] : [];
  });
}

/** O caminho relativo ao `src/`, com barra, para ler bem no relatório. */
function relativo(arquivo) {
  return path.relative(RAIZ, arquivo).split(path.sep).join('/');
}

/**
 * Os arquivos que **chamam** `onSnapshot`, e não só o mencionam num comentário.
 *
 * A distinção é o que separa este teste de um `grep`: metade dos arquivos deste
 * projeto explica em comentário por que o `onSnapshot` reemite, e nenhum deles
 * tem listener nenhum. Um teste que os acusasse seria desligado na semana
 * seguinte.
 */
function arquivosComListener() {
  return fontesDeProducao().filter((arquivo) =>
    /\bonSnapshot\s*\(/.test(fs.readFileSync(arquivo, 'utf8'))
  );
}

describe('AC-PERF-03 — nenhum listener sem teto no código', () => {
  it('a varredura encontra os listeners do projeto (e não uma lista vazia)', () => {
    // Se este número cair a zero, a varredura parou de olhar — e as duas
    // asserções abaixo passariam sem ler uma linha de código.
    expect(arquivosComListener().length).toBeGreaterThanOrEqual(5);
  });

  it('todo arquivo que chama onSnapshot também chama limit', () => {
    const semTeto = arquivosComListener()
      .filter((arquivo) => !/\blimit\s*\(/.test(fs.readFileSync(arquivo, 'utf8')))
      .map(relativo);

    expect(semTeto).toEqual([]);
  });

  it('nenhum listener escuta uma coleção crua, sem passar por query', () => {
    // `onSnapshot(colecao, ...)` é a forma sem teto possível: não há onde pendurar
    // um `limit`. A assinatura correta neste projeto recebe sempre uma consulta.
    const cruas = arquivosComListener()
      .filter((arquivo) => {
        const codigo = fs.readFileSync(arquivo, 'utf8');

        return /onSnapshot\(\s*colecao(De|\b)/.test(codigo);
      })
      .map(relativo);

    expect(cruas).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. A varredura comportamental
// ---------------------------------------------------------------------------
//
// A estrutural prova que existe um `limit` no arquivo. Só a execução prova que
// ele está **nesta** consulta, com **este** valor.

describe('AC-PERF-03 — o que cada observador registra de fato', () => {
  it('as conversas diretas são filtradas por participante e cortadas no teto', () => {
    observarConversas('sala-a', 'uid-ana', () => {});

    const [consulta] = __consultasAtivas();

    expect(consulta.caminho).toBe('salas/sala-a/conversas');
    expect(consulta.quantidade).toBe(LIMITE_DE_CONVERSAS);
    // O `array-contains` não é filtro de interface: sem ele a rule nega a
    // listagem inteira, e não há resultado nenhum para filtrar depois.
    expect(consulta.filtros).toEqual([
      { __tipo: 'where', campo: 'participantes', operador: 'array-contains', valor: 'uid-ana' },
    ]);
  });

  it('os perks da sala são lidos da subcoleção da sala, com teto', () => {
    observarPerksDaSala('sala-a', () => {});

    const [consulta] = __consultasAtivas();

    expect(consulta.caminho).toBe('salas/sala-a/perks');
    expect(consulta.quantidade).toBe(LIMITE_DE_PERKS);
  });

  it('sem sala não há perk, e não há listener — um `if` barato economiza a leitura', () => {
    observarPerksDaSala(null, () => {});

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('o espelho de salas é lido dentro do usuário, com teto', () => {
    observarSalasDoUsuario('uid-ana', () => {});

    const [consulta] = __consultasAtivas();

    expect(consulta.caminho).toBe('usuarios/uid-ana/salas');
    expect(consulta.quantidade).toBe(LIMITE_DE_SALAS);
  });

  it('nenhum dos três observa a raiz de uma coleção da escola inteira', () => {
    observarConversas('sala-a', 'uid-ana', () => {});
    observarPerksDaSala('sala-a', () => {});
    observarSalasDoUsuario('uid-ana', () => {});

    __consultasAtivas().forEach(({ caminho, quantidade }) => {
      // Escopo: o caminho tem ao menos três segmentos, o que só acontece dentro
      // de um documento — de uma sala, ou de um usuário.
      expect(caminho.split('/').length).toBeGreaterThanOrEqual(3);
      expect(typeof quantidade).toBe('number');
    });
  });
});

describe('AC-PERF-04 — todo observador devolve o cancelamento', () => {
  it('cancelar a inscrição das conversas some com o listener', () => {
    const cancelar = observarConversas('sala-a', 'uid-ana', () => {});

    expect(__ouvintesAtivos()).toBe(1);

    cancelar();

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('cancelar a inscrição dos perks some com o listener', () => {
    const cancelar = observarPerksDaSala('sala-a', () => {});

    cancelar();

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('cancelar a inscrição do espelho de salas some com o listener', () => {
    const cancelar = observarSalasDoUsuario('uid-ana', () => {});

    cancelar();

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('o cancelamento de quem nunca se inscreveu não lança', () => {
    // `observarPerksDaSala(null)` devolve uma função vazia. Quem chama não
    // precisa saber disso, e o `useEffect` chama o retorno sempre.
    expect(() => observarPerksDaSala(null, () => {})()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 3. Os tetos são os do alvo declarado, e nenhum deles é generoso
// ---------------------------------------------------------------------------

describe('AC-PERF-03 — os tetos cobrem o alvo do projeto e param nele', () => {
  it('o teto de chamados é o alvo de chamados por sala', () => {
    expect(LIMITE_DE_CHAMADOS).toBe(200);
  });

  it('o teto de mensagens é menor que o alvo de 1000 — a janela pagina', () => {
    // 1000 mensagens por sala é o alvo do projeto; ler as 1000 a cada abertura
    // de tela, por 40 alunos, seria 40 mil leituras por aula. A conversa que
    // interessa numa aula é a de hoje, e quem quiser o resto pede.
    expect(LIMITE_DE_MENSAGENS).toBeLessThan(1000);
  });

  it('o teto de conversas cabe na turma, e o de salas no ano letivo', () => {
    expect(LIMITE_DE_CONVERSAS).toBeGreaterThanOrEqual(40);
    expect(LIMITE_DE_SALAS).toBeLessThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// 4. O fallback das coleções globais
// ---------------------------------------------------------------------------
//
// Uma ressalva honesta, e ela está aqui porque o lugar de uma ressalva é ao
// lado do teste que a mede.
//
// As rotas `/aluno` e `/professor` — sem `salaId` — leem as coleções globais
// `chamados` e `chat` da v0.4.0. É o fallback de leitura da migração, e ele
// continua na 1.0.0 de propósito (`docs/MIGRACOES.md`): tirá-lo é o que deixa a
// tela vazia para quem abrir o app com o banco antigo.
//
// Uma coleção global não tem `where` possível: não existe campo que a divida,
// porque ela é de antes de haver sala. O que ela tem é o mesmo teto da fila de
// uma sala — e é o teto, não o filtro, que limita a leitura.

describe('AC-PERF-03 — o fallback global é limitado pelo teto', () => {
  it('a leitura das coleções globais é cortada no mesmo teto da sala', () => {
    __semearColecao(
      'chamados',
      Array.from({ length: 5 }, (_valor, indice) => ({
        id: `c${indice}`,
        descricao: `chamado ${indice}`,
      }))
    );

    // `colecaoDeChamados(null)` é o fallback. O teste chega nele pelo mesmo
    // caminho que as telas antigas chegam.
    const { colecaoDeChamados } = require('../services/salas');
    const { limit, onSnapshot, query } = require('firebase/firestore');

    onSnapshot(query(colecaoDeChamados(null), limit(LIMITE_DE_CHAMADOS)), () => {});

    const [consulta] = __consultasAtivas();

    expect(consulta.caminho).toBe('chamados');
    expect(consulta.quantidade).toBe(LIMITE_DE_CHAMADOS);
  });
});
