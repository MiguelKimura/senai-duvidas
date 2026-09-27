// A migração dos dados globais para dentro de uma sala — task 03.
//
// É a migração mais arriscada do roadmap: ela mexe nos chamados e nas
// conversas de alunos reais, no meio de um semestre. As três exigências do
// protocolo estão presas aqui por teste:
//
//   * **idempotente** — rodar duas vezes seguidas não duplica nada;
//   * **reversível** — `--reverter` desfaz exatamente o que a ida criou;
//   * **não destrutiva** — as coleções globais não são apagadas nesta versão.
//     Elas ficam como backup vivo até a 1.0.0, e é o que permite voltar à
//     v0.4.0 em cinco minutos se algo der errado no laboratório.
const {
  CAMPO_DE_ORIGEM,
  escolherDono,
  executarPlano,
  formatarRelatorio,
  lerOpcoes,
  nomeDaSalaGeral,
  planejarMigracao,
  planejarReversao,
} = require('../migrar-para-salas');

const CARLOS = { uid: 'uid-carlos', nome: 'Carlos Lima', email: 'carlos@senai.br' };

/** `usuarios` como o app grava hoje. */
const USUARIOS = [
  { id: 'uid-carlos', dados: { nome: 'Carlos Lima', email: 'carlos@senai.br', tipo: 'professor' } },
  { id: 'uid-marta', dados: { nome: 'Marta Reis', email: 'marta@senai.br', tipo: 'professor' } },
  { id: 'uid-ana', dados: { nome: 'Ana Souza', email: 'ana@senai.br', tipo: 'aluno' } },
];

/** Chamados no formato da v0.4.0: `nome`, `email`, sem `autorUid`. */
const CHAMADOS = [
  {
    id: 'chamado-1',
    dados: {
      nome: 'Ana Souza',
      email: 'ana@senai.br',
      descricao: 'O torno travou.',
      horario: '2026-03-10T13:00:00.000Z',
    },
  },
  {
    id: 'chamado-2',
    dados: {
      nome: 'Carlos Lima',
      email: 'carlos@senai.br',
      descricao: 'Aviso da aula.',
      horario: '2026-03-10T13:05:00.000Z',
    },
  },
];

const CHAT = [
  {
    id: 'mensagem-1',
    dados: { nome: 'Ana Souza', email: 'ana@senai.br', texto: 'Bom dia' },
  },
];

/** Uma sala de destino vazia: nada foi copiado ainda. */
const DESTINO_VAZIO = { salaId: null, chamados: [], chat: [], membros: [] };

function planoPadrao(destino = DESTINO_VAZIO) {
  return planejarMigracao({
    chamados: CHAMADOS,
    chat: CHAT,
    usuarios: USUARIOS,
    destino,
    dono: CARLOS,
    ano: 2026,
  });
}

describe('escolherDono — quem fica com a Turma Geral', () => {
  it('respeita o UID passado na linha de comando, sem adivinhar nada', () => {
    const dono = escolherDono({
      usuarios: USUARIOS,
      chamados: CHAMADOS,
      chat: CHAT,
      professorUid: 'uid-marta',
    });

    expect(dono).toMatchObject({ uid: 'uid-marta', nome: 'Marta Reis' });
  });

  it('sem UID, escolhe o professor que mais escreveu', () => {
    const dono = escolherDono({ usuarios: USUARIOS, chamados: CHAMADOS, chat: CHAT });

    expect(dono.uid).toBe('uid-carlos');
  });

  it('nunca escolhe um aluno, mesmo que ele seja o mais ativo de todos', () => {
    // Ana escreveu mais que qualquer professor. A sala continua sendo do
    // professor: dono de sala pode remover aluno e gerar PIN novo.
    const dono = escolherDono({
      usuarios: USUARIOS,
      chamados: [...CHAMADOS, ...CHAMADOS.map((c) => ({ ...c, id: `${c.id}-bis` }))],
      chat: CHAT,
    });

    expect(dono.uid).not.toBe('uid-ana');
  });

  it('devolve null quando não há professor nenhum para ser dono', () => {
    expect(escolherDono({ usuarios: [], chamados: CHAMADOS, chat: CHAT })).toBeNull();
  });

  it('recusa um UID que não é de professor', () => {
    expect(() =>
      escolherDono({ usuarios: USUARIOS, chamados: [], chat: [], professorUid: 'uid-ana' })
    ).toThrow(/professor/i);
  });
});

describe('planejarMigracao — a primeira rodada', () => {
  it('cria a sala Turma Geral do ano, com o professor como dono', () => {
    const plano = planoPadrao();

    expect(plano.sala.criar).toBe(true);
    expect(plano.sala.dados).toMatchObject({
      nome: nomeDaSalaGeral(2026),
      anoLetivo: 2026,
      professorUid: CARLOS.uid,
      ativa: true,
    });
  });

  it('copia todos os chamados e mensagens PRESERVANDO os ids', () => {
    const plano = planoPadrao();

    expect(plano.chamados.map(({ id }) => id)).toEqual(['chamado-1', 'chamado-2']);
    expect(plano.chat.map(({ id }) => id)).toEqual(['mensagem-1']);
  });

  it('mantém os campos antigos e acrescenta os novos, sem renomear nada', () => {
    const [chamado] = planoPadrao().chamados;

    expect(chamado.dados).toMatchObject({
      nome: 'Ana Souza',
      autorNome: 'Ana Souza',
      autorUid: 'uid-ana',
      email: 'ana@senai.br',
      descricao: 'O torno travou.',
      horario: '2026-03-10T13:00:00.000Z',
    });
  });

  it('marca o documento copiado como vindo da coleção global', () => {
    // A marca é o que torna a reversão cirúrgica: sem ela, desfazer exigiria
    // adivinhar quais documentos da sala vieram da migração e quais foram
    // escritos pela turma depois dela.
    const [chamado] = planoPadrao().chamados;

    expect(chamado.dados[CAMPO_DE_ORIGEM]).toBeTruthy();
  });

  it('cria um membro para cada autor distinto, mais o dono', () => {
    const plano = planoPadrao();

    expect(plano.membros.map(({ uid }) => uid).sort()).toEqual(['uid-ana', 'uid-carlos']);
    expect(plano.membros.find(({ uid }) => uid === 'uid-carlos').dados.papel).toBe('professor');
    expect(plano.membros.find(({ uid }) => uid === 'uid-ana').dados.papel).toBe('aluno');
  });

  it('não inventa membro para autor que não existe em usuarios', () => {
    const plano = planejarMigracao({
      chamados: [
        { id: 'x', dados: { nome: 'Fantasma', email: 'fantasma@senai.br', descricao: 'Oi' } },
      ],
      chat: [],
      usuarios: USUARIOS,
      destino: DESTINO_VAZIO,
      dono: CARLOS,
      ano: 2026,
    });

    expect(plano.membros.map(({ uid }) => uid)).toEqual(['uid-carlos']);
    expect(plano.autoresSemUid).toContain('fantasma@senai.br');
  });

  it('não planeja apagar nada das coleções globais', () => {
    expect(planoPadrao().apagar).toEqual([]);
  });
});

describe('planejarMigracao — a segunda rodada (idempotência)', () => {
  const destinoJaMigrado = {
    salaId: 'sala-geral-2026',
    chamados: ['chamado-1', 'chamado-2'],
    chat: ['mensagem-1'],
    membros: ['uid-carlos', 'uid-ana'],
  };

  it('não copia nada de novo', () => {
    const plano = planoPadrao(destinoJaMigrado);

    expect(plano.chamados).toEqual([]);
    expect(plano.chat).toEqual([]);
    expect(plano.membros).toEqual([]);
  });

  it('não recria a sala', () => {
    expect(planoPadrao(destinoJaMigrado).sala.criar).toBe(false);
  });

  it('conta o que já estava lá, para o relatório não parecer um erro', () => {
    const plano = planoPadrao(destinoJaMigrado);

    expect(plano.jaCopiados).toEqual({ chamados: 2, chat: 1, membros: 2 });
  });

  it('copia só o que faltou quando a primeira rodada parou no meio', () => {
    const plano = planoPadrao({
      salaId: 'sala-geral-2026',
      chamados: ['chamado-1'],
      chat: [],
      membros: ['uid-carlos'],
    });

    expect(plano.chamados.map(({ id }) => id)).toEqual(['chamado-2']);
    expect(plano.chat.map(({ id }) => id)).toEqual(['mensagem-1']);
    expect(plano.membros.map(({ uid }) => uid)).toEqual(['uid-ana']);
  });
});

describe('executarPlano — o que chega ao banco', () => {
  function espiao() {
    const escritas = [];
    const remocoes = [];

    return {
      escritas,
      remocoes,
      escrever: async (registro) => escritas.push(registro),
      apagar: async (registro) => remocoes.push(registro),
    };
  }

  it('grava a sala, os chamados, as mensagens e os membros', async () => {
    const { escrever, apagar, escritas } = espiao();

    const relatorio = await executarPlano({
      plano: planoPadrao(),
      escrever,
      apagar,
      salaId: 'sala-geral-2026',
    });

    expect(escritas.map(({ colecao }) => colecao)).toEqual([
      'salas',
      'salas/sala-geral-2026/chamados',
      'salas/sala-geral-2026/chamados',
      'salas/sala-geral-2026/chat',
      'salas/sala-geral-2026/membros',
      'salas/sala-geral-2026/membros',
    ]);
    expect(relatorio.escritos).toBe(6);
  });

  it('com --dry-run, não escreve uma linha sequer', async () => {
    const { escrever, apagar, escritas } = espiao();

    const relatorio = await executarPlano({
      plano: planoPadrao(),
      escrever,
      apagar,
      salaId: 'sala-geral-2026',
      simulacao: true,
    });

    expect(escritas).toEqual([]);
    expect(relatorio.simulacao).toBe(true);
    expect(relatorio.escritos).toBe(6);
  });

  it('uma falha não interrompe o resto, e aparece no relatório', async () => {
    const escritas = [];
    const escrever = async (registro) => {
      if (registro.id === 'chamado-1') throw new Error('permission-denied');
      escritas.push(registro);
    };

    const relatorio = await executarPlano({
      plano: planoPadrao(),
      escrever,
      apagar: async () => {},
      salaId: 'sala-geral-2026',
    });

    expect(relatorio.falhas).toHaveLength(1);
    expect(relatorio.falhas[0].id).toBe('chamado-1');
    expect(escritas).toHaveLength(5);
  });
});

describe('planejarReversao — desfazer a migração', () => {
  const NA_SALA = {
    chamados: [
      { id: 'chamado-1', dados: { descricao: 'O torno travou.', [CAMPO_DE_ORIGEM]: 'chamados' } },
      { id: 'nascido-na-sala', dados: { descricao: 'Aberto depois da migração.' } },
    ],
    chat: [{ id: 'mensagem-1', dados: { texto: 'Bom dia', [CAMPO_DE_ORIGEM]: 'chat' } }],
    membros: [{ id: 'uid-ana', dados: { papel: 'aluno', [CAMPO_DE_ORIGEM]: 'chamados' } }],
  };

  it('apaga só o que a migração criou, e deixa o que nasceu na sala', () => {
    const plano = planejarReversao({ salaId: 'sala-geral-2026', ...NA_SALA });

    expect(plano.apagar.map(({ id }) => id)).toEqual(['chamado-1', 'mensagem-1', 'uid-ana']);
    expect(plano.apagar.map(({ id }) => id)).not.toContain('nascido-na-sala');
  });

  it('nunca toca nas coleções globais: elas são o backup', () => {
    const plano = planejarReversao({ salaId: 'sala-geral-2026', ...NA_SALA });

    plano.apagar.forEach(({ colecao }) => {
      expect(colecao.startsWith('salas/sala-geral-2026/')).toBe(true);
    });
    expect(plano.escrever).toEqual([]);
  });

  it('rodar a reversão duas vezes não tenta apagar o que já sumiu', () => {
    const plano = planejarReversao({
      salaId: 'sala-geral-2026',
      chamados: [{ id: 'nascido-na-sala', dados: { descricao: 'Fica.' } }],
      chat: [],
      membros: [],
    });

    expect(plano.apagar).toEqual([]);
  });
});

describe('lerOpcoes — a linha de comando', () => {
  it('sem nada, não faz nada: o padrão seguro não é escrever', () => {
    const opcoes = lerOpcoes([]);

    expect(opcoes.simulacao).toBe(false);
    expect(opcoes.confirmado).toBe(false);
  });

  it('entende --dry-run, --confirmar, --reverter, --professor e --ano', () => {
    const opcoes = lerOpcoes([
      '--dry-run',
      '--reverter',
      '--professor',
      'uid-marta',
      '--ano',
      '2025',
    ]);

    expect(opcoes).toMatchObject({
      simulacao: true,
      reverter: true,
      professorUid: 'uid-marta',
      ano: 2025,
    });
  });

  it('sem --ano, usa o ano corrente', () => {
    expect(lerOpcoes(['--dry-run']).ano).toBe(new Date().getFullYear());
  });
});

describe('formatarRelatorio — o que o operador lê', () => {
  it('diz em português o que foi feito e avisa que nada global foi apagado', () => {
    const texto = formatarRelatorio({
      salaId: 'sala-geral-2026',
      escritos: 6,
      apagados: 0,
      jaCopiados: { chamados: 0, chat: 0, membros: 0 },
      autoresSemUid: [],
      falhas: [],
      simulacao: false,
    });

    expect(texto).toMatch(/sala-geral-2026/);
    expect(texto).toMatch(/6/);
    expect(texto).toMatch(/coleções globais.*não|nada foi apagado/i);
  });

  it('avisa que a sala ainda não tem PIN, e que ele é gerado no app', () => {
    // O script não gera PIN de propósito: imprimir um PIN em claro num log de
    // operação é exatamente o que o AC-SEC-05 proíbe. O professor entra no
    // app e clica em "Gerar novo PIN".
    const texto = formatarRelatorio({
      salaId: 'sala-geral-2026',
      escritos: 6,
      apagados: 0,
      jaCopiados: { chamados: 0, chat: 0, membros: 0 },
      autoresSemUid: [],
      falhas: [],
      simulacao: false,
    });

    expect(texto).toMatch(/PIN/);
  });

  it('lista os autores que ficaram de fora por não terem cadastro', () => {
    const texto = formatarRelatorio({
      salaId: 'sala-geral-2026',
      escritos: 2,
      apagados: 0,
      jaCopiados: { chamados: 0, chat: 0, membros: 0 },
      autoresSemUid: ['fantasma@senai.br'],
      falhas: [],
      simulacao: true,
    });

    expect(texto).toMatch(/fantasma@senai\.br/);
  });
});
