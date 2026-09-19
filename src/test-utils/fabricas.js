// Fábricas de dados para os testes.
//
// O formato produzido aqui é deliberadamente o da **v0.1.0**: `horario` como
// string ISO nos chamados, `imagem` como string de URL, e nenhum `salaId`. As
// tasks 02, 03 e 04 vão mudar esse formato — e quando mudarem, estas fábricas
// devem ganhar as variantes novas *sem perder* as antigas, porque é por elas
// que a compatibilidade retroativa continua sendo provada.

let sequencia = 0;

function proximoId(prefixo) {
  sequencia += 1;
  return `${prefixo}-${sequencia}`;
}

/** Reinicia o contador de ids. Útil quando um teste precisa de ids previsíveis. */
export function reiniciarSequencia() {
  sequencia = 0;
}

/**
 * Chamado no formato gravado pela v0.1.0 por `TelaAluno.addProblema`.
 * `horario` é string ISO do relógio do cliente — o comportamento que a task 02
 * vai substituir por `serverTimestamp()`.
 */
export function fabricaChamado(sobrescritas = {}) {
  const id = proximoId('chamado');

  return {
    id,
    nome: 'Ana Souza',
    email: 'ana.souza@senai.br',
    descricao: 'O Visual Studio não abre no computador 12.',
    horario: '2025-03-10T13:45:00.000Z',
    cor: 'hsl(210, 70%, 80%)',
    imagem: null,
    ...sobrescritas,
  };
}

/** Documento de `usuarios/{uid}`, como criado por `Cadastro`. */
export function fabricaUsuario(sobrescritas = {}) {
  const uid = proximoId('uid');

  return {
    uid,
    nome: 'Ana Souza',
    email: 'ana.souza@senai.br',
    tipo: 'aluno',
    ...sobrescritas,
  };
}

/**
 * Mensagem de chat no formato da v0.1.0: `horario` é um `Date` do cliente,
 * gravado direto pelo `Chat.enviarMensagem`.
 */
export function fabricaMensagem(sobrescritas = {}) {
  const id = proximoId('mensagem');

  return {
    id,
    texto: 'Alguém conseguiu rodar o projeto?',
    nome: 'Ana Souza',
    email: 'ana.souza@senai.br',
    horario: new Date('2025-03-10T13:45:00.000Z'),
    ...sobrescritas,
  };
}
