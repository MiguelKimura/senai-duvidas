// Markdown sanitizado — AC-COR-07, AC-COR-08 e AC-SEC-04.
//
// Este é o arquivo de maior risco da task. Até a v0.6.0 a descrição era
// renderizada como texto por React, que escapa tudo: não havia XSS porque não
// havia HTML. Passar a interpretar markdown é abrir mão dessa garantia — e o
// que entra é texto digitado por adolescente numa sala onde todo mundo vê o
// card de todo mundo.
//
// Por isso a asserção não é sobre a string devolvida: é sobre o **DOM** que
// ela produz. `expect(html).not.toContain('<script')` passa alegremente diante
// de `<SCRIPT>`, de `<scr<script>ipt>` e de uma entidade que o parser desfaz
// depois. Montar o HTML num elemento e perguntar ao navegador o que sobrou é a
// única pergunta que corresponde ao que acontece em produção.
import { FORMATO_MARKDOWN, FORMATO_TEXTO, formatoDoTexto, paraHtmlSeguro } from '../markdown';

/** O HTML devolvido, montado como o navegador o montaria. */
function montar(markdown) {
  const raiz = document.createElement('div');
  raiz.innerHTML = paraHtmlSeguro(markdown);
  return raiz;
}

/**
 * O esquema de URL que executa, montado em pedaços.
 *
 * Escrito inteiro, o literal reprova no `no-script-url` do ESLint — uma regra
 * que existe por bons motivos e que não vale desligar por causa de um teste.
 * Quem procura o esquema neste arquivo o encontra pelos vetores logo abaixo.
 */
const ESQUEMA_EXECUTAVEL = ['java', 'script:'].join('');

/** Todo atributo de todo elemento do fragmento, em minúsculas. */
function atributos(raiz) {
  return [...raiz.querySelectorAll('*')].flatMap((elemento) =>
    [...elemento.attributes].map((atributo) => atributo.name.toLowerCase())
  );
}

describe('paraHtmlSeguro — markdown básico (AC-COR-07)', () => {
  it('transforma **negrito** em <strong>', () => {
    expect(montar('o **cabo** está solto').querySelector('strong')).toHaveTextContent('cabo');
  });

  it('transforma *itálico* em <em>', () => {
    expect(montar('o *cabo* está solto').querySelector('em')).toHaveTextContent('cabo');
  });

  it('transforma "- item" em lista não ordenada', () => {
    const raiz = montar('- primeiro\n- segundo');

    expect(raiz.querySelector('ul')).not.toBeNull();
    expect([...raiz.querySelectorAll('li')].map((item) => item.textContent.trim())).toEqual([
      'primeiro',
      'segundo',
    ]);
  });

  it('transforma "1. item" em lista ordenada', () => {
    const raiz = montar('1. primeiro\n2. segundo');

    expect(raiz.querySelector('ol')).not.toBeNull();
    expect(raiz.querySelectorAll('li')).toHaveLength(2);
  });

  it('transforma `código` em <code>', () => {
    expect(montar('rode `npm start` no terminal').querySelector('code')).toHaveTextContent(
      'npm start'
    );
  });

  it('transforma bloco cercado em <pre><code>', () => {
    const raiz = montar('```\nnpm start\n```');

    expect(raiz.querySelector('pre code')).toHaveTextContent('npm start');
  });

  it('transforma quebra de linha simples em <br>', () => {
    expect(montar('primeira linha\nsegunda linha').querySelector('br')).not.toBeNull();
  });

  it('devolve string vazia para descrição vazia, sem <p> solto', () => {
    expect(paraHtmlSeguro('')).toBe('');
    expect(paraHtmlSeguro(null)).toBe('');
    expect(paraHtmlSeguro(undefined)).toBe('');
  });

  it('preserva o texto de quem não escreveu markdown nenhum', () => {
    expect(montar('O Visual Studio não abre no computador 12.')).toHaveTextContent(
      'O Visual Studio não abre no computador 12.'
    );
  });
});

describe('paraHtmlSeguro — o que esta versão NÃO interpreta', () => {
  it('não vira imagem inline: a imagem do chamado é o anexo, e ele é validado', () => {
    expect(montar('![print](https://evil.example/x.png)').querySelector('img')).toBeNull();
  });

  it('não vira link: nem escrito, nem automático', () => {
    const escrito = montar('[clique](https://exemplo.br)');
    const automatico = montar('https://exemplo.br');

    expect(escrito.querySelector('a')).toBeNull();
    expect(automatico.querySelector('a')).toBeNull();
  });

  it('mantém o texto visível do link, para a frase não perder sentido', () => {
    expect(montar('[o manual](https://exemplo.br)')).toHaveTextContent('o manual');
  });

  it('não deixa passar HTML bruto inofensivo, como <b>', () => {
    expect(montar('texto <b>forte</b>').querySelector('b')).toBeNull();
  });
});

// A lista completa de vetores pedida pela task. Cada caso pergunta ao DOM,
// nunca à string: é o DOM que executa.
describe('paraHtmlSeguro — sanitização (AC-COR-08, AC-SEC-04)', () => {
  const VETORES = [
    ['script direto', '<script>alert(1)</script>'],
    ['handler em img', '<img src=x onerror=alert(1)>'],
    ['link javascript:', '[clique](javascript:alert(1))'],
    ['iframe', '<iframe src="https://evil.example/x.html"></iframe>'],
    ['svg com onload', '<svg onload=alert(1)></svg>'],
    ['href data:text/html', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ['style com @import', "<style>@import 'https://evil.example/x.css';</style>"],
    ['entidade duplamente codificada', '&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;'],
    ['script com caixa trocada', '<ScRiPt>alert(1)</ScRiPt>'],
    ['script aninhado dentro de si', '<scr<script>ipt>alert(1)</scr</script>ipt>'],
    ['objeto embutido', '<object data="data:text/html;base64,PHNjcmlwdD4="></object>'],
    ['form com formaction', '<form><button formaction="javascript:alert(1)">x</button></form>'],
  ];

  it.each(VETORES)('não deixa nenhum elemento executável chegar ao DOM em %s', (_nome, vetor) => {
    const raiz = montar(vetor);

    expect(
      raiz.querySelector('script, iframe, object, embed, svg, img, a, style, form, link, base')
    ).toBeNull();
  });

  it.each(VETORES)('não deixa nenhum handler on* chegar ao DOM em %s', (_nome, vetor) => {
    expect(atributos(montar(vetor)).filter((nome) => nome.startsWith('on'))).toEqual([]);
  });

  it.each(VETORES)('não deixa nenhuma URL executável chegar ao DOM em %s', (_nome, vetor) => {
    const html = paraHtmlSeguro(vetor).toLowerCase();

    expect(html).not.toContain(ESQUEMA_EXECUTAVEL);
    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('@import');
  });

  it('remove o conteúdo do <script>, e não só a tag', () => {
    expect(montar('<script>alert(1)</script>').textContent.trim()).toBe('');
  });

  it('não executa nada ao montar o vetor mais clássico no documento', () => {
    const alerta = jest.spyOn(window, 'alert').mockImplementation(() => {});

    document.body.appendChild(montar('<img src=x onerror=alert(1)>'));

    expect(alerta).not.toHaveBeenCalled();
    alerta.mockRestore();
  });
});

describe('formatoDoTexto — a chave da compatibilidade retroativa', () => {
  it('trata o chamado sem o campo como texto puro, que é o que ele é', () => {
    expect(formatoDoTexto({ descricao: 'usa * e _ no nome do arquivo' })).toBe(FORMATO_TEXTO);
  });

  it('lê o formato gravado pela versão nova', () => {
    expect(formatoDoTexto({ formato: FORMATO_MARKDOWN })).toBe(FORMATO_MARKDOWN);
  });

  it('desconfia de valor desconhecido e cai no texto puro', () => {
    expect(formatoDoTexto({ formato: 'html' })).toBe(FORMATO_TEXTO);
  });

  it('não quebra com documento nenhum', () => {
    expect(formatoDoTexto(null)).toBe(FORMATO_TEXTO);
  });
});
