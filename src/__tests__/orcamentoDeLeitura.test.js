// O orçamento de leitura do Firestore — AC-PERF-06.
//
// O critério pede uma conta: o custo de leituras por aluno por aula, projetado
// para dez salas ativas, dentro do plano gratuito. `docs/ARQUITETURA.md` § 5
// tinha essa conta desde a v0.8.0, e é justamente ela o problema que este
// arquivo resolve — uma conta escrita à mão num documento envelhece em silêncio,
// e esta envelheceu em dois lugares:
//
//   1. a tabela citava `limit(50)` para a lista de conversas quando o código já
//      cortava em 40, e ninguém tinha como saber: não havia nada lendo os dois
//      lados;
//   2. a conclusão — "dez salas ativas cabem com folga" — contradizia a própria
//      linha acima dela, que estimava ~18 000 leituras por sala por dia letivo.
//      Dez vezes 18 000 são 180 000, contra uma cota de 50 000.
//
// Uma conta de capacidade que diverge do código é pior do que nenhuma: ela dá a
// sensação de que a capacidade foi verificada.
//
// Então aqui a conta é **derivada dos tetos que o código usa de verdade**, e o
// documento é conferido contra ela. Trocar um `limit()` sem atualizar o
// documento deixa este teste vermelho.
import fs from 'fs';
import path from 'path';
import { LIMITE_DE_CONVERSAS, MENSAGENS_POR_PAGINA } from '../services/chat';
import { LIMITE_DE_PERKS } from '../services/perks';
import {
  LIMITE_DE_CHAMADOS,
  LIMITE_DE_MEMBROS,
  LIMITE_DE_MENSAGENS,
  LIMITE_DE_SALAS,
} from '../services/salas';

const DOCUMENTO = path.join(__dirname, '..', '..', 'docs', 'ARQUITETURA.md');
const BLOQUEIOS = path.join(__dirname, '..', '..', 'docs', 'BLOQUEIOS.md');

/** A cota gratuita do plano Spark, em documentos lidos por dia por projeto. */
export const LEITURAS_GRATUITAS_POR_DIA = 50000;

/** A cota gratuita de escritas, pelo mesmo motivo. */
export const ESCRITAS_GRATUITAS_POR_DIA = 20000;

/** O alvo declarado do projeto, em `tasks/_PROTOCOLO.md` § 7. */
const ALVO = { alunosPorSala: 40, aberturasPorAluno: 2 };

/**
 * As leituras de **uma** abertura de tela, por aluno.
 *
 * O Firestore cobra por documento entregue, então cada termo é
 * `min(o que existe, o teto que o código impõe)` — não o teto sozinho. Um teto
 * de 120 perks numa sala que tem três perks custa três leituras.
 *
 * Cada teto vem da constante que o código passa ao `limit()`. Nenhum número
 * deste arquivo foi copiado de um documento.
 *
 * @param {object} cenario o que existe na sala, e o que o aluno abre.
 * @returns {number}
 */
export function leiturasPorAbertura({
  chamadosNaSala = LIMITE_DE_CHAMADOS,
  perksNaSala = LIMITE_DE_PERKS,
  salasDoAluno = 2,
  abreOChat = true,
  abreAsDiretas = false,
} = {}) {
  const perfil = 2; // `usuarios/{uid}` e `autorizados/{email}`
  const espelhoDeSalas = Math.min(salasDoAluno, LIMITE_DE_SALAS);
  const documentoDaSala = 1;

  const fila = Math.min(chamadosNaSala, LIMITE_DE_CHAMADOS);
  const perks = Math.min(perksNaSala, LIMITE_DE_PERKS);

  // O painel fechado não assina nada — foi a economia da v0.8.0. A primeira
  // página da conversa é decrescente e são 50, não o teto de 300.
  const chat = abreOChat ? MENSAGENS_POR_PAGINA : 0;
  const diretas = abreAsDiretas ? LIMITE_DE_CONVERSAS + MENSAGENS_POR_PAGINA : 0;

  return perfil + espelhoDeSalas + documentoDaSala + fila + perks + chat + diretas;
}

/**
 * As leituras de um dia letivo, para um número de salas em aula no mesmo dia.
 *
 * @param {number} salasEmAula quantas turmas usam o app naquele dia.
 * @param {object} cenario o mesmo de `leiturasPorAbertura`.
 * @returns {number}
 */
export function leiturasPorDia(salasEmAula, cenario = {}) {
  return (
    leiturasPorAbertura(cenario) * ALVO.alunosPorSala * ALVO.aberturasPorAluno * salasEmAula
  );
}

/** A sala de março: pouca coisa acumulada, ninguém premiado ainda. */
const SALA_DE_MARCO = { chamadosNaSala: 20, perksNaSala: 0, salasDoAluno: 1 };

/** A sala de novembro no alvo declarado: fila cheia, perks concedidos. */
const SALA_DE_NOVEMBRO = { chamadosNaSala: 200, perksNaSala: 40, salasDoAluno: 3 };

describe('AC-PERF-06 — a conta sai dos tetos do código', () => {
  it('a abertura de tela é a soma dos listeners que a tela monta', () => {
    // 2 (perfil) + 1 (espelho) + 1 (sala) + 20 (fila) + 0 (perks) + 50 (chat)
    expect(leiturasPorAbertura(SALA_DE_MARCO)).toBe(74);
  });

  it('em novembro o termo que domina é a fila, e ela dobra o custo três vezes', () => {
    // 2 + 3 + 1 + 200 + 40 + 50
    expect(leiturasPorAbertura(SALA_DE_NOVEMBRO)).toBe(296);
  });

  it('nenhum termo pode passar do teto que o código impõe', () => {
    // Uma sala que de alguma forma tenha mil chamados custa 200, não mil. É o
    // que o `limit()` garante, e é o que esta conta pode prometer por causa
    // dele.
    expect(leiturasPorAbertura({ chamadosNaSala: 1000, perksNaSala: 1000 })).toBe(
      leiturasPorAbertura({ chamadosNaSala: LIMITE_DE_CHAMADOS, perksNaSala: LIMITE_DE_PERKS })
    );
  });

  it('o painel de chat fechado não é cobrado', () => {
    expect(leiturasPorAbertura({ ...SALA_DE_MARCO, abreOChat: false })).toBe(
      leiturasPorAbertura(SALA_DE_MARCO) - MENSAGENS_POR_PAGINA
    );
  });

  it('abrir as diretas custa a lista de conversas mais a primeira página de uma', () => {
    expect(leiturasPorAbertura({ ...SALA_DE_MARCO, abreAsDiretas: true })).toBe(
      leiturasPorAbertura(SALA_DE_MARCO) + LIMITE_DE_CONVERSAS + MENSAGENS_POR_PAGINA
    );
  });
});

describe('AC-PERF-06 — a projeção contra o plano gratuito', () => {
  // O multiplicador que decide tudo é **quantas turmas usam o app no mesmo
  // dia** — não quantas salas existem no ano. Quarenta alunos abrindo a tela
  // duas vezes são 80 aberturas por sala por dia.

  it('duas turmas de novembro, com a fila cheia, cabem', () => {
    // 296 × 40 × 2 × 2 = 47 360. É o limite real de hoje, e ele é apertado: a
    // terceira turma de novembro já passa de 50 000.
    expect(leiturasPorDia(2, SALA_DE_NOVEMBRO)).toBeLessThan(LEITURAS_GRATUITAS_POR_DIA);
    expect(leiturasPorDia(3, SALA_DE_NOVEMBRO)).toBeGreaterThan(LEITURAS_GRATUITAS_POR_DIA);
  });

  it('em março, com as filas curtas, caberiam oito turmas no mesmo dia', () => {
    // 74 × 40 × 2 × 8 = 47 360. A capacidade do app não é um número: ela é
    // função do tamanho da fila, e a fila cresce o ano letivo inteiro.
    expect(leiturasPorDia(8, SALA_DE_MARCO)).toBeLessThan(LEITURAS_GRATUITAS_POR_DIA);
  });

  it('dez turmas em aula no mesmo dia, em novembro, NÃO cabem — e isso está registrado', () => {
    // 296 × 40 × 2 × 10 = 236 800, contra 50 000. O critério não foi baixado
    // nem reescrito: o limite está em `docs/BLOQUEIOS.md`, com a causa técnica e
    // a proposta de fechamento, e declarado no corpo do PR da 1.0.0.
    expect(leiturasPorDia(10, SALA_DE_NOVEMBRO)).toBeGreaterThan(LEITURAS_GRATUITAS_POR_DIA);

    expect(fs.readFileSync(BLOQUEIOS, 'utf8')).toMatch(/AC-PERF-06/);
  });

  it('as escritas cabem, e com margem — elas nunca foram o gargalo', () => {
    // Por aluno por aula: 1 chamado, 5 mensagens de sala, 2 por mensagem direta
    // (a mensagem e o contador do documento pai), 1 entrada de membro.
    const escritasPorAluno = 9;
    const total = escritasPorAluno * ALVO.alunosPorSala * 10;

    expect(total).toBeLessThan(ESCRITAS_GRATUITAS_POR_DIA);
  });
});

describe('AC-PERF-06 — o documento não pode divergir do código', () => {
  const texto = fs.readFileSync(DOCUMENTO, 'utf8');

  /** A seção 5, que é a única que fala de custo de leitura. */
  const secao = texto.split('## 5. Custo de leitura')[1].split('\n## 6.')[0];

  it('a seção existe e não está vazia', () => {
    expect(secao.length).toBeGreaterThan(500);
  });

  /**
   * Cada teto do código, com o nome pelo qual o documento o chama.
   *
   * O par é o contrato: o documento precisa citar o número que o código usa,
   * escrito como `limit(N)`. Mudar o código sem mudar o documento é vermelho.
   */
  const TETOS_CITADOS = [
    ['fila de chamados', LIMITE_DE_CHAMADOS],
    ['primeira página da conversa', MENSAGENS_POR_PAGINA],
    ['lista de conversas', LIMITE_DE_CONVERSAS],
    ['espelho de salas', LIMITE_DE_SALAS],
    ['membros', LIMITE_DE_MEMBROS],
    ['teto da conversa', LIMITE_DE_MENSAGENS],
    ['perks da sala', LIMITE_DE_PERKS],
  ];

  TETOS_CITADOS.forEach(([nome, teto]) => {
    it(`cita o teto de ${nome} como limit(${teto})`, () => {
      expect(secao).toContain(`limit(${teto})`);
    });
  });

  it('declara a cota gratuita que a conta usa como referência', () => {
    expect(secao).toMatch(/50 ?000/);
  });

  it('projeta o custo para dez turmas, que é o alvo do projeto', () => {
    expect(secao).toMatch(/dez turmas|10 turmas|dez salas|10 salas/i);
  });

  it('diz explicitamente que o pior caso não cabe — sem eufemismo', () => {
    expect(secao).toMatch(/não cabe|não caberia|estoura|excede/i);
  });

  it('aponta o bloqueio, para quem ler a conta saber onde está a proposta', () => {
    expect(secao).toMatch(/BLOQUEIOS\.md|B-00\d/);
  });
});
