// O serviço das premiações — AC-PERK-01, AC-PERK-03, AC-PERK-06, AC-PERK-10.
//
// A regra que vale é a do servidor, e ela já está em `firestore.rules`. O que
// mora aqui é o que a rule não consegue fazer: recusar em português antes de a
// escrita sair, e garantir que a premiação e o registro dela sejam **uma coisa
// só**.
//
// Essa segunda parte é o motivo de este módulo existir. A auditoria do
// AC-PERK-10 não é um `console.log` com pretensões: é um documento, e um
// documento escrito depois do perk pode não ser escrito nunca — rede que cai
// no meio, aba fechada, recusa da segunda escrita. Um perk sem evento é um
// privilégio sem dono declarado, que é exatamente o que a auditoria existe
// para impedir. Por isso `writeBatch`, e por isso os testes de atomicidade.
import {
  __documentosDe,
  __confirmarCarimbos,
  __consultasAtivas,
  __definirRelogioDoServidor,
  __ouvintesAtivos,
  __recusarEscritaEm,
  __resetarFirestore,
  __semearColecao,
  Timestamp,
} from 'firebase/firestore';
import {
  ErroDePerk,
  LIMITE_DE_PERKS,
  TAMANHO_MAXIMO_DA_JUSTIFICATIVA,
  concederPerk,
  marcarPerkVisualizado,
  observarPerksDaSala,
  perksDoAluno,
  revogarPerk,
  separarConquistas,
  validarConcessao,
} from '../perks';
import { indexarPerksPorUid, ordenarFila, TIPO_PRIORIDADE } from '../filaChamados';

const SALA = 'sala-a';
const PERKS_DA_SALA = `salas/${SALA}/perks`;
const AUDITORIA_DA_SALA = `salas/${SALA}/auditoriaPerks`;

const AGORA = new Date('2026-09-22T12:00:00.000Z');

const ANA = { uid: 'uid-ana', nome: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', nome: 'Carlos Lima' };

/** A concessão mínima que o painel do professor envia. */
function concessao(sobrescritas = {}) {
  return {
    tipo: TIPO_PRIORIDADE,
    nivel: 2,
    justificativa: 'Ajudou o colega a achar o erro de compilação.',
    validadeEmDias: 7,
    agoraServidor: AGORA,
    ...sobrescritas,
  };
}

beforeEach(() => {
  __resetarFirestore();
  __definirRelogioDoServidor(AGORA);
});

describe('validarConcessao — a recusa em português, antes da escrita (AC-PERK-01)', () => {
  it('aceita a concessão completa e devolve os campos limpos', () => {
    expect(validarConcessao(concessao())).toMatchObject({
      tipo: TIPO_PRIORIDADE,
      nivel: 2,
      justificativa: 'Ajudou o colega a achar o erro de compilação.',
    });
  });

  it('aceita concessão sem justificativa e a normaliza para nulo', () => {
    expect(validarConcessao(concessao({ justificativa: '   ' })).justificativa).toBeNull();
    expect(validarConcessao(concessao({ justificativa: undefined })).justificativa).toBeNull();
  });

  it('recusa tipo que não está na lista', () => {
    expect(() => validarConcessao(concessao({ tipo: 'administrador' }))).toThrow(ErroDePerk);
  });

  it('recusa nível fora da faixa de 1 a 3', () => {
    expect(() => validarConcessao(concessao({ nivel: 0 }))).toThrow(ErroDePerk);
    expect(() => validarConcessao(concessao({ nivel: 4 }))).toThrow(ErroDePerk);
    expect(() => validarConcessao(concessao({ nivel: 'dois' }))).toThrow(ErroDePerk);
  });

  it('recusa justificativa acima do teto que a rule também cobra', () => {
    const longa = 'a'.repeat(TAMANHO_MAXIMO_DA_JUSTIFICATIVA + 1);

    expect(() => validarConcessao(concessao({ justificativa: longa }))).toThrow(ErroDePerk);
  });

  it('recusa validade negativa ou que não é número', () => {
    expect(() => validarConcessao(concessao({ validadeEmDias: -1 }))).toThrow(ErroDePerk);
    expect(() => validarConcessao(concessao({ validadeEmDias: 'sete' }))).toThrow(ErroDePerk);
  });

  it('a mensagem de recusa é em português, e não o código do Firebase', () => {
    expect(() => validarConcessao(concessao({ nivel: 9 }))).toThrow(/nível/i);
  });
});

describe('concederPerk — a premiação e o registro dela (AC-PERK-01, AC-PERK-10)', () => {
  it('grava o perk com o aluno, o tipo, o nível e quem concedeu', async () => {
    await concederPerk(SALA, ANA, CARLOS, concessao());
    __confirmarCarimbos();

    expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(1);
    expect(__documentosDe(PERKS_DA_SALA)[0]).toMatchObject({
      alunoUid: ANA.uid,
      alunoNome: ANA.nome,
      tipo: TIPO_PRIORIDADE,
      nivel: 2,
      concedidoPor: CARLOS.uid,
      concedidoPorNome: CARLOS.nome,
      revogadoEm: null,
      visualizadoEm: null,
      anunciarParaSala: false,
    });
  });

  // O carimbo é do servidor pelo mesmo motivo de sempre: o relógio da máquina
  // do professor não é mais confiável do que o do aluno (AC-TEMPO-01).
  it('carimba concedidoEm pelo servidor, não pelo relógio da máquina', async () => {
    await concederPerk(SALA, ANA, CARLOS, concessao());

    // Enquanto o servidor não responde, o campo chega vazio — é a mesma
    // janela de "enviando…" do chamado (AC-TEMPO-06).
    expect(__documentosDe(PERKS_DA_SALA)[0].concedidoEm).toBeNull();

    __confirmarCarimbos('2026-09-22T12:00:00.000Z');

    expect(__documentosDe(PERKS_DA_SALA)[0].concedidoEm.toDate().toISOString()).toBe(
      '2026-09-22T12:00:00.000Z'
    );
  });

  it('calcula expiraEm a partir do instante do servidor, não do relógio local', async () => {
    await concederPerk(SALA, ANA, CARLOS, concessao({ validadeEmDias: 7 }));
    __confirmarCarimbos();

    const { expiraEm } = __documentosDe(PERKS_DA_SALA)[0];

    expect(expiraEm.toDate().toISOString()).toBe('2026-09-29T12:00:00.000Z');
  });

  it('grava expiraEm nulo quando a premiação é permanente', async () => {
    await concederPerk(SALA, ANA, CARLOS, concessao({ validadeEmDias: null }));
    __confirmarCarimbos();

    expect(__documentosDe(PERKS_DA_SALA)[0].expiraEm).toBeNull();
  });

  it('registra o evento de auditoria com quem, para quem e por quê', async () => {
    await concederPerk(SALA, ANA, CARLOS, concessao());
    __confirmarCarimbos();

    const eventos = __documentosDe(AUDITORIA_DA_SALA);

    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      acao: 'conceder',
      alunoUid: ANA.uid,
      atorUid: CARLOS.uid,
    });
    expect(eventos[0].detalhes).toMatch(/prioridade/i);
    expect(eventos[0].perkId).toBe(__documentosDe(PERKS_DA_SALA)[0].id);
  });

  // Um perk sem evento é um privilégio sem dono declarado. O lote é o que
  // impede a premiação de existir sozinha quando a segunda escrita falha.
  it('não deixa perk sem auditoria quando o servidor recusa a escrita', async () => {
    __recusarEscritaEm(`${PERKS_DA_SALA}/doc-gerado-1`);

    await expect(concederPerk(SALA, ANA, CARLOS, concessao())).rejects.toThrow();

    expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(0);
    expect(__documentosDe(AUDITORIA_DA_SALA)).toHaveLength(0);
  });

  it('devolve o id do perk criado, para a tela poder acompanhá-lo', async () => {
    const { perkId } = await concederPerk(SALA, ANA, CARLOS, concessao());

    expect(perkId).toBe(__documentosDe(PERKS_DA_SALA)[0].id);
  });

  it('não escreve nada quando a concessão é inválida', async () => {
    await expect(concederPerk(SALA, ANA, CARLOS, concessao({ nivel: 9 }))).rejects.toThrow(
      ErroDePerk
    );

    expect(__documentosDe(PERKS_DA_SALA)).toHaveLength(0);
    expect(__documentosDe(AUDITORIA_DA_SALA)).toHaveLength(0);
  });

  it('marca o perk como anunciado para a sala quando o professor pede', async () => {
    await concederPerk(SALA, ANA, CARLOS, concessao({ anunciarParaSala: true }));

    expect(__documentosDe(PERKS_DA_SALA)[0].anunciarParaSala).toBe(true);
  });
});

describe('revogarPerk — desfazer e registrar (AC-PERK-07, AC-PERK-10)', () => {
  async function comPerkConcedido() {
    const { perkId } = await concederPerk(SALA, ANA, CARLOS, concessao());
    __confirmarCarimbos();

    return perkId;
  }

  it('grava revogadoEm no perk', async () => {
    const perkId = await comPerkConcedido();

    await revogarPerk(SALA, perkId, CARLOS);
    __confirmarCarimbos();

    expect(__documentosDe(PERKS_DA_SALA)[0].revogadoEm).not.toBeNull();
  });

  it('registra o evento de revogação ao lado do de concessão', async () => {
    const perkId = await comPerkConcedido();

    await revogarPerk(SALA, perkId, CARLOS, 'concedi por engano');
    __confirmarCarimbos();

    const eventos = __documentosDe(AUDITORIA_DA_SALA);

    expect(eventos).toHaveLength(2);
    expect(eventos.map((evento) => evento.acao).sort()).toEqual(['conceder', 'revogar']);
    expect(eventos.find((evento) => evento.acao === 'revogar').detalhes).toBe(
      'concedi por engano'
    );
  });

  // O efeito na fila é o que o professor observa. Revogar sem que o chamado
  // volte para o lugar seria revogar só no papel.
  it('o chamado do aluno volta para a posição de quem não tem perk', async () => {
    const perkId = await comPerkConcedido();
    __confirmarCarimbos();

    const fila = [
      { id: 'da-ana', autorUid: ANA.uid, horario: '2026-09-22T10:00:00.000Z' },
      { id: 'do-bruno', autorUid: 'uid-bruno', horario: '2026-09-22T09:00:00.000Z' },
    ];

    const antes = ordenarFila(fila, indexarPerksPorUid(__documentosDe(PERKS_DA_SALA)), AGORA);
    expect(antes.map((item) => item.id)).toEqual(['da-ana', 'do-bruno']);

    await revogarPerk(SALA, perkId, CARLOS);
    __confirmarCarimbos();

    const depois = ordenarFila(fila, indexarPerksPorUid(__documentosDe(PERKS_DA_SALA)), AGORA);
    expect(depois.map((item) => item.id)).toEqual(['do-bruno', 'da-ana']);
  });
});

describe('marcarPerkVisualizado — o recibo que cala a animação (AC-PERK-04)', () => {
  it('grava visualizadoEm com o carimbo do servidor', async () => {
    __semearColecao(PERKS_DA_SALA, [
      { id: 'perk-1', alunoUid: ANA.uid, tipo: TIPO_PRIORIDADE, nivel: 1, visualizadoEm: null },
    ]);

    await marcarPerkVisualizado(SALA, 'perk-1');
    __confirmarCarimbos();

    expect(__documentosDe(PERKS_DA_SALA)[0].visualizadoEm).not.toBeNull();
  });

  // A animação não pode bloquear o uso do app: se a escrita do recibo falhar,
  // o aluno continua usando a tela. O preço é a animação tocar de novo no
  // próximo carregamento, que é muito mais barato do que uma tela travada.
  it('engole a recusa do servidor em vez de derrubar a tela', async () => {
    __semearColecao(PERKS_DA_SALA, [{ id: 'perk-1', alunoUid: ANA.uid, visualizadoEm: null }]);
    __recusarEscritaEm(`${PERKS_DA_SALA}/perk-1`);

    await expect(marcarPerkVisualizado(SALA, 'perk-1')).resolves.toBe(false);
  });
});

describe('observarPerksDaSala — uma consulta por sessão, não uma por card (AC-PERF-03)', () => {
  it('escuta a coleção da sala com teto', () => {
    const cancelar = observarPerksDaSala(SALA, () => {});

    const consulta = __consultasAtivas().find((item) => item.caminho === PERKS_DA_SALA);

    expect(consulta).toBeDefined();
    expect(consulta.quantidade).toBe(LIMITE_DE_PERKS);

    cancelar();
  });

  it('entrega os perks já com o id dentro', () => {
    __semearColecao(PERKS_DA_SALA, [
      { id: 'perk-1', alunoUid: ANA.uid, tipo: TIPO_PRIORIDADE, nivel: 1 },
    ]);

    const recebidos = [];
    const cancelar = observarPerksDaSala(SALA, (perks) => recebidos.push(perks));

    expect(recebidos[0]).toEqual([
      expect.objectContaining({ id: 'perk-1', alunoUid: ANA.uid }),
    ]);

    cancelar();
  });

  it('cancela a inscrição no unsubscribe (AC-PERF-04)', () => {
    const cancelar = observarPerksDaSala(SALA, () => {});

    expect(__ouvintesAtivos()).toBeGreaterThan(0);

    cancelar();

    expect(__ouvintesAtivos()).toBe(0);
  });

  it('sem sala não escuta nada: perk vive dentro da sala', () => {
    const cancelar = observarPerksDaSala(null, () => {});

    expect(__ouvintesAtivos()).toBe(0);

    cancelar();
  });
});

describe('separarConquistas — a vitrine do aluno (AC-PERK-06)', () => {
  const PERMANENTE = {
    id: 'permanente',
    alunoUid: ANA.uid,
    tipo: 'colaborador',
    nivel: 1,
    expiraEm: null,
    revogadoEm: null,
  };

  const ATIVO = {
    id: 'ativo',
    alunoUid: ANA.uid,
    tipo: TIPO_PRIORIDADE,
    nivel: 2,
    expiraEm: Timestamp.fromDate(new Date('2026-09-29T12:00:00.000Z')),
    revogadoEm: null,
  };

  const EXPIRADO = {
    id: 'expirado',
    alunoUid: ANA.uid,
    tipo: TIPO_PRIORIDADE,
    nivel: 3,
    expiraEm: Timestamp.fromDate(new Date('2026-09-15T12:00:00.000Z')),
    revogadoEm: null,
  };

  const REVOGADO = {
    id: 'revogado',
    alunoUid: ANA.uid,
    tipo: 'destaque',
    nivel: 1,
    expiraEm: null,
    revogadoEm: Timestamp.fromDate(new Date('2026-09-20T12:00:00.000Z')),
  };

  it('separa os que valem agora dos que já venceram', () => {
    const { ativos, expirados } = separarConquistas(
      [PERMANENTE, ATIVO, EXPIRADO, REVOGADO],
      AGORA
    );

    expect(ativos.map((perk) => perk.id).sort()).toEqual(['ativo', 'permanente']);
    expect(expirados.map((perk) => perk.id).sort()).toEqual(['expirado', 'revogado']);
  });

  // O histórico é o ponto da vitrine: a premiação de março continua tendo
  // acontecido em novembro, mesmo sem valer mais.
  it('o perk vencido não some da vitrine, só muda de coluna', () => {
    const { ativos, expirados } = separarConquistas([EXPIRADO], AGORA);

    expect(ativos).toHaveLength(0);
    expect(expirados).toHaveLength(1);
  });

  it('perksDoAluno filtra pela pessoa, sem tocar nos perks dos colegas', () => {
    const doBruno = { ...ATIVO, id: 'do-bruno', alunoUid: 'uid-bruno' };

    expect(perksDoAluno([ATIVO, doBruno], ANA.uid).map((perk) => perk.id)).toEqual(['ativo']);
    expect(perksDoAluno([ATIVO, doBruno], null)).toEqual([]);
  });
});
