// XSS em **todos** os pontos de entrada de texto — AC-SEC-04.
//
// O AC-SEC-04 já tinha prova antes da 1.0.0, e ela era boa: `utils/markdown.js`
// é testado carga por carga em `src/utils/__tests__/markdown.test.js`. O que
// faltava é o que a auditoria desta versão cobra — a varredura **por ponto de
// entrada**. Um sanitizador perfeito não protege a tela que não o chama, e é
// sempre assim que um XSS entra: não por falha da tranca, mas por uma porta
// nova que ninguém ligou nela.
//
// Então este arquivo não testa o sanitizador. Ele enumera os cinco lugares onde
// texto de usuário entra no app, renderiza cada um com a mesma carga hostil, e
// pergunta ao DOM resultante uma coisa só: sobrou algo executável aqui?
//
//   1. descrição do chamado (texto puro e markdown)  — `TextoMarkdown`
//   2. chat da sala                                   — `Mensagem`
//   3. mensagem direta                                — `Conversa`
//   4. nome da sala                                   — `MinhasSalas`
//   5. justificativa de perk                          — `VitrineDeConquistas`
//
// Mais o **anexo**, que é entrada de texto igual às outras: o campo `imagem` de
// um chamado é uma string que vai para um atributo do DOM.
//
// A lista fechada é metade do valor. A outra metade é a varredura estrutural no
// fim do arquivo: toda entrega de HTML cru do `src/` precisa vir de um arquivo
// que importa o sanitizador. É ela que pega a porta nova de amanhã, e não esta
// lista, que só conhece as de hoje.
import React from 'react';
import { screen } from '@testing-library/react';
import { __definirUsuarioAtual, __resetarAuth } from 'firebase/auth';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import TextoMarkdown from '../components/TextoMarkdown';
import AnexoDoCard from '../components/AnexoDoCard';
import Mensagem from '../components/chat/Mensagem';
import Conversa from '../components/chat/Conversa';
import MinhasSalas from '../components/MinhasSalas';
import VitrineDeConquistas from '../components/perks/VitrineDeConquistas';
import { renderComProvedores } from '../test-utils';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => () => {},
}));

/**
 * A carga hostil, e o motivo de cada pedaço dela.
 *
 * `<script>` é o caso de manual. `<img onerror>` é o caso real: a tag é comum,
 * passa por qualquer filtro que só procure a palavra "script", e o `onerror`
 * dispara sozinho porque `x` nunca vai carregar. O `"><` na frente existe para
 * escapar de um atributo, que é o que acontece quando alguém interpola texto
 * dentro de uma string de HTML em vez de criar um nó.
 *
 * `javascript:` fecha a lista porque é o vetor que sobrevive à remoção de
 * tags: basta que a URL do usuário chegue a um `href`.
 */
// eslint-disable-next-line no-script-url -- a carga de ataque é o objeto do teste
const CARGA_HOSTIL =
  '"><script>window.__xss = "executou";</script>' +
  '<img src=x onerror="window.__xss = \'executou\'">' +
  '<a href="javascript:window.__xss=1">clique</a>';

/** Os esquemas de URL que não podem chegar a atributo nenhum. */
const ESQUEMAS_EXECUTAVEIS = /^\s*(javascript|vbscript|data:text\/html)/i;

/**
 * Tags que não existem em tela nenhuma deste app, em nenhuma circunstância.
 *
 * `svg` **não** está aqui, e a ausência é deliberada: os ícones do
 * `react-icons` são SVG, e eles aparecem em quase toda tela. Proibi-los no
 * container inteiro seria um teste que acusa o ícone de lupa de ser um ataque —
 * e um teste assim é desligado na semana seguinte. O `<svg onload>` continua
 * pego, pela varredura de atributo `on*`, que é global; e o `<svg>` vindo de
 * texto de usuário continua pego por `TAGS_FORA_DA_LISTA`, abaixo, que olha só
 * dentro das regiões de texto.
 */
const TAGS_PROIBIDAS = ['script', 'iframe', 'object', 'embed'];

/**
 * As regiões do DOM cujo conteúdo saiu de texto de usuário.
 *
 * São as duas únicas do projeto, e é a varredura estrutural no fim deste
 * arquivo que garante que continuem sendo duas.
 */
const REGIOES_DE_TEXTO = '.texto-markdown, .mensagem-texto';

/** Dentro das regiões de texto, a lista de permissão do sanitizador vale. */
const TAGS_FORA_DA_LISTA = ['svg', 'math', 'template', 'img', 'style', 'form', 'input'];

/**
 * Tudo de executável que sobrou num pedaço de DOM já renderizado.
 *
 * Devolve uma lista de descrições em vez de um booleano: quando falha, o que se
 * quer ler no relatório é *o que* sobrou, não que algo sobrou.
 *
 * @param {HTMLElement} raiz o container do render.
 * @returns {string[]} vazio quando a tela está limpa.
 */
function sobrasExecutaveis(raiz) {
  const problemas = [];

  TAGS_PROIBIDAS.forEach((tag) => {
    const achados = raiz.querySelectorAll(tag);

    if (achados.length > 0) problemas.push(`<${tag}> no DOM (${achados.length})`);
  });

  raiz.querySelectorAll(REGIOES_DE_TEXTO).forEach((regiao) => {
    TAGS_FORA_DA_LISTA.forEach((tag) => {
      if (regiao.querySelector(tag)) problemas.push(`<${tag}> dentro de texto de usuário`);
    });
  });

  raiz.querySelectorAll('*').forEach((elemento) => {
    [...elemento.attributes].forEach(({ name, value }) => {
      // `onError`/`onClick` escritos em JSX viram listeners de React e **não**
      // aparecem como atributo. Um `on*` no atributo, portanto, só pode ter
      // vindo de HTML cru — que é exatamente o que se procura aqui.
      if (/^on/i.test(name)) {
        problemas.push(`atributo ${name} em <${elemento.tagName.toLowerCase()}>`);
      }

      if ((name === 'href' || name === 'src') && ESQUEMAS_EXECUTAVEIS.test(value)) {
        problemas.push(`${name}="${value}" em <${elemento.tagName.toLowerCase()}>`);
      }
    });
  });

  return problemas;
}

beforeEach(() => {
  __resetarAuth();
  __resetarFirestore();
  delete window.__xss;
});

afterEach(() => {
  delete window.__xss;
});

/**
 * A asserção comum a todos os pontos de entrada.
 *
 * Duas metades, e as duas importam. Nada executável no DOM é a primeira. A
 * segunda é que `window.__xss` continua indefinido: um `<script>` que o jsdom
 * tivesse executado durante o render já teria rodado antes de qualquer
 * `querySelector` encontrá-lo.
 */
function esperarTelaLimpa(container) {
  expect(sobrasExecutaveis(container)).toEqual([]);
  expect(window.__xss).toBeUndefined();
}

describe('AC-SEC-04 — a carga hostil em cada ponto de entrada', () => {
  it('descrição do chamado, no formato de texto puro (o do banco até a v0.6.0)', () => {
    const { container } = renderComProvedores(<TextoMarkdown texto={CARGA_HOSTIL} />);

    esperarTelaLimpa(container);
    // E o aluno vê o que digitou: escapar não é apagar.
    expect(container.textContent).toContain('<script>');
  });

  it('descrição do chamado, no formato markdown da v0.7.0 em diante', () => {
    const { container } = renderComProvedores(
      <TextoMarkdown texto={CARGA_HOSTIL} formato="markdown" />
    );

    esperarTelaLimpa(container);
  });

  it('mensagem do chat da sala', () => {
    const { container } = renderComProvedores(
      <Mensagem
        mensagem={{
          id: 'm1',
          texto: CARGA_HOSTIL,
          autorUid: 'uid-ana',
          autorNome: CARGA_HOSTIL,
          horario: new Date('2026-03-10T13:45:00.000Z'),
        }}
      />
    );

    esperarTelaLimpa(container);
  });

  it('mensagem direta — o mesmo balão, e é de propósito que seja o mesmo', async () => {
    __semearColecao('salas/sala-1/conversas/conv-1/mensagens', [
      {
        id: 'd1',
        texto: CARGA_HOSTIL,
        autorUid: 'uid-carlos',
        autorNome: 'Carlos Lima',
        horario: new Date('2026-03-10T13:45:00.000Z'),
      },
    ]);

    const { container } = renderComProvedores(
      <Conversa
        salaId="sala-1"
        conversa={{ id: 'conv-1', outroUid: 'uid-carlos', outroNome: CARGA_HOSTIL }}
        pessoa={{ uid: 'uid-ana', nome: 'Ana Souza' }}
        aoVoltar={() => {}}
      />
    );

    // O balão só existe depois de o `onSnapshot` entregar a mensagem semeada.
    await screen.findByRole('listitem');

    esperarTelaLimpa(container);
  });

  it('nome da sala, no cartão da lista', async () => {
    __definirUsuarioAtual({ uid: 'uid-ana', email: 'ana@senai.br', displayName: 'Ana Souza' });
    __semearColecao('usuarios', [
      {
        id: 'uid-ana',
        uid: 'uid-ana',
        nome: 'Ana Souza',
        email: 'ana@senai.br',
        tipo: 'aluno',
      },
    ]);
    __semearColecao('usuarios/uid-ana/salas', [
      { id: 'sala-1', salaId: 'sala-1', papel: 'aluno' },
    ]);
    __semearColecao('salas', [
      {
        id: 'sala-1',
        nome: CARGA_HOSTIL,
        curso: 'Mecânica',
        anoLetivo: 2026,
        professorUid: 'uid-carlos',
        professorNome: 'Carlos Lima',
        ativa: true,
      },
    ]);

    const { container } = renderComProvedores(<MinhasSalas />);

    // O cartão da sala aparece quando o espelho de membros é lido.
    await screen.findByRole('heading', { level: 2 });

    esperarTelaLimpa(container);
  });

  it('justificativa do perk, na vitrine de conquistas', () => {
    const { container } = renderComProvedores(
      <VitrineDeConquistas
        uid="uid-ana"
        perks={[
          {
            id: 'p1',
            alunoUid: 'uid-ana',
            tipo: 'prioridade',
            nivel: 1,
            justificativa: CARGA_HOSTIL,
            concedidoPorNome: CARGA_HOSTIL,
            concedidoEm: new Date('2026-03-10T13:45:00.000Z'),
            expiraEm: null,
            revogadoEm: null,
          },
        ]}
      />
    );

    esperarTelaLimpa(container);
  });

  // -------------------------------------------------------------------------
  // O anexo é ponto de entrada de texto igual aos outros
  // -------------------------------------------------------------------------
  //
  // `imagem` é uma string escrita pelo cliente e lida para dentro de um
  // atributo do DOM. O caminho de **escrita** já a recusa: `ehUrlDeImagem`
  // barra qualquer esquema fora de `http`, `https` e `data:image/`. O caminho
  // de **leitura** não conferia nada — e é ele que decide o que vai para o
  // `src`, para cada um dos quarenta membros da sala.
  //
  // Ninguém precisa do app para escrever um documento: basta o SDK e um token
  // de aluno, e as rules nunca olharam o formato deste campo. Confiar no que
  // está gravado porque o nosso formulário validou é a suposição que o
  // AC-SEC-01 proíbe em toda a outra metade do sistema.

  it('anexo com esquema executável não vira src — nem no chamado legado', () => {
    const { container } = renderComProvedores(
      <AnexoDoCard
        chamado={{
          id: 'c1',
          descricao: 'Olha o print',
          // eslint-disable-next-line no-script-url -- é exatamente o que se recusa
          imagem: 'javascript:window.__xss=1',
        }}
      />
    );

    esperarTelaLimpa(container);
  });

  it('anexo em objeto com esquema executável também não vira src', () => {
    const { container } = renderComProvedores(
      <AnexoDoCard
        chamado={{
          id: 'c1',
          descricao: 'Olha o print',
          // eslint-disable-next-line no-script-url -- é exatamente o que se recusa
          anexo: { url: 'javascript:window.__xss=1', origem: 'url' },
        }}
      />
    );

    esperarTelaLimpa(container);
  });

  it('e o anexo de verdade continua aparecendo — a tranca não pode fechar a porta', () => {
    renderComProvedores(
      <AnexoDoCard
        chamado={{
          id: 'c1',
          descricao: 'Olha o print',
          imagem: 'https://exemplo.test/print.png',
        }}
      />
    );

    expect(screen.getByAltText(/Anexo do chamado/)).toHaveAttribute(
      'src',
      'https://exemplo.test/print.png'
    );
  });
});

// ---------------------------------------------------------------------------
// A varredura estrutural
// ---------------------------------------------------------------------------
//
// A lista acima conhece as portas de hoje. Esta parte é a que vale para as de
// amanhã: nenhuma entrega de HTML cru pode existir em arquivo que não importe
// o sanitizador. Uma tela nova que chame `dangerouslySetInnerHTML` sem passar
// por `utils/markdown` deixa este teste vermelho antes de chegar à revisão.

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

describe('AC-SEC-04 — nenhuma porta nova sem tranca', () => {
  const fontes = fontesDeProducao();

  it('a varredura encontra os fontes do projeto (e não uma lista vazia)', () => {
    expect(fontes.length).toBeGreaterThan(30);
  });

  it('todo dangerouslySetInnerHTML mora em arquivo que importa o sanitizador', () => {
    const semTranca = fontes.filter((arquivo) => {
      const codigo = fs.readFileSync(arquivo, 'utf8');

      if (!codigo.includes('dangerouslySetInnerHTML')) return false;

      return !/from '(\.\.?\/)+utils\/markdown'/.test(codigo);
    });

    expect(semTranca.map((arquivo) => path.relative(RAIZ, arquivo))).toEqual([]);
  });

  it('a entrega de HTML cru continua restrita aos dois lugares conhecidos', () => {
    // Não é um teto arbitrário: são o card e o balão de fala, os dois únicos
    // lugares onde markdown do usuário é renderizado. Um terceiro é uma
    // decisão de projeto, e ela passa por editar esta lista.
    const comHtmlCru = fontes
      .filter((arquivo) => fs.readFileSync(arquivo, 'utf8').includes('dangerouslySetInnerHTML'))
      .map((arquivo) => path.relative(RAIZ, arquivo).split(path.sep).join('/'));

    expect(comHtmlCru.sort()).toEqual([
      'components/TextoMarkdown.jsx',
      'components/chat/Mensagem.jsx',
    ]);
  });
});
