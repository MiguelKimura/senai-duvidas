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
import { paraData } from '../tempo';
import { Timestamp } from 'firebase/firestore';

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
