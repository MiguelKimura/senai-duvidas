// As conversas diretas — AC-DM-02, AC-DM-03, AC-DM-05, AC-DM-06.
//
// Este é o lado do cliente. O lado que **vale** é
// `tests/rules/conversas.rules.test.js`: nada aqui esconde uma conversa de
// ninguém, e um filtro de interface não é privacidade (AC-DM-04).
//
// Duas decisões de modelo estão sob teste aqui, e as duas são deliberadas:
//
// **O id é determinístico.** `uidA_uidB`, ordenados. Os dois lados precisam
// chegar ao mesmo documento sem combinar nada — se o professor abrisse
// `carlos_ana` e a aluna `ana_carlos`, cada um teria metade da conversa e
// nenhum dos dois saberia disso.
//
// **`ultimaMensagem` e `naoLidas` são desnormalizados.** Custam uma escrita a
// mais por mensagem enviada e economizam N leituras por abertura de tela.
// Abrir a tela é o que acontece o tempo todo.
import {
  __consultasAtivas,
  __documentosDe,
  __ouvintesAtivos,
  __resetarFirestore,
  __semearColecao,
  getDoc,
} from 'firebase/firestore';
import {
  abrirConversa,
  colecaoDeMensagensDiretas,
  enviarMensagemDireta,
  ErroDeChat,
  idDaConversa,
  marcarConversaComoLida,
  observarConversas,
  referenciaDaConversa,
  TAMANHO_MAXIMO_DA_MENSAGEM,
} from '../chat';

const SALA = 'sala-a';
const CONVERSAS = `salas/${SALA}/conversas`;

const ANA = { uid: 'uid-ana', nome: 'Ana Souza' };
const CARLOS = { uid: 'uid-carlos', nome: 'Carlos Lima' };
const BRUNO = { uid: 'uid-bruno', nome: 'Bruno Dias' };

/** O documento da conversa, direto do armazém. */
function conversaGravada(conversaId) {
  return __documentosDe(CONVERSAS).find((conversa) => conversa.id === conversaId);
}

beforeEach(() => {
  __resetarFirestore();
});

describe('idDaConversa — determinismo (AC-DM-02)', () => {
  it('devolve o mesmo id independentemente de quem pergunta', () => {
    expect(idDaConversa(ANA.uid, CARLOS.uid)).toBe(idDaConversa(CARLOS.uid, ANA.uid));
  });

  it('une os uids ordenados por um sublinhado', () => {
    expect(idDaConversa('uid-ana', 'uid-carlos')).toBe('uid-ana_uid-carlos');
  });

  it('dá ids diferentes a pares diferentes', () => {
    expect(idDaConversa(ANA.uid, CARLOS.uid)).not.toBe(idDaConversa(BRUNO.uid, CARLOS.uid));
  });
});

describe('abrirConversa — criação e reencontro', () => {
  it('cria a conversa com os dois participantes, em ordem', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    expect(conversaGravada(conversaId).participantes).toEqual(['uid-ana', 'uid-carlos']);
  });

  it('grava os nomes dos dois, para a lista não precisar de N leituras', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    expect(conversaGravada(conversaId).participantesNomes).toEqual({
      'uid-ana': 'Ana Souza',
      'uid-carlos': 'Carlos Lima',
    });
  });

  it('começa com os dois contadores zerados', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    expect(conversaGravada(conversaId).naoLidas).toEqual({ 'uid-ana': 0, 'uid-carlos': 0 });
  });

  it('o professor e a aluna chegam à MESMA conversa (AC-DM-02, AC-DM-03)', async () => {
    const pelaProfessora = await abrirConversa(SALA, CARLOS, ANA);
    const peloAluno = await abrirConversa(SALA, ANA, CARLOS);

    expect(peloAluno).toBe(pelaProfessora);
    expect(__documentosDe(CONVERSAS)).toHaveLength(1);
  });

  it('reabrir NÃO zera o contador de quem tem mensagem para ler', async () => {
    // O caso que um `setDoc(..., {merge: true})` quebraria em silêncio: o
    // merge reescreveria `naoLidas` com zeros e apagaria as três mensagens que
    // a Ana ainda não viu.
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);
    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'Ana, me procure na sala');
    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'é sobre o projeto');

    await abrirConversa(SALA, CARLOS, ANA);

    expect(conversaGravada(conversaId).naoLidas['uid-ana']).toBe(2);
  });

  it('reabrir não apaga a última mensagem da lista', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);
    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'me procure na sala');

    await abrirConversa(SALA, ANA, CARLOS);

    expect(conversaGravada(conversaId).ultimaMensagem.texto).toBe('me procure na sala');
  });
});

describe('enviarMensagemDireta — a mensagem e o resumo', () => {
  it('grava a mensagem na subcoleção da conversa', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'me procure na sala');

    const mensagens = __documentosDe(`${CONVERSAS}/${conversaId}/mensagens`);
    expect(mensagens).toHaveLength(1);
    expect(mensagens[0]).toMatchObject({
      texto: 'me procure na sala',
      autorUid: CARLOS.uid,
      autorNome: 'Carlos Lima',
      lidaEm: null,
    });
  });

  it('desnormaliza a última mensagem no documento da conversa (AC-DM-06)', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'primeira');
    await enviarMensagemDireta(SALA, conversaId, ANA, CARLOS.uid, 'segunda');

    expect(conversaGravada(conversaId).ultimaMensagem).toMatchObject({
      texto: 'segunda',
      autorUid: ANA.uid,
    });
  });

  it('valida o texto antes de escrever, como a conversa da sala', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    await expect(
      enviarMensagemDireta(
        SALA,
        conversaId,
        CARLOS,
        ANA.uid,
        'a'.repeat(TAMANHO_MAXIMO_DA_MENSAGEM + 1)
      )
    ).rejects.toThrow(ErroDeChat);

    expect(__documentosDe(`${CONVERSAS}/${conversaId}/mensagens`)).toHaveLength(0);
  });
});

describe('contador de não lidas (AC-DM-05)', () => {
  it('sobe o contador de quem RECEBEU, não o de quem enviou', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'oi');

    expect(conversaGravada(conversaId).naoLidas).toEqual({ 'uid-ana': 1, 'uid-carlos': 0 });
  });

  it('acumula uma por mensagem', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'uma');
    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'duas');
    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'três');

    expect(conversaGravada(conversaId).naoLidas['uid-ana']).toBe(3);
  });

  it('abrir a conversa zera o contador de quem abriu', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);
    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'oi');

    await marcarConversaComoLida(SALA, conversaId, ANA.uid);

    expect(conversaGravada(conversaId).naoLidas['uid-ana']).toBe(0);
  });

  it('zerar o próprio contador NÃO apaga o do outro lado', async () => {
    // O erro que um `updateDoc({naoLidas: {...}})` cometeria: reescrever o
    // mapa inteiro apaga justamente o que o outro ainda não leu.
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);
    await enviarMensagemDireta(SALA, conversaId, CARLOS, ANA.uid, 'do Carlos');
    await enviarMensagemDireta(SALA, conversaId, ANA, CARLOS.uid, 'da Ana');

    await marcarConversaComoLida(SALA, conversaId, ANA.uid);

    expect(conversaGravada(conversaId).naoLidas).toEqual({ 'uid-ana': 0, 'uid-carlos': 1 });
  });
});

describe('observarConversas — a lista (AC-DM-04, AC-DM-06)', () => {
  /** Uma conversa já pronta, com a última mensagem no minuto `minuto`. */
  function conversaSemeada(id, participantes, minuto) {
    return {
      id,
      participantes,
      participantesNomes: {},
      naoLidas: {},
      ultimaMensagem: {
        texto: `mensagem de ${id}`,
        autorUid: participantes[0],
        horario: new Date(Date.UTC(2026, 2, 10, 12, minuto)),
      },
    };
  }

  it('consulta por array-contains, que é o que a rule exige (AC-DM-04)', () => {
    observarConversas(SALA, ANA.uid, () => {});

    // A forma da consulta é o contrato com a Security Rule: sem o
    // `array-contains`, o Firestore nega a listagem inteira — não filtra, nega.
    const { filtros } = __consultasAtivas().find((consulta) => consulta.caminho === CONVERSAS);

    expect(filtros).toEqual([
      { __tipo: 'where', campo: 'participantes', operador: 'array-contains', valor: ANA.uid },
    ]);
  });

  it('entrega só as conversas de quem perguntou', () => {
    __semearColecao(CONVERSAS, [
      conversaSemeada('c1', [ANA.uid, CARLOS.uid], 1),
      conversaSemeada('c2', [BRUNO.uid, CARLOS.uid], 2),
    ]);

    let recebidas = [];
    observarConversas(SALA, ANA.uid, (conversas) => {
      recebidas = conversas;
    });

    expect(recebidas.map((conversa) => conversa.id)).toEqual(['c1']);
  });

  it('ordena pela mensagem mais recente (AC-DM-06)', () => {
    __semearColecao(CONVERSAS, [
      conversaSemeada('antiga', [ANA.uid, CARLOS.uid], 1),
      conversaSemeada('recente', [ANA.uid, BRUNO.uid], 30),
      conversaSemeada('meio', [ANA.uid, 'uid-dani'], 15),
    ]);

    let recebidas = [];
    observarConversas(SALA, ANA.uid, (conversas) => {
      recebidas = conversas;
    });

    expect(recebidas.map((conversa) => conversa.id)).toEqual(['recente', 'meio', 'antiga']);
  });

  it('devolve uma função que cancela a inscrição (AC-PERF-04)', () => {
    const cancelar = observarConversas(SALA, ANA.uid, () => {});
    expect(__ouvintesAtivos()).toBe(1);

    cancelar();

    expect(__ouvintesAtivos()).toBe(0);
  });
});

describe('referências das conversas', () => {
  it('a conversa mora dentro da sala, nunca numa coleção global', () => {
    expect(referenciaDaConversa(SALA, 'c1').__caminho).toBe(`salas/${SALA}/conversas/c1`);
  });

  it('as mensagens moram dentro da conversa', () => {
    expect(colecaoDeMensagensDiretas(SALA, 'c1').__caminho).toBe(
      `salas/${SALA}/conversas/c1/mensagens`
    );
  });

  it('a conversa criada é alcançável pela referência', async () => {
    const conversaId = await abrirConversa(SALA, CARLOS, ANA);

    const documento = await getDoc(referenciaDaConversa(SALA, conversaId));
    expect(documento.exists()).toBe(true);
  });
});
