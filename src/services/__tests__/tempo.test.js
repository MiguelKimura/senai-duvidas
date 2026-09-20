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
  carimboServidor,
  comparar,
  criarComparadorPorHorario,
  estaPendente,
  formatarDataHora,
  formatarHora,
  formatarRelativo,
  FUSO_BRASILIA,
  msAteProximaMeiaNoiteBrasilia,
  paraData,
  proximaMeiaNoiteBrasilia,
} from '../tempo';
import { serverTimestamp, Timestamp } from 'firebase/firestore';
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

// `estaPendente` nasceu no ciclo anterior, para separar "enviando…" de "—".
// Estes testes fixam a distinção, que a partir daqui a fila também usa.
describe('estaPendente — escrita em voo x campo ausente (AC-TEMPO-06)', () => {
  it('o sentinela recém-saído de carimboServidor está pendente', () => {
    expect(estaPendente({ __tipo: 'serverTimestamp' })).toBe(true);
  });

  it('o null do documento local, antes de o servidor carimbar, está pendente', () => {
    expect(estaPendente(null)).toBe(true);
  });

  it('campo ausente não está pendente: não há escrita em voo atrás dele', () => {
    expect(estaPendente(undefined)).toBe(false);
  });

  it('um Timestamp confirmado não está pendente', () => {
    expect(estaPendente(Timestamp.fromDate(new Date('2026-09-19T17:32:00.000Z')))).toBe(false);
  });

  it('a string ISO da v0.1.0 não está pendente', () => {
    expect(estaPendente('2026-09-19T17:32:00.000Z')).toBe(false);
  });
});

// A ordem da fila é o produto: o professor atende na ordem em que as dúvidas
// chegaram (AC-CHAMADO-03). O comparador é o único lugar onde essa ordem é
// decidida.
describe('comparar — a ordem da fila (AC-CHAMADO-03, AC-TEMPO-08)', () => {
  const NOVE = '2026-09-19T09:00:00.000Z';
  const DEZ = '2026-09-19T10:00:00.000Z';

  it('põe o mais antigo antes do mais novo', () => {
    expect(comparar(NOVE, DEZ)).toBeLessThan(0);
  });

  it('põe o mais novo depois do mais antigo', () => {
    expect(comparar(DEZ, NOVE)).toBeGreaterThan(0);
  });

  it('empata dois horários iguais', () => {
    expect(comparar(NOVE, NOVE)).toBe(0);
  });

  it('compara Timestamp com string ISO sem se confundir com o tipo', () => {
    expect(comparar(Timestamp.fromDate(new Date(DEZ)), NOVE)).toBeGreaterThan(0);
  });

  it('manda o pendente para depois de quem já tem horário', () => {
    expect(comparar(null, NOVE)).toBeGreaterThan(0);
    expect(comparar(NOVE, null)).toBeLessThan(0);
  });

  it('empata dois pendentes, para que a ordem de chegada os desempate', () => {
    expect(comparar(null, null)).toBe(0);
  });
});

describe('criarComparadorPorHorario — o comparador que as telas usam', () => {
  /** Ids da fila depois de ordenada por `comparador`. */
  function filaOrdenada(documentos, comparador = criarComparadorPorHorario()) {
    return [...documentos].sort(comparador).map((documento) => documento.id);
  }

  it('ordena a fila por horário crescente', () => {
    const fila = [
      { id: 'segunda', horario: '2026-09-19T10:05:00.000Z' },
      { id: 'terceira', horario: '2026-09-19T10:10:00.000Z' },
      { id: 'primeira', horario: '2026-09-19T10:00:00.000Z' },
    ];

    expect(filaOrdenada(fila)).toEqual(['primeira', 'segunda', 'terceira']);
  });

  it('ordena uma fila que mistura Timestamp novo e string ISO antiga', () => {
    const fila = [
      { id: 'timestamp', horario: Timestamp.fromDate(new Date('2026-09-19T10:05:00.000Z')) },
      { id: 'iso', horario: '2026-09-19T10:00:00.000Z' },
    ];

    expect(filaOrdenada(fila)).toEqual(['iso', 'timestamp']);
  });

  // O card de quem acabou de enviar não pode ficar pulando de posição
  // enquanto o servidor não responde.
  it('joga os pendentes para o fim preservando a ordem de chegada entre eles', () => {
    const fila = [
      { id: 'pendente-1', horario: null },
      { id: 'confirmado', horario: '2026-09-19T10:00:00.000Z' },
      { id: 'pendente-2', horario: null },
    ];

    expect(filaOrdenada(fila)).toEqual(['confirmado', 'pendente-1', 'pendente-2']);
  });

  it('trata documento sem o campo horario como quem ainda não tem posição', () => {
    const fila = [
      { id: 'sem-horario' },
      { id: 'com-horario', horario: '2026-09-19T10:00:00.000Z' },
    ];

    expect(filaOrdenada(fila)).toEqual(['com-horario', 'sem-horario']);
  });

  // A task 09 ordena por `prioridade desc, horario asc`. O comparador aceita
  // o critério anterior em vez de a task ter que reescrever a ordenação.
  it('aceita um critério anterior e só desempata por horário', () => {
    const porPrioridadeDesc = (a, b) => (b.prioridade || 0) - (a.prioridade || 0);
    const fila = [
      { id: 'sem-perk', prioridade: 0, horario: '2026-09-19T09:00:00.000Z' },
      { id: 'perk-tarde', prioridade: 2, horario: '2026-09-19T10:00:00.000Z' },
      { id: 'perk-cedo', prioridade: 2, horario: '2026-09-19T09:30:00.000Z' },
    ];

    expect(filaOrdenada(fila, criarComparadorPorHorario(porPrioridadeDesc))).toEqual([
      'perk-cedo',
      'perk-tarde',
      'sem-perk',
    ]);
  });
});

// O palpite natural seria consultar uma API pública de horário de Brasília.
// Seria pior em todos os eixos: depende de rede além do Firestore, cai no meio
// da aula, custa latência — e, principalmente, continuaria falsificável, porque
// quem carimbaria o documento com a resposta da API ainda seria o cliente.
describe('carimboServidor — a autoridade de tempo da escrita (AC-TEMPO-01, AC-TEMPO-09)', () => {
  it('devolve o sentinela de serverTimestamp() do Firestore', () => {
    expect(carimboServidor()).toEqual(serverTimestamp());
  });

  it('o que ele devolve conta como pendente até o servidor responder', () => {
    expect(estaPendente(carimboServidor())).toBe(true);
  });

  it('não devolve data alguma: quem decide o instante é o servidor', () => {
    expect(paraData(carimboServidor())).toBeNull();
  });
});

// O chat se limpa à meia-noite. Qual meia-noite não é detalhe: a da máquina
// pode estar a horas de distância da de Brasília, e a conversa da turma
// sumiria no meio da aula seguinte — ou sobreviveria um dia a mais.
describe('proximaMeiaNoiteBrasilia (AC-TEMPO-07)', () => {
  it('devolve a meia-noite seguinte, em UTC, para uma tarde comum', () => {
    // 14:32 de 19/09 em Brasília -> 00:00 de 20/09, que é 03:00Z.
    expect(proximaMeiaNoiteBrasilia(new Date('2026-09-19T17:32:00.000Z'))).toEqual(
      new Date('2026-09-20T03:00:00.000Z')
    );
  });

  it('não pula um dia quando já passou da meia-noite UTC mas não da de Brasília', () => {
    // 02:30Z do dia 20 ainda é 23:30 do dia 19 em Brasília. Uma implementação
    // que usasse a meia-noite da máquina em UTC já teria limpado o chat.
    expect(proximaMeiaNoiteBrasilia(new Date('2026-09-20T02:30:00.000Z'))).toEqual(
      new Date('2026-09-20T03:00:00.000Z')
    );
  });

  it('exatamente na meia-noite de Brasília, aponta para a do dia seguinte', () => {
    expect(proximaMeiaNoiteBrasilia(new Date('2026-09-20T03:00:00.000Z'))).toEqual(
      new Date('2026-09-21T03:00:00.000Z')
    );
  });

  it('aceita string ISO e Timestamp, como todo o resto do módulo', () => {
    expect(proximaMeiaNoiteBrasilia('2026-09-19T17:32:00.000Z')).toEqual(
      new Date('2026-09-20T03:00:00.000Z')
    );
    expect(
      proximaMeiaNoiteBrasilia(Timestamp.fromDate(new Date('2026-09-19T17:32:00.000Z')))
    ).toEqual(new Date('2026-09-20T03:00:00.000Z'));
  });

  // O horário de verão brasileiro está suspenso desde 2019, mas foi suspenso
  // por decreto — e decreto se revoga. Estes dois casos usam datas em que ele
  // valia de verdade, e é a base IANA que os resolve. Um `-03:00` escrito à
  // mão erraria nos dois, em silêncio.
  describe('horário de verão, se voltar', () => {
    it('acerta a meia-noite num dia de horário de verão (UTC-2)', () => {
      // 10:00 de 25/12/2018 em Brasília, sob BRST -> 00:00 de 26/12 = 02:00Z.
      expect(proximaMeiaNoiteBrasilia(new Date('2018-12-25T12:00:00.000Z'))).toEqual(
        new Date('2018-12-26T02:00:00.000Z')
      );
    });

    it('acerta a meia-noite na noite em que o relógio ATRASA uma hora', () => {
      // Em 17/02/2019 o horário de verão terminou: 23:59:59 de 16/02 (UTC-2)
      // voltou para 23:00 (UTC-3). A meia-noite de 17/02 é 03:00Z, e não
      // 02:00Z — que ainda seria 23:00 do dia 16.
      expect(proximaMeiaNoiteBrasilia(new Date('2019-02-16T12:00:00.000Z'))).toEqual(
        new Date('2019-02-17T03:00:00.000Z')
      );
    });

    it('acerta a noite em que a meia-noite não existe, porque o relógio ADIANTA', () => {
      // Em 04/11/2018 o horário de verão começou à meia-noite: o relógio foi
      // de 23:59:59 direto para 01:00. A virada do dia é 03:00Z.
      expect(proximaMeiaNoiteBrasilia(new Date('2018-11-03T13:00:00.000Z'))).toEqual(
        new Date('2018-11-04T03:00:00.000Z')
      );
    });
  });
});

describe('msAteProximaMeiaNoiteBrasilia', () => {
  it('conta os milissegundos que faltam, para alimentar um setTimeout', () => {
    // De 14:32 até a meia-noite de Brasília são 9h28min.
    expect(msAteProximaMeiaNoiteBrasilia(new Date('2026-09-19T17:32:00.000Z'))).toBe(
      9 * 3600000 + 28 * 60000
    );
  });

  it('nunca devolve zero nem negativo, para o timer não disparar em laço', () => {
    expect(msAteProximaMeiaNoiteBrasilia(new Date('2026-09-20T03:00:00.000Z'))).toBeGreaterThan(0);
  });
});
