// A única fonte de horário do app — AC-TEMPO-01 a AC-TEMPO-09.
//
// A fila de atendimento é o produto: o professor atende na ordem em que as
// dúvidas chegaram. Até a v0.3.0 essa ordem saía do relógio do computador do
// aluno, que nos laboratórios do SENAI está frequentemente errado — e que
// qualquer aluno adianta de propósito pelo relógio do Windows.
//
// Este arquivo testa o módulo que passa a decidir tudo que envolve tempo:
// como se grava (carimbo do servidor), como se lê (formato antigo e novo) e
// como se ordena (pendente por último, de forma estável).
import {
  formatarDataHora,
  formatarHora,
  formatarRelativo,
  FUSO_BRASILIA,
  paraData,
} from '../tempo';
import { Timestamp } from 'firebase/firestore';
import { fixarRelogio, restaurarRelogio } from '../../test-utils';

describe('paraData — leitura dupla dos formatos de horario (AC-TEMPO-08)', () => {
  const INSTANTE = new Date('2026-09-19T17:32:00.000Z');

  it('converte um Timestamp do Firestore', () => {
    expect(paraData(Timestamp.fromDate(INSTANTE))).toEqual(INSTANTE);
  });

  it('converte a string ISO gravada pela v0.1.0', () => {
    expect(paraData('2026-09-19T17:32:00.000Z')).toEqual(INSTANTE);
  });

  it('devolve o próprio Date quando já recebe um Date', () => {
    expect(paraData(INSTANTE)).toEqual(INSTANTE);
  });

  it('devolve null para null — é o serverTimestamp que ainda não resolveu', () => {
    expect(paraData(null)).toBeNull();
  });

  it('devolve null para campo ausente', () => {
    expect(paraData(undefined)).toBeNull();
  });

  it('devolve null para string que não é data, em vez de Invalid Date', () => {
    expect(paraData('ontem de manhã')).toBeNull();
  });

  it('devolve null para o sentinela de serverTimestamp, que não é uma data ainda', () => {
    expect(paraData({ __tipo: 'serverTimestamp' })).toBeNull();
  });

  // Um Timestamp que passou por JSON — cache do navegador, export, REST —
  // chega como objeto puro, sem o método `toDate`.
  it('converte o objeto puro {seconds, nanoseconds} de um Timestamp serializado', () => {
    expect(paraData({ seconds: 1789839120, nanoseconds: 0 })).toEqual(INSTANTE);
  });
});

// O fuso da máquina é a variável que ninguém controla: nos laboratórios do
// SENAI ele está errado com frequência. As asserções abaixo fixam a saída
// exata em Brasília, e são elas que quebram quando o formatador esquece o
// `timeZone`.
//
// Num detalhe elas não bastam sozinhas: quem desenvolve este projeto roda a
// suíte numa máquina em `America/Sao_Paulo`, onde um formatador sem
// `timeZone` acerta por coincidência. Trocar o fuso durante o teste não
// resolve — dentro do contexto de VM do Jest, reatribuir `process.env.TZ`
// não invalida o cache de fuso do V8, e `Intl` continua respondendo o fuso
// antigo (verificado neste ambiente). O fuso só muda de verdade se vier do
// ambiente do processo, e é para isso que existe `npm run test:fusos`, que
// roda esta mesma suíte em `UTC` e em `America/New_York` e entra no CI.
describe('formatação no fuso de Brasília (AC-TEMPO-03, AC-TEMPO-04)', () => {
  it('declara o fuso de Brasília pelo identificador IANA, não por offset fixo', () => {
    // O horário de verão brasileiro está suspenso, mas pode voltar. Offset na
    // mão erraria em silêncio no dia em que voltar; a base IANA acompanha.
    expect(FUSO_BRASILIA).toBe('America/Sao_Paulo');
  });

  it('formatarDataHora devolve dd/mm/aaaa HH:mm no horário de Brasília', () => {
    // 17:32Z é 14:32 em Brasília (UTC-3).
    expect(formatarDataHora('2026-09-19T17:32:00.000Z')).toBe('19/09/2026 14:32');
  });

  it('formatarHora devolve só HH:mm', () => {
    expect(formatarHora('2026-09-19T17:32:00.000Z')).toBe('14:32');
  });

  it('atravessa a virada do dia sem errar a data', () => {
    // 02:30Z do dia 20 ainda é 23:30 do dia 19 em Brasília.
    expect(formatarDataHora('2026-09-20T02:30:00.000Z')).toBe('19/09/2026 23:30');
  });

  it('escreve a meia-noite como 00, e não como 24', () => {
    expect(formatarHora('2026-09-20T03:00:00.000Z')).toBe('00:00');
  });

  it('zera à esquerda o dia e o mês, como manda o formato brasileiro', () => {
    expect(formatarDataHora('2026-01-05T12:00:00.000Z')).toBe('05/01/2026 09:00');
  });

  it('formata igual a partir de um Timestamp e da string ISO equivalente', () => {
    const instante = new Date('2026-09-19T17:32:00.000Z');

    expect(formatarDataHora(Timestamp.fromDate(instante))).toBe(
      formatarDataHora(instante.toISOString())
    );
  });
});

describe('formatação de valores sem data legível', () => {
  it('formatarDataHora anuncia "enviando…" enquanto o servidor não confirmou', () => {
    expect(formatarDataHora(null)).toBe('enviando…');
  });

  it('formatarHora anuncia "enviando…" pelo mesmo motivo', () => {
    expect(formatarHora(null)).toBe('enviando…');
  });

  // Campo ausente é documento antigo, não escrita em voo: dizer "enviando…"
  // ali seria mentir para sempre.
  it('formatarDataHora marca o campo ausente com um travessão', () => {
    expect(formatarDataHora(undefined)).toBe('—');
  });

  it('formatarHora marca o campo ausente com o mesmo travessão', () => {
    expect(formatarHora('ontem de manhã')).toBe('—');
  });
});

// "há 3 minutos" é a informação que o professor usa de relance para saber se
// a dúvida acabou de chegar. Acima de uma hora ela deixa de ajudar — "há 47
// minutos" e "há 3 horas" viram a mesma coisa na cabeça de quem lê —, e aí o
// horário absoluto informa mais.
describe('formatarRelativo — rótulos de evento recente (AC-TEMPO-04)', () => {
  const AGORA = new Date('2026-09-19T17:32:00.000Z');

  /** O mesmo instante, `minutos` minutos antes de AGORA. */
  function minutosAtras(minutos) {
    return new Date(AGORA.getTime() - minutos * 60000).toISOString();
  }

  afterEach(() => restaurarRelogio());

  it('diz "há 3 minutos" para três minutos atrás', () => {
    expect(formatarRelativo(minutosAtras(3), AGORA)).toBe('há 3 minutos');
  });

  it('usa o singular em um minuto', () => {
    expect(formatarRelativo(minutosAtras(1), AGORA)).toBe('há 1 minuto');
  });

  it('diz "agora mesmo" abaixo de um minuto', () => {
    expect(formatarRelativo(minutosAtras(0.5), AGORA)).toBe('agora mesmo');
  });

  it('ainda é relativo aos 59 minutos', () => {
    expect(formatarRelativo(minutosAtras(59), AGORA)).toBe('há 59 minutos');
  });

  it('cai para data e hora absolutas a partir de uma hora', () => {
    expect(formatarRelativo(minutosAtras(60), AGORA)).toBe('19/09/2026 13:32');
  });

  it('usa o absoluto para um chamado de ontem', () => {
    expect(formatarRelativo('2026-09-18T12:00:00.000Z', AGORA)).toBe('18/09/2026 09:00');
  });

  // O relógio do aluno pode estar adiantado em relação ao carimbo do servidor.
  // Nesse caso a conta dá negativa, e "há -2 minutos" seria pior do que inútil.
  it('não inventa horário no futuro quando o relógio do leitor está atrasado', () => {
    expect(formatarRelativo(minutosAtras(-2), AGORA)).toBe('agora mesmo');
  });

  it('anuncia "enviando…" enquanto o servidor não confirmou', () => {
    expect(formatarRelativo(null, AGORA)).toBe('enviando…');
  });

  it('lê o relógio quando o chamador não informa o "agora"', () => {
    fixarRelogio(AGORA);

    expect(formatarRelativo(minutosAtras(5))).toBe('há 5 minutos');
  });
});
