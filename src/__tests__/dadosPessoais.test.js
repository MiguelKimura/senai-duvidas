// Nenhum dado pessoal além de nome e e-mail — AC-SEC-07.
//
// O público desta aplicação inclui menores de idade. O critério é curto e tem
// duas metades, e nenhuma das duas era verificada até a 1.0.0:
//
//   1. **o que é coletado** — nenhum campo pessoal além de nome e e-mail
//      institucional chega ao banco;
//   2. **o que é registrado** — nenhum `console.*` do código de produção
//      entrega dado de aluno ao console da máquina do laboratório.
//
// A segunda metade parece menor e não é. As máquinas dos laboratórios são
// compartilhadas e o console fica a um F12 de distância de qualquer aluno da
// turma seguinte. Um `console.log(usuario)` num `catch` — o gesto mais comum
// de depuração que existe — despeja nome, e-mail e uid de quem estava logado.
//
// A prova da primeira metade é **comportamental**: cada caminho de escrita do
// app é exercitado de verdade contra o Firestore falso, e o que ele gravou é
// lido de volta. Uma lista de campos escrita à mão envelheceria no primeiro
// campo novo, em silêncio; documentos lidos de volta, não.
import { __documentosDe, __resetarFirestore } from 'firebase/firestore';
import { criarSala, entrarComPin } from '../services/salas';
import { abrirConversa, enviarMensagem, enviarMensagemDireta } from '../services/chat';
import { concederPerk } from '../services/perks';
import { garantirPerfil, salvarPreferencias } from '../services/perfilUsuario';

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Metade 1 — o que o app coleta
// ---------------------------------------------------------------------------

/**
 * Os campos pessoais que o projeto declara coletar, com o porquê de cada um.
 *
 * A lista é curta de propósito e é a razão de este teste existir: acrescentar
 * um campo a ela é uma decisão consciente, com o motivo escrito ao lado.
 * Acrescentar um campo ao código sem passar por aqui deixa o teste vermelho.
 */
const PESSOAIS_PERMITIDOS = {
  nome: 'o nome que aparece no card, no balão e no cartão da sala',
  autorNome: 'o mesmo nome, no formato que a v0.8.0 em diante grava',
  alunoNome: 'o mesmo nome, no documento do perk, para a vitrine do aluno',
  professorNome: 'o nome do dono da sala, no cartão que o aluno vê antes de entrar',
  concedidoPorNome: 'o nome de quem concedeu — a turma precisa saber quem premiou',
  participantesNomes: 'os dois nomes da conversa direta, para a lista não abrir dois perfis',
  email: 'o e-mail institucional, que é a credencial de entrada',
};

/**
 * Categorias de dado pessoal que o projeto **não** coleta.
 *
 * Não é uma lista de campos existentes: é a lista do que nunca pode existir.
 *
 * A comparação é por **palavra inteira**, e não por pedaço de string. Tentar
 * por pedaço foi a primeira versão deste teste, e ela acusava `tipo` e
 * `participantes` de conterem `ip` — um teste que grita todo dia em cima de
 * campo inocente é um teste que alguém desliga na semana seguinte.
 */
const PROIBIDOS = [
  'cpf',
  'rg',
  'nascimento',
  'idade',
  'telefone',
  'celular',
  'whatsapp',
  'endereco',
  'cep',
  'cidade',
  'bairro',
  'matricula',
  'responsavel',
  'foto',
  'avatar',
  'photo',
  'latitude',
  'longitude',
  'geolocalizacao',
  'localizacao',
  'ip',
  'useragent',
  'dispositivo',
  'genero',
  'sexo',
  'raca',
  'etnia',
  'religiao',
  'deficiencia',
  'saude',
  'biometria',
];

const PROFESSOR = {
  uid: 'uid-professor',
  nome: 'Profa. Marina',
  email: 'marina@sp.senai.br',
  tipo: 'professor',
};

const ALUNO = {
  uid: 'uid-aluno',
  nome: 'João Pedro',
  email: 'joao.pedro@aluno.sp.senai.br',
  tipo: 'aluno',
};

/** Todos os nomes de campo de um documento, inclusive os de mapa aninhado. */
function camposDe(dados, prefixo = '') {
  return Object.entries(dados || {}).flatMap(([chave, valor]) => {
    const nome = prefixo ? `${prefixo}.${chave}` : chave;
    const ehMapa =
      valor !== null && typeof valor === 'object' && !Array.isArray(valor) && !valor.toDate;

    return ehMapa ? [nome, ...camposDe(valor, nome)] : [nome];
  });
}

/** O último segmento do nome, sem acento e sem caixa. */
function normalizar(campo) {
  return campo
    .split('.')
    .pop()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * As palavras de um nome de campo: `dataDeNascimento` vira
 * `['data', 'de', 'nascimento']`, e `photoURL` vira `['photo', 'url']`.
 */
function palavrasDe(campo) {
  return normalizar(campo.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'))
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** O campo carrega uma categoria proibida? Compara palavra a palavra. */
function ehProibido(campo) {
  const palavras = palavrasDe(campo);

  return PROIBIDOS.some((proibido) => palavras.includes(proibido));
}

/**
 * Exercita todo caminho de escrita do app e devolve o que ficou no banco.
 *
 * Cada entrada é `[caminho da coleção, campos do documento]`.
 */
async function tudoQueOAppGrava() {
  __resetarFirestore();

  await garantirPerfil({ uid: ALUNO.uid, displayName: ALUNO.nome, email: ALUNO.email });
  await salvarPreferencias(ALUNO.uid, { animacoes: true, som: false });

  const { salaId, pin } = await criarSala(
    { nome: 'Redes 3B', curso: 'Técnico em Redes', anoLetivo: 2026 },
    PROFESSOR
  );

  await entrarComPin(pin, ALUNO);
  await enviarMensagem(salaId, ALUNO, 'o roteador não responde');

  const conversaId = await abrirConversa(salaId, PROFESSOR, ALUNO);
  await enviarMensagemDireta(salaId, conversaId, PROFESSOR, ALUNO.uid, 'chega mais');

  await concederPerk(salaId, ALUNO, PROFESSOR, {
    tipo: 'prioridade',
    nivel: 1,
    justificativa: 'ajudou a turma toda',
    validadeEmDias: 7,
    // A concessão exige o instante do servidor: a validade sai dele, e não do
    // relógio desta máquina (AC-PERK-03).
    agoraServidor: new Date('2026-03-10T13:00:00Z'),
  });

  const caminhos = [
    'usuarios',
    `usuarios/${ALUNO.uid}/salas`,
    'salas',
    `salas/${salaId}/membros`,
    `salas/${salaId}/chat`,
    `salas/${salaId}/conversas`,
    `salas/${salaId}/conversas/${conversaId}/mensagens`,
    `salas/${salaId}/perks`,
    `salas/${salaId}/auditoriaPerks`,
    'indicePins',
  ];

  return caminhos.flatMap((caminho) =>
    __documentosDe(caminho).map((documento) => [caminho, camposDe(documento)])
  );
}

describe('o que o app grava no banco (AC-SEC-07)', () => {
  let gravados;

  beforeAll(async () => {
    gravados = await tudoQueOAppGrava();
  });

  it('exercitou os caminhos de escrita — um levantamento vazio aprovaria tudo', () => {
    expect(gravados.length).toBeGreaterThanOrEqual(8);
  });

  it('nenhum documento carrega campo de categoria pessoal proibida', () => {
    const achados = gravados.flatMap(([caminho, campos]) =>
      campos.filter(ehProibido).map((campo) => `${caminho} › ${campo}`)
    );

    expect(achados).toEqual([]);
  });

  it('todo campo pessoal gravado está na lista declarada, com motivo', () => {
    // Qualquer campo cujo nome contenha "nome" ou "email" é pessoal por
    // definição. Se um nascer sem passar por `PESSOAIS_PERMITIDOS`, a lista
    // deixou de descrever o que o app coleta — e é a lista que a escola lê.
    const pessoais = gravados.flatMap(([caminho, campos]) =>
      campos
        .filter((campo) => /nome|email/i.test(normalizar(campo)))
        .filter((campo) => !(campo.split('.').pop() in PESSOAIS_PERMITIDOS))
        .map((campo) => `${caminho} › ${campo}`)
    );

    expect(pessoais).toEqual([]);
  });

  it('nenhuma permissão da lista sobra — ela descreve o que o app grava hoje', () => {
    // Uma lista que só cresce vira teatro: daqui a três versões ela
    // autorizaria campos que ninguém escreve mais, e a escola leria um
    // inventário maior do que a realidade. Entrada sem campo correspondente é
    // entrada a remover.
    const gravadosAgora = new Set(
      gravados.flatMap(([, campos]) => campos.map((campo) => campo.split('.').pop()))
    );
    const ociosas = Object.keys(PESSOAIS_PERMITIDOS).filter(
      (campo) => !gravadosAgora.has(campo)
    );

    expect(ociosas).toEqual([]);
  });

  it('cada permissão da lista traz o motivo escrito', () => {
    for (const [campo, motivo] of Object.entries(PESSOAIS_PERMITIDOS)) {
      expect(`${campo}: ${motivo}`.length).toBeGreaterThan(campo.length + 20);
    }
  });

  it('a varredura de fato enxerga um campo proibido — senão ela aprova o vazio', () => {
    const isca = [['salas/isca', camposDe({ nome: 'x', dataDeNascimento: '2009-04-02' })]];

    const achados = isca.flatMap(([caminho, campos]) =>
      campos.filter(ehProibido).map((campo) => `${caminho} › ${campo}`)
    );

    expect(achados).toEqual(['salas/isca › dataDeNascimento']);
  });
});

// ---------------------------------------------------------------------------
// Metade 2 — o que o app registra no console
// ---------------------------------------------------------------------------

/** Os fontes de produção do `src/`, sem teste, mock nem utilitário de teste. */
function fontes(pasta = RAIZ) {
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap((entrada) => {
    const caminho = path.join(pasta, entrada.name);

    if (entrada.isDirectory()) {
      if (['__tests__', '__mocks__', 'test-utils'].includes(entrada.name)) return [];
      return fontes(caminho);
    }

    if (!/\.(js|jsx)$/.test(entrada.name)) return [];
    if (/\.(test|spec)\.(js|jsx)$/.test(entrada.name)) return [];

    return [caminho];
  });
}

/** O fonte sem comentário: metade dos arquivos cita `console.log` em prosa. */
function codigoDe(caminho) {
  return fs
    .readFileSync(caminho, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Os argumentos de cada `console.*` de um arquivo.
 *
 * O casamento de parênteses é feito na mão porque as chamadas do projeto
 * quebram em várias linhas e contêm template string com `(` dentro.
 */
function chamadasDeConsole(caminho) {
  const codigo = codigoDe(caminho);
  const chamadas = [];

  for (const achado of codigo.matchAll(/console\s*\.\s*(\w+)\s*\(/g)) {
    let profundidade = 1;
    let i = achado.index + achado[0].length;

    while (i < codigo.length && profundidade > 0) {
      if (codigo[i] === '(') profundidade += 1;
      if (codigo[i] === ')') profundidade -= 1;
      i += 1;
    }

    chamadas.push({
      arquivo: path.relative(RAIZ, caminho),
      linha: codigo.slice(0, achado.index).split('\n').length,
      metodo: achado[1],
      argumentos: codigo.slice(achado.index + achado[0].length, i - 1),
    });
  }

  return chamadas;
}

/**
 * Nomes de variável que carregam dado de aluno.
 *
 * O teste procura **identificadores**, e não strings literais: uma frase fixa
 * em português é texto do programador e não vaza ninguém; `usuario`, `aluno` e
 * `erro` interpolados é que despejam o objeto inteiro no console.
 */
const PORTADORES = [
  'usuario',
  'user',
  'aluno',
  'professor',
  'autor',
  'pessoa',
  'membro',
  'perfil',
  'nome',
  'email',
  'uid',
  'texto',
  'mensagem',
  'descricao',
  'justificativa',
  'chamado',
  'conversa',
  'credential',
  'token',
];

describe('nenhum console de produção expõe dado pessoal (AC-SEC-07)', () => {
  const todas = () => fontes().flatMap(chamadasDeConsole);

  it('encontra os fontes — uma varredura vazia aprovaria qualquer coisa', () => {
    expect(fontes().length).toBeGreaterThan(30);
  });

  it('nenhuma chamada interpola um portador de dado pessoal', () => {
    const vazamentos = todas()
      .filter(({ argumentos }) => {
        // Fora das aspas: o que sobra é identificador e template hole.
        const semLiterais = argumentos
          .replace(/'(?:[^'\\]|\\.)*'/g, "''")
          .replace(/"(?:[^"\\]|\\.)*"/g, '""')
          .replace(/`(?:[^`\\$]|\\.|\$(?!\{))*`/g, '``');

        return PORTADORES.some((portador) =>
          new RegExp(`\\b${portador}`, 'i').test(semLiterais)
        );
      })
      .map(({ arquivo, linha, metodo }) => `${arquivo}:${linha} console.${metodo}`);

    expect(vazamentos).toEqual([]);
  });

  it('ninguém usa console.log nem console.debug no código de produção', () => {
    // `warn` e `error` sobrevivem: são os dois que um professor consegue ler
    // no console para saber que a configuração está incompleta. `log` e
    // `debug` são resto de depuração, e é por eles que o objeto inteiro sai.
    const proibidos = todas()
      .filter(({ metodo }) => ['log', 'debug', 'dir', 'table', 'trace'].includes(metodo))
      .map(({ arquivo, linha, metodo }) => `${arquivo}:${linha} console.${metodo}`);

    expect(proibidos).toEqual([]);
  });

  it('a varredura de fato enxerga um vazamento — senão ela aprova o vazio', () => {
    const isca = path.join(RAIZ, '__iscaDeDadoPessoal.js');

    fs.writeFileSync(
      isca,
      ['export function registrar(usuario) {', '  console.error(usuario);', '}', ''].join('\n'),
      'utf8'
    );

    try {
      const achadas = chamadasDeConsole(isca);

      expect(achadas).toHaveLength(1);
      expect(achadas[0].argumentos).toContain('usuario');
    } finally {
      fs.unlinkSync(isca);
    }
  });
});
