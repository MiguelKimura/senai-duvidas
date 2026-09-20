// AC-TEST-09: testes determinísticos, sem dependência do relógio real.
// Vários componentes ainda chamam `new Date()` na gravação (é exatamente o que a
// task 02 vai corrigir). Enquanto isso, os testes precisam de um relógio fixo,
// senão a asserção de horário muda a cada execução.
import { fixarRelogio, restaurarRelogio } from '../index';

describe('relógio determinístico', () => {
  afterEach(() => {
    restaurarRelogio();
  });

  it('congela new Date() no instante pedido', () => {
    fixarRelogio('2025-03-10T13:45:00.000Z');

    expect(new Date().toISOString()).toBe('2025-03-10T13:45:00.000Z');
  });

  it('mantém o instante estável entre duas leituras', () => {
    fixarRelogio('2025-03-10T13:45:00.000Z');

    const primeira = Date.now();
    const segunda = Date.now();

    expect(segunda).toBe(primeira);
  });

  it('avança o relógio somente quando o teste pede', () => {
    const relogio = fixarRelogio('2025-03-10T13:45:00.000Z');

    relogio.avancar(60_000);

    expect(new Date().toISOString()).toBe('2025-03-10T13:46:00.000Z');
  });

  it('devolve o relógio real ao final, sem vazar para o próximo teste', () => {
    fixarRelogio('2025-03-10T13:45:00.000Z');
    restaurarRelogio();

    expect(new Date().toISOString()).not.toBe('2025-03-10T13:45:00.000Z');
  });
});
