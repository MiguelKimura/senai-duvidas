// Relógio determinístico (AC-TEST-09).
//
// Desde a task 02 o horário dos dados vem do servidor, não do relógio da
// máquina — quem controla o instante carimbado nos testes é
// `__definirRelogioDoServidor`, do fake de Firestore. Este helper continua
// valendo para o outro lado do tempo: o relógio do LEITOR, que decide o
// "agora" de `formatarRelativo` e o disparo do reset do chat à meia-noite.
// Congelá-lo é o que torna essas asserções reprodutíveis, e é também o que
// prova que a suíte não depende do fuso da máquina que a roda (AC-TEST-09).

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
