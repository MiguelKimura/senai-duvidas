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
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
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
