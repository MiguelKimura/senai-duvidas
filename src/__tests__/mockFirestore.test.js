// Os testes de caracterização inteiros se apoiam neste fake de Firestore. Se ele
// mentir, toda a rede de segurança das tasks 01–09 mente junto. Por isso ele tem
// testes próprios, cobrindo as operações que os componentes realmente usam:
// addDoc, deleteDoc, getDoc/setDoc, getDocs, query+orderBy e onSnapshot.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  __carimbosPendentes,
  __confirmarCarimbos,
  __definirRelogioDoServidor,
  __recusarEscritaEm,
  __recusarLeituraEm,
  __resetarFirestore,
  __semearColecao,
} from 'firebase/firestore';

const db = getFirestore();

beforeEach(() => {
  __resetarFirestore();
});

describe('fake de Firestore', () => {
  it('addDoc grava e devolve um id', async () => {
    const ref = await addDoc(collection(db, 'chamados'), { descricao: 'sem rede' });

    const snap = await getDoc(doc(db, 'chamados', ref.id));
    expect(snap.exists()).toBe(true);
    expect(snap.data()).toEqual({ descricao: 'sem rede' });
  });

  it('deleteDoc remove o documento', async () => {
    __semearColecao('chamados', [{ id: 'c1', descricao: 'travou' }]);

    await deleteDoc(doc(db, 'chamados', 'c1'));

    expect((await getDoc(doc(db, 'chamados', 'c1'))).exists()).toBe(false);
  });

  it('getDoc de documento inexistente não lança e responde exists() falso', async () => {
    const snap = await getDoc(doc(db, 'usuarios', 'ninguem'));

    expect(snap.exists()).toBe(false);
    expect(snap.data()).toBeUndefined();
  });

  it('setDoc cria o documento no id escolhido', async () => {
    await setDoc(doc(db, 'usuarios', 'uid-1'), { nome: 'Ana', tipo: 'aluno' });

    expect((await getDoc(doc(db, 'usuarios', 'uid-1'))).data()).toEqual({
      nome: 'Ana',
      tipo: 'aluno',
    });
  });

  it('getDocs devolve todos os documentos da coleção com ref para exclusão', async () => {
    __semearColecao('chat', [{ id: 'm1', texto: 'oi' }, { id: 'm2', texto: 'tudo bem?' }]);

    const snap = await getDocs(query(collection(db, 'chat')));

    expect(snap.docs).toHaveLength(2);
    expect(snap.docs[0].ref).toBeDefined();
  });

  it('query com orderBy ordena pelo campo pedido', async () => {
    __semearColecao('chat', [
      { id: 'm2', texto: 'segunda', horario: new Date('2025-03-10T10:05:00Z') },
      { id: 'm1', texto: 'primeira', horario: new Date('2025-03-10T10:00:00Z') },
    ]);

    const snap = await getDocs(query(collection(db, 'chat'), orderBy('horario')));

    expect(snap.docs.map((d) => d.data().texto)).toEqual(['primeira', 'segunda']);
  });

  it('onSnapshot entrega o estado atual assim que é registrado', () => {
    __semearColecao('chamados', [{ id: 'c1', descricao: 'travou' }]);
    const ouvinte = jest.fn();

    onSnapshot(collection(db, 'chamados'), ouvinte);

    expect(ouvinte).toHaveBeenCalledTimes(1);
    expect(ouvinte.mock.calls[0][0].docs).toHaveLength(1);
  });

  it('onSnapshot reemite a cada escrita — é o tempo real do AC-CHAMADO-02', async () => {
    const ouvinte = jest.fn();
    onSnapshot(collection(db, 'chamados'), ouvinte);

    await addDoc(collection(db, 'chamados'), { descricao: 'nova dúvida' });

    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(ouvinte.mock.calls[1][0].docs).toHaveLength(1);
  });

  it('a função devolvida por onSnapshot cancela a inscrição (AC-PERF-04)', async () => {
    const ouvinte = jest.fn();
    const cancelar = onSnapshot(collection(db, 'chamados'), ouvinte);

    cancelar();
    await addDoc(collection(db, 'chamados'), { descricao: 'depois do unmount' });

    expect(ouvinte).toHaveBeenCalledTimes(1);
  });

  it('Timestamp converte para Date e é reconhecido por instanceof', () => {
    const agora = new Date('2025-03-10T13:45:00.000Z');

    const ts = Timestamp.fromDate(agora);

    expect(ts).toBeInstanceOf(Timestamp);
    expect(ts.toDate().toISOString()).toBe(agora.toISOString());
  });

  it('__resetarFirestore limpa dados e ouvintes entre testes', async () => {
    __semearColecao('chamados', [{ id: 'c1', descricao: 'travou' }]);

    __resetarFirestore();

    const snap = await getDocs(query(collection(db, 'chamados')));
    expect(snap.docs).toHaveLength(0);
  });
});

// O fake precisa mentir o mínimo possível sobre o `serverTimestamp()`, porque
// é sobre ele que a task 02 inteira se apoia. O SDK real tem duas fases:
//
//   1. escrita otimista — o documento local aparece na hora, com o campo
//      carimbado em `null`, e o `onSnapshot` reemite;
//   2. confirmação — o servidor responde com o `Timestamp` de verdade, e o
//      `onSnapshot` reemite de novo, agora com o valor definitivo.
//
// Um fake que gravasse o sentinela cru esconderia exatamente a janela em que a
// UI precisa dizer "enviando…" (AC-TEMPO-06) e em que o card não pode pular de
// posição na fila.
describe('fake de Firestore — as duas fases do serverTimestamp()', () => {
  it('grava o campo carimbado como null enquanto o servidor não confirma', async () => {
    const ref = await addDoc(collection(db, 'chamados'), {
      descricao: 'sem rede',
      horario: serverTimestamp(),
    });

    expect((await getDoc(doc(db, 'chamados', ref.id))).data()).toEqual({
      descricao: 'sem rede',
      horario: null,
    });
  });

  it('conta a escrita como pendente até a confirmação', async () => {
    await addDoc(collection(db, 'chamados'), { horario: serverTimestamp() });

    expect(__carimbosPendentes()).toBe(1);

    __confirmarCarimbos();

    expect(__carimbosPendentes()).toBe(0);
  });

  it('troca o null pelo Timestamp do relógio do servidor na confirmação', async () => {
    __definirRelogioDoServidor('2026-09-19T17:32:00.000Z');
    const ref = await addDoc(collection(db, 'chamados'), { horario: serverTimestamp() });

    __confirmarCarimbos();

    const gravado = (await getDoc(doc(db, 'chamados', ref.id))).data().horario;
    expect(gravado.toDate()).toEqual(new Date('2026-09-19T17:32:00.000Z'));
  });

  it('o relógio do servidor é independente do relógio da máquina', async () => {
    __definirRelogioDoServidor('2026-09-19T17:32:00.000Z');
    const ref = await addDoc(collection(db, 'chamados'), { horario: serverTimestamp() });

    __confirmarCarimbos();

    const gravado = (await getDoc(doc(db, 'chamados', ref.id))).data().horario;
    expect(gravado.toMillis()).not.toBe(Date.now());
  });

  it('reemite o onSnapshot nas duas fases: na escrita e na confirmação', async () => {
    const ouvinte = jest.fn();
    onSnapshot(collection(db, 'chamados'), ouvinte);

    await addDoc(collection(db, 'chamados'), { horario: serverTimestamp() });
    expect(ouvinte).toHaveBeenCalledTimes(2);
    expect(ouvinte.mock.calls[1][0].docs[0].data().horario).toBeNull();

    __confirmarCarimbos();

    expect(ouvinte).toHaveBeenCalledTimes(3);
    expect(ouvinte.mock.calls[2][0].docs[0].data().horario).toBeInstanceOf(Timestamp);
  });

  it('setDoc carimba do mesmo jeito que addDoc', async () => {
    await setDoc(doc(db, 'usuarios', 'uid-1'), { nome: 'Ana', criadoEm: serverTimestamp() });

    expect((await getDoc(doc(db, 'usuarios', 'uid-1'))).data().criadoEm).toBeNull();

    __confirmarCarimbos();

    expect((await getDoc(doc(db, 'usuarios', 'uid-1'))).data().criadoEm).toBeInstanceOf(
      Timestamp
    );
  });

  it('não deixa carimbo pendente atravessar de um teste para o outro', async () => {
    await addDoc(collection(db, 'chamados'), { horario: serverTimestamp() });

    __resetarFirestore();

    expect(__carimbosPendentes()).toBe(0);
  });
});

describe('fake de Firestore — updateDoc', () => {
  it('mescla os campos novos sem apagar os que já estavam lá', async () => {
    __semearColecao('chamados', [{ id: 'c1', descricao: 'travou', cor: 'hsl(1, 2%, 3%)' }]);

    await updateDoc(doc(db, 'chamados', 'c1'), { horarioIso: '2026-09-19T17:32:00.000Z' });

    expect((await getDoc(doc(db, 'chamados', 'c1'))).data()).toEqual({
      descricao: 'travou',
      cor: 'hsl(1, 2%, 3%)',
      horarioIso: '2026-09-19T17:32:00.000Z',
    });
  });

  it('avisa os ouvintes da coleção', async () => {
    __semearColecao('chamados', [{ id: 'c1', descricao: 'travou' }]);
    const ouvinte = jest.fn();
    onSnapshot(collection(db, 'chamados'), ouvinte);

    await updateDoc(doc(db, 'chamados', 'c1'), { horarioIso: '2026-09-19T17:32:00.000Z' });

    expect(ouvinte).toHaveBeenCalledTimes(2);
  });
});

// A task 03 escopa chamados e chat em subcoleções de `salas/{salaId}` e passa
// a paginar todo listener (AC-PERF-03). Nenhuma das duas coisas dá para provar
// num fake que ignora `where` e `limit`: a consulta devolveria a coleção
// inteira e o teste passaria sem que o código filtrasse nada.
describe('fake de Firestore — where (AC-SALA-07)', () => {
  beforeEach(() => {
    __semearColecao('salas/sala-a/chamados', [
      { id: 'c1', descricao: 'aberto', atendido: false },
      { id: 'c2', descricao: 'resolvido', atendido: true },
      { id: 'c3', descricao: 'antigo sem o campo' },
    ]);
  });

  it('filtra por igualdade', async () => {
    const consulta = query(collection(db, 'salas/sala-a/chamados'), where('atendido', '==', false));

    const encontrados = (await getDocs(consulta)).docs.map((documento) => documento.id);

    expect(encontrados).toEqual(['c1']);
  });

  it('não entrega documento sem o campo, como o Firestore de verdade', async () => {
    const consulta = query(collection(db, 'salas/sala-a/chamados'), where('atendido', '==', true));

    const encontrados = (await getDocs(consulta)).docs.map((documento) => documento.id);

    expect(encontrados).toEqual(['c2']);
  });

  it('aceita mais de um filtro, e eles se somam', async () => {
    const consulta = query(
      collection(db, 'salas/sala-a/chamados'),
      where('atendido', '==', false),
      where('descricao', '==', 'aberto')
    );

    expect((await getDocs(consulta)).size).toBe(1);
  });

  it('vale também para o onSnapshot, e não só para o getDocs', () => {
    const ouvinte = jest.fn();

    onSnapshot(
      query(collection(db, 'salas/sala-a/chamados'), where('atendido', '==', false)),
      ouvinte
    );

    expect(ouvinte.mock.calls[0][0].docs.map((documento) => documento.id)).toEqual(['c1']);
  });

  it('separa as subcoleções de duas salas (AC-SALA-07)', async () => {
    __semearColecao('salas/sala-b/chamados', [{ id: 'c9', descricao: 'da outra turma' }]);

    const daSalaA = await getDocs(collection(db, 'salas/sala-a/chamados'));

    expect(daSalaA.docs.map((documento) => documento.id)).not.toContain('c9');
  });
});

describe('fake de Firestore — limit (AC-PERF-03)', () => {
  beforeEach(() => {
    __semearColecao(
      'salas/sala-a/chat',
      Array.from({ length: 10 }, (_, indice) => ({
        id: `m${indice}`,
        texto: `mensagem ${indice}`,
        horario: new Date(2025, 2, 10, 8, indice),
      }))
    );
  });

  it('corta a consulta no tamanho pedido', async () => {
    const consulta = query(collection(db, 'salas/sala-a/chat'), limit(3));

    expect((await getDocs(consulta)).size).toBe(3);
  });

  it('corta depois de ordenar, e não antes', async () => {
    const consulta = query(collection(db, 'salas/sala-a/chat'), orderBy('horario', 'desc'), limit(2));

    const textos = (await getDocs(consulta)).docs.map((documento) => documento.data().texto);

    expect(textos).toEqual(['mensagem 9', 'mensagem 8']);
  });

  it('vale para o onSnapshot', () => {
    const ouvinte = jest.fn();

    onSnapshot(query(collection(db, 'salas/sala-a/chat'), limit(4)), ouvinte);

    expect(ouvinte.mock.calls[0][0].size).toBe(4);
  });
});

// O servidor recusa escritas o tempo todo: PIN já usado, sala de outro
// professor, sala arquivada. Sem uma forma de provocar a recusa, o caminho de
// erro do cliente — o que regera o PIN depois de uma colisão, por exemplo —
// só seria exercitado contra o emulador, e nunca no teste unitário.
describe('fake de Firestore — recusa de escrita', () => {
  it('faz a escrita no caminho marcado falhar com permission-denied', async () => {
    __recusarEscritaEm('indicePins/123456');

    await expect(setDoc(doc(db, 'indicePins', '123456'), { salaId: 's1' })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('recusa uma vez só, como a colisão que some quando o PIN muda', async () => {
    __recusarEscritaEm('indicePins/123456');

    await expect(setDoc(doc(db, 'indicePins', '123456'), { salaId: 's1' })).rejects.toBeDefined();
    await expect(setDoc(doc(db, 'indicePins', '123456'), { salaId: 's1' })).resolves.toBeUndefined();
  });

  it('não recusa escrita em outro caminho', async () => {
    __recusarEscritaEm('indicePins/123456');

    await expect(setDoc(doc(db, 'indicePins', '654321'), { salaId: 's1' })).resolves.toBeUndefined();
  });

  it('a recusa não atravessa de um teste para o outro', async () => {
    __recusarEscritaEm('indicePins/123456');
    __resetarFirestore();

    await expect(setDoc(doc(db, 'indicePins', '123456'), { salaId: 's1' })).resolves.toBeUndefined();
  });

  it('também recusa leitura quando o caminho é marcado para leitura', async () => {
    __recusarLeituraEm('salas/sala-a/segredo/pin');

    await expect(getDoc(doc(db, 'salas/sala-a/segredo/pin'))).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });
});


describe('fake de Firestore — recusa repetida', () => {
  it('recusa quantas vezes forem pedidas, e só', async () => {
    __recusarEscritaEm('tentativasPin/uid-ana', 2);

    const escrever = () => setDoc(doc(db, 'tentativasPin', 'uid-ana'), { tentativas: 1 });

    await expect(escrever()).rejects.toBeDefined();
    await expect(escrever()).rejects.toBeDefined();
    await expect(escrever()).resolves.toBeUndefined();
  });
});
