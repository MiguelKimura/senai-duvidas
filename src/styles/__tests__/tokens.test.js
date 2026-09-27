// Tokens de design — AC-ANIM-09.
//
// Este teste não olha para pixels: ele prova que `tokens.css` é uma
// **extração** dos CSS que já existem, e não um repaginamento disfarçado de
// refatoração. A regra desta task é "nenhuma mudança visível para o usuário",
// e a forma de garanti-la é exigir que todo valor declarado como token apareça
// literalmente em algum CSS legado. Um token novo, inventado, reprova aqui.
//
// A v0.10.0 trocou os valores crus pelos `var(--token)` nos componentes e
// acrescentou os poucos tokens que ela **decide** em vez de extrair — a escala
// de durações e o anel de foco. Eles estão nomeados um a um em
// `TOKENS_DECIDIDOS`, abaixo, e cada um tem o próprio teste. A invariante de
// extração continua valendo para todo o resto.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const CAMINHO_TOKENS = path.join(RAIZ, 'styles', 'tokens.css');
const CAMINHO_INDEX = path.join(RAIZ, 'index.css');

/**
 * Os valores que a task 00 **extraiu** dos CSS da v0.1.0, congelados.
 *
 * Até a v0.9.0 esta lista não existia: o teste lia os CSS legados e exigia que
 * o valor de cada token aparecesse literalmente em algum deles. Aquilo provava
 * a mesma coisa e se destruía sozinho — no instante em que as folhas passam a
 * escrever `var(--token)` em vez do literal (AC-ANIM-09, e é esta versão que o
 * faz), não sobra nenhum literal para conferir, e o teste que guardava a
 * invariante passaria a aprovar qualquer valor.
 *
 * Congelar é mais forte, não mais fraco. A pergunta continua sendo "este
 * token é uma extração ou uma invenção?", mas agora a resposta não depende do
 * estado atual das folhas: ela é a foto do que existia antes de a task 00
 * encostar no código, e a foto não envelhece.
 *
 * Mudar um valor daqui exige nomear o token em `TOKENS_DECIDIDOS`, com o
 * motivo e o teste que prova a decisão. É exatamente o que a v0.10.0 fez com
 * os três primeiros.
 */
const VALORES_DA_EXTRACAO = {
  '--cor-primaria': '#ff0000',
  '--cor-primaria-hover': '#8f0000',
  '--cor-superficie': 'white',
  '--cor-fundo-pagina': '#f4f4f4',
  '--cor-fundo-tela': '#f5f5f5',
  '--cor-fundo-caixa': '#f9f9f9',
  '--cor-fundo-chat': '#e9e9e9',
  '--cor-texto-titulo': '#333',
  '--cor-texto-rotulo': '#555',
  '--cor-texto-invertido': 'white',
  '--cor-texto-discreto': 'gray',
  '--cor-borda': '#ccc',
  '--cor-borda-campo': '#ddd',
  '--cor-mensagem-enviada': '#007bff',
  '--cor-mensagem-recebida': '#28a745',
  '--espaco-minimo': '2px',
  '--espaco-1': '5px',
  '--espaco-2': '10px',
  '--espaco-campo': '12px',
  '--espaco-3': '15px',
  '--espaco-4': '20px',
  '--espaco-5': '30px',
  '--raio-1': '5px',
  '--raio-2': '8px',
  '--raio-3': '10px',
  '--raio-4': '20px',
  '--raio-circulo': '50%',
  '--sombra-caixa': '0 4px 10px rgba(0, 0, 0, 0.1)',
  '--sombra-elevada': '0 4px 10px rgba(0, 0, 0, 0.2)',
  '--fonte-base': 'Arial, sans-serif',
  '--camada-conteudo-flutuante': '999',
  '--camada-sobreposicao': '1000',
  '--camada-topo': '9999',
};

/** Colapsa espaços para comparar valores CSS sem depender de formatação. */
function normalizar(valor) {
  return valor.replace(/\s+/g, ' ').trim();
}

function lerTokens() {
  const css = fs.readFileSync(CAMINHO_TOKENS, 'utf8');
  const tokens = {};

  for (const [, nome, valor] of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    tokens[nome] = normalizar(valor);
  }

  return tokens;
}

/**
 * Resolve `--a: var(--b)` até chegar a um valor concreto.
 *
 * Um apelido é a forma idiomática de dizer em CSS "este papel usa aquela cor":
 * o texto sobre o botão vermelho é branco *porque* é a cor da superfície, não
 * por coincidência. Dois nomes com o mesmo literal seriam duplicação; um nome
 * apontando para o outro é intenção declarada — e continua sendo verificado,
 * porque a resolução abaixo chega no literal e ele é conferido igual.
 */
function resolver(valor, tokens, vistos = new Set()) {
  const apelido = /^var\(\s*(--[a-z0-9-]+)\s*\)$/.exec(valor);

  if (!apelido) return valor;

  const alvo = apelido[1];

  if (vistos.has(alvo)) throw new Error(`Ciclo de apelidos em ${alvo}`);
  if (!(alvo in tokens)) throw new Error(`Apelido aponta para token inexistente: ${alvo}`);

  return resolver(tokens[alvo], tokens, new Set(vistos).add(alvo));
}

/**
 * Os tokens que a v0.10.0 **decidiu**, em vez de extrair.
 *
 * A regra de extração acima nasceu na task 00 e continua valendo para tudo o
 * que existia antes: a task 00 proibia mudança visual, e a forma de garanti-la
 * era exigir que todo token fosse a cópia de um valor já praticado no código.
 *
 * A task 08 é a task que aquele comentário anunciava — `tokens.css` diz, desde
 * a v0.2.0, que a faixa de durações do AC-ANIM-01 e a correção de contraste do
 * AC-ANIM-10 são escopo dela. Um valor decidido aqui não é um token inventado
 * à revelia: é o critério sendo cumprido. O que este teste continua impedindo
 * é a decisão **silenciosa** — quem acrescentar um valor novo precisa nomeá-lo
 * nesta lista, com o motivo, e cada um deles tem o próprio teste:
 *
 *   * as durações e curvas → `src/styles/__tests__/animacoes.test.js`, que
 *     confere a faixa de 150ms a 300ms e exige motivo para quem sai dela;
 *   * `--cor-foco` e `--cor-erro` → `src/utils/__tests__/paleta.test.js`, que
 *     roda a conta de contraste da WCAG sobre eles.
 */
const TOKENS_DECIDIDOS = {
  '--cor-primaria': 'AC-ANIM-10: branco sobre #ff0000 dá 4,0:1; ver contraste.test.js',
  '--cor-texto-discreto': 'AC-ANIM-10: `gray` sobre o cinza do chat dá 3,4:1; idem',
  '--cor-borda-forte': 'AC-ANIM-10: o fundo do botão neutro em :hover, sem perder o texto',
  '--cor-texto-forte': 'AC-ANIM-10: o quase-preto de utils/paleta.js, no lugar do #000000',
  '--cor-foco': 'AC-ANIM-10: apelido de --cor-texto-forte; o anel único do app',
  '--cor-erro': 'AC-ANIM-10: `red` sobre branco não passa em AA; ver contraste.test.js',
  '--cor-erro-fundo': 'AC-ANIM-10: a tarja do erro de login, provada por contraste',
  '--sombra-foco': 'AC-ANIM-10: o halo segue --cor-primaria, que mudou nesta versão',
  '--cor-sucesso': 'AC-ANIM-07: a variante de sucesso do toast, provada por contraste',
  '--cor-aviso': 'AC-ANIM-07: a variante de aviso do toast, provada por contraste',
  '--cor-informacao': 'AC-ANIM-07: a variante informativa do toast, idem',
  '--dur-rapida': 'AC-ANIM-01: a escala canônica de durações',
  '--dur-media': 'AC-ANIM-01: a escala canônica de durações',
  '--dur-lenta': 'AC-ANIM-01: a escala canônica de durações',
  '--dur-celebracao': 'AC-PERK-04: a premiação não é transição de interface',
  '--dur-brilho': 'AC-PERK-04: o halo atrás do cartão de premiação',
  '--dur-desfazer': 'AC-CHAMADO-04: a janela de arrependimento da exclusão',
  '--dur-degrau': 'AC-ANIM-02: o intervalo entre duas entradas de card',
  '--ease-entrada': 'AC-ANIM-01: as curvas canônicas',
  '--ease-saida': 'AC-ANIM-01: as curvas canônicas',
  '--ease-padrao': 'AC-ANIM-01: as curvas canônicas',
  '--duracao-transicao': 'apelido de --dur-lenta, mantido para Chat.css',
  '--aceleracao-padrao': 'apelido de --ease-padrao, mantido para Chat.css',
};

describe('src/styles/tokens.css', () => {
  it('existe e declara os tokens em :root, para valerem no documento inteiro', () => {
    expect(fs.existsSync(CAMINHO_TOKENS)).toBe(true);
    expect(fs.readFileSync(CAMINHO_TOKENS, 'utf8')).toMatch(/:root\s*\{/);
  });

  it('cobre as cinco famílias que os componentes consomem', () => {
    const nomes = Object.keys(lerTokens());

    const familias = ['--cor-', '--espaco-', '--raio-', '--sombra-', '--duracao-'];

    for (const familia of familias) {
      expect(nomes.filter((nome) => nome.startsWith(familia)).length).toBeGreaterThan(0);
    }
  });

  it('não inventa valor nenhum: todo token é a extração congelada ou uma decisão nomeada', () => {
    const tokens = lerTokens();

    expect(Object.keys(tokens).length).toBeGreaterThan(0);

    const inventados = Object.entries(tokens)
      .filter(([nome]) => !(nome in TOKENS_DECIDIDOS))
      .map(([nome, valor]) => [nome, resolver(valor, tokens)])
      .filter(([nome, valor]) => VALORES_DA_EXTRACAO[nome] !== valor)
      .map(([nome, valor]) => `${nome}: ${valor}`);

    expect(inventados).toEqual([]);
  });

  it('nenhum valor extraído sumiu sem virar decisão — a foto cobre a lista inteira', () => {
    const tokens = lerTokens();

    const perdidos = Object.keys(VALORES_DA_EXTRACAO).filter((nome) => !(nome in tokens));

    expect(perdidos).toEqual([]);
  });

  it('todo token decidido é um token que existe — a lista não envelhece sozinha', () => {
    const tokens = lerTokens();

    const fantasmas = Object.keys(TOKENS_DECIDIDOS).filter((nome) => !(nome in tokens));

    expect(fantasmas).toEqual([]);
  });

  it('não repete o mesmo literal em dois nomes — papéis que coincidem viram apelido', () => {
    const tokens = lerTokens();
    const vistos = new Map();
    const duplicados = [];

    for (const [nome, valor] of Object.entries(tokens)) {
      const familia = nome.split('-')[2];
      const chave = `${familia}|${valor}`;

      if (vistos.has(chave)) duplicados.push(`${vistos.get(chave)} e ${nome} valem ${valor}`);
      else vistos.set(chave, nome);
    }

    expect(duplicados).toEqual([]);
  });

  // O par continua sendo cobrado por valor, e não por nome: dois tokens
  // chamados `--cor-primaria` e `--cor-primaria-hover` apontando para o mesmo
  // cinza passariam num teste que só olhasse os nomes.
  it('declara os dois vermelhos da identidade visual, que estão em todo botão', () => {
    const tokens = lerTokens();
    const valores = Object.values(tokens);

    expect(valores).toContain('#d60000');
    expect(valores).toContain('#8f0000');
  });

  it('todo apelido aponta para um token que existe, sem ciclo', () => {
    const tokens = lerTokens();

    for (const [, valor] of Object.entries(tokens)) {
      expect(() => resolver(valor, tokens)).not.toThrow();
    }
  });
});

describe('src/index.css', () => {
  it('importa os tokens', () => {
    expect(fs.readFileSync(CAMINHO_INDEX, 'utf8')).toMatch(
      /@import\s+(url\()?['"]\.\/styles\/tokens\.css['"]/
    );
  });

  it('põe o @import antes de qualquer regra, como o CSS exige', () => {
    const css = fs.readFileSync(CAMINHO_INDEX, 'utf8');
    const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(semComentarios.trim()).toMatch(/^@import/);
  });
});
