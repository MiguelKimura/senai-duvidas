// Relógio determinístico (AC-TEST-09).
//
// Hoje `TelaAluno` e `Chat` gravam o horário com `new Date()` do cliente — a
// falha que a task 02 vai corrigir. Enquanto isso existir, qualquer asserção
// sobre horário depende do relógio da máquina que roda o teste. Congelar o
// tempo torna a suíte reprodutível e, de quebra, deixa explícito nos testes
// *que* o horário vem do cliente.

/**
 * Congela `Date` e os timers no instante informado.
 *
 * @param {string|number|Date} instante instante a fixar.
 * @returns {{avancar: (ms: number) => void}} controle para avançar o tempo.
 */
export function fixarRelogio(instante) {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(instante));

  return {
    /** Avança relógio e timers em `ms` milissegundos. */
    avancar(ms) {
      jest.advanceTimersByTime(ms);
    },
  };
}

/** Devolve o controle do tempo ao relógio real. */
export function restaurarRelogio() {
  jest.useRealTimers();
}
