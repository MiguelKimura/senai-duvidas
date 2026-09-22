// A folha de estilo do chat — AC-CHAT-13, AC-ANIM-05.
//
// O chat da v0.8.0 é um conjunto de componentes novos: `Chat.jsx` desenha abas,
// `ListaMensagens.jsx` desenha a rolagem, `Mensagem.jsx` desenha o balão com
// horário e selo. Nenhuma dessas classes existia na v0.7.0, e `Chat.css` ficou
// parado no arquivo do protótipo — ele ainda estiliza `.fala-box` e
// `.mensagem-card`, que nenhum componente renderiza mais.
//
// Este teste lê CSS como texto, no mesmo espírito de `tokens.test.js`: jsdom não
// aplica folha de estilo nenhuma, então não há como afirmar pixel. O que dá para
// afirmar — e é o que importa aqui — é que a superfície visível do chat tem
// regra, que a animação de entrada existe, e que ela some para quem pediu menos
// movimento ao sistema operacional. Essa última é a parte que costuma ser
// esquecida, e é justamente a que o AC-CHAT-13 exige por escrito.
const fs = require('fs');
const path = require('path');

const CAMINHO_CHAT = path.join(__dirname, '..', 'Chat.css');

function lerChatCss() {
  return fs.readFileSync(CAMINHO_CHAT, 'utf8');
}

/** Remove comentários para que um seletor citado em prosa não conte como regra. */
function semComentarios(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** O corpo do `@media (prefers-reduced-motion: reduce)`, ou string vazia. */
function blocoDeMovimentoReduzido(css) {
  const abertura = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/.exec(css);

  if (!abertura) return '';

  let profundidade = 1;
  let i = abertura.index + abertura[0].length;
  const inicio = i;

  while (i < css.length && profundidade > 0) {
    if (css[i] === '{') profundidade += 1;
    if (css[i] === '}') profundidade -= 1;
    i += 1;
  }

  return css.slice(inicio, i - 1);
}

/**
 * As classes que os componentes do chat realmente renderizam.
 *
 * Escrita à mão de propósito: extrair de JSX exigiria avaliar `className={...}`,
 * e um extrator meia-boca que perdesse uma classe deixaria o teste passar sem
 * provar nada. Esta lista é o contrato — quem acrescentar uma classe sem estilo
 * vê o teste vermelho e decide conscientemente.
 */
const CLASSES_DO_CHAT = [
  // A casca e as abas (AC-DM-01)
  'chat-box',
  'chat-abas',
  'chat-aba',
  'chat-aba--ativa',
  'chat-aviso',
  'chat-confirmacao',
  'chat-historico',
  // A aba da sala e a aba das diretas
  'aba-sala',
  'aba-diretas',
  // A lista de conversas (AC-DM-05, AC-DM-06)
  'conversas',
  'conversas-aviso',
  'conversas-erro',
  'conversas-nova',
  'conversas-contatos',
  'conversa',
  'conversa-cabecalho',
  'conversa-voltar',
  'conversa-item',
  'conversa-nome',
  'conversa-previa',
  'conversa-horario',
  'conversa-nao-lidas',
  // A rolagem e a paginação (AC-CHAT-05, AC-CHAT-06)
  'mensagens',
  'mensagens-rolagem',
  'mensagens-lista',
  'mensagens-anteriores',
  'mensagens-aviso',
  'mensagens-novas',
  // O balão (AC-CHAT-01 a AC-CHAT-04, AC-CHAT-07)
  'mensagem',
  'mensagem--minha',
  'mensagem--de-outro',
  'mensagem--agrupada',
  'mensagem--enviando',
  'mensagem-cabecalho',
  'mensagem-autor',
  'mensagem-selo',
  'mensagem-insignias',
  'mensagem-balao',
  'mensagem-texto',
  'mensagem-horario',
  // O campo de digitação (AC-CHAT-09)
  'campo-mensagem',
  'campo-mensagem-linha',
  'campo-mensagem-entrada',
  'campo-mensagem-aviso',
  'campo-mensagem-erro',
];

describe('Chat.css — a superfície visível do chat novo', () => {
  it('tem regra para toda classe que os componentes renderizam', () => {
    const css = semComentarios(lerChatCss());

    const semEstilo = CLASSES_DO_CHAT.filter(
      (classe) => !new RegExp(`\\.${classe.replace(/--/g, '--')}(?![\\w-])`).test(css)
    );

    expect(semEstilo).toEqual([]);
  });

  it('não estiliza mais classes que a v0.7.0 renderizava e ninguém renderiza hoje', () => {
    const css = semComentarios(lerChatCss());

    for (const morta of ['.fala-box', '.mensagem-card', '.input-container', '.mensagens-list']) {
      expect(css).not.toContain(morta);
    }
  });

  it('não solta um seletor de elemento cru sobre `button`, que vaza para a tela toda', () => {
    // A v0.7.0 declarava `button { width: 50px; height: 50px; }` sem nenhuma
    // classe na frente: era o chat mandando no botão de enviar chamado.
    const css = semComentarios(lerChatCss());

    expect(css).not.toMatch(/(^|[}\s])button\s*(,[^{]*)?\{/);
  });
});

describe('Chat.css — animação de entrada (AC-CHAT-13)', () => {
  it('declara os quadros da entrada da mensagem', () => {
    expect(semComentarios(lerChatCss())).toMatch(/@keyframes\s+mensagem-entra\s*\{/);
  });

  it('aplica a entrada no balão, e não na lista inteira', () => {
    const css = semComentarios(lerChatCss());
    const regra = /\.mensagem(?![\w-])[^{]*\{([^}]*)\}/g;

    const animadas = [...css.matchAll(regra)].filter(([, corpo]) =>
      /animation[^;]*mensagem-entra/.test(corpo)
    );

    expect(animadas.length).toBeGreaterThan(0);
  });

  it('usa os tokens de movimento do projeto, não um tempo solto', () => {
    const css = semComentarios(lerChatCss());
    const animacao = /animation:[^;]*mensagem-entra[^;]*;|animation:[^;]*;/g;
    const declaracoes = [...css.matchAll(animacao)].map(([texto]) => texto);

    const comMensagemEntra = declaracoes.filter((texto) => texto.includes('mensagem-entra'));

    expect(comMensagemEntra.length).toBeGreaterThan(0);

    for (const texto of comMensagemEntra) {
      expect(texto).toContain('var(--duracao-transicao)');
      expect(texto).toContain('var(--aceleracao-padrao)');
    }
  });

  it('desliga a animação para quem pediu menos movimento (AC-ANIM-05)', () => {
    const bloco = blocoDeMovimentoReduzido(semComentarios(lerChatCss()));

    expect(bloco).not.toEqual('');
    expect(bloco).toMatch(/\.mensagem(?![\w-])/);
    expect(bloco).toMatch(/animation\s*:\s*none/);
  });

  it('a rolagem suave também respeita o movimento reduzido', () => {
    const bloco = blocoDeMovimentoReduzido(semComentarios(lerChatCss()));

    expect(bloco).toMatch(/scroll-behavior\s*:\s*auto/);
  });
});
