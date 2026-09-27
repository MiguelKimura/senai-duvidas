// Tradução dos erros de autenticação do Firebase — AC-AUTH-05.
//
// Regra única deste módulo: o que sai daqui é lido por um aluno do SENAI no
// meio da aula. Então nada de código do SDK, nada de `error.message` e nada de
// pilha — só uma frase em português que diz o que aconteceu e qual é a próxima
// ação possível.
//
// Quem chama este módulo renderiza a mensagem no formulário. O `alert()` da
// v0.2.0 saiu de cena: ele bloqueia a aba e some sem deixar rastro na tela.

/** Mensagem usada quando o código não é conhecido — ou nem existe. */
const MENSAGEM_GENERICA = 'Não foi possível concluir a operação. Tente novamente em instantes.';

/**
 * Credencial recusada. Os três códigos abaixo distinguem "e-mail não existe" de
 * "senha errada"; repassar essa distinção ao usuário entregaria de graça a
 * informação de quais e-mails têm conta, então os três dizem a mesma coisa.
 */
const CREDENCIAL_INVALIDA = 'E-mail ou senha incorretos. Confira os dados e tente novamente.';

const MENSAGENS = {
  'auth/popup-closed-by-user':
    'A janela de login foi fechada antes de terminar. Clique no botão de novo para tentar outra vez.',
  'auth/cancelled-popup-request':
    'Outra tentativa de login já estava aberta. Feche as janelas extras e tente de novo.',
  'auth/popup-blocked':
    'O navegador bloqueou a janela de login. Libere os pop-ups para este site e tente de novo.',
  'auth/network-request-failed':
    'Sem conexão com a internet. Verifique a rede do laboratório e tente de novo.',
  'auth/unauthorized-domain':
    'O domínio deste endereço não está autorizado para login. Avise o professor responsável pelo sistema.',
  'auth/internal-error':
    'O serviço de login falhou momentaneamente. Tente novamente em instantes.',
  'auth/account-exists-with-different-credential':
    'Este e-mail já está cadastrado por outro método de login. Entre com o método usado da primeira vez — normalmente e-mail e senha — e, já dentro do sistema, vincule a outra conta nas configurações do provedor.',
  'auth/invalid-credential': CREDENCIAL_INVALIDA,
  'auth/wrong-password': CREDENCIAL_INVALIDA,
  'auth/user-not-found': CREDENCIAL_INVALIDA,
  'auth/invalid-email': 'Informe um e-mail válido, no formato nome@dominio.com.',
  'auth/email-already-in-use':
    'Este e-mail já está em uso. Entre com ele ou cadastre-se com outro.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/too-many-requests':
    'Muitas tentativas seguidas. Espere alguns minutos antes de tentar de novo.',
  'auth/user-disabled':
    'Esta conta foi desativada. Procure o professor responsável pelo sistema.',
  'auth/operation-not-allowed':
    'Este método de login não está habilitado. Avise o professor responsável pelo sistema.',
};

/**
 * Converte um erro do Firebase Auth em mensagem exibível.
 *
 * @param {{code?: string}|Error|undefined} erro erro lançado pelo SDK.
 * @returns {string} frase em português, sem código nem pilha do Firebase.
 */
export function traduzirErroDeAuth(erro) {
  const codigo = erro && erro.code;

  return MENSAGENS[codigo] || MENSAGEM_GENERICA;
}
