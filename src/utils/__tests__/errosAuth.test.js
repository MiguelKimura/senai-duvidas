// AC-AUTH-05 — o erro do Firebase nunca chega cru ao usuário.
//
// O que a v0.2.0 fazia: `firebase.js` montava a mensagem com
// `Erro desconhecido: ${error.message}` e despejava tudo num `alert()`. Em
// laboratório, o aluno lia "Firebase: Error (auth/...)." e travava a aba.
//
// O contrato aqui é o inverso: para todo erro, sai uma frase em português que
// diz o que aconteceu e o que fazer. Nenhum código do Firebase, nenhum trecho
// de `error.message`, nunca.
import { traduzirErroDeAuth } from '../errosAuth';

describe('traduzirErroDeAuth — códigos conhecidos', () => {
  it.each([
    ['auth/popup-closed-by-user', /janela de login foi fechada/i],
    ['auth/cancelled-popup-request', /outra tentativa de login/i],
    ['auth/popup-blocked', /pop-?up/i],
    ['auth/network-request-failed', /conex[ãa]o/i],
    ['auth/unauthorized-domain', /dom[íi]nio/i],
    ['auth/invalid-credential', /e-mail ou senha/i],
    ['auth/wrong-password', /e-mail ou senha/i],
    ['auth/user-not-found', /e-mail ou senha/i],
    ['auth/invalid-email', /e-mail.*v[áa]lido/i],
    ['auth/email-already-in-use', /j[áa] est[áa] em uso/i],
    ['auth/weak-password', /6 caracteres/i],
    ['auth/too-many-requests', /muitas tentativas/i],
  ])('%s vira uma frase em português', (codigo, esperado) => {
    expect(traduzirErroDeAuth({ code: codigo, message: 'Firebase: Error (bruto).' })).toMatch(
      esperado
    );
  });

  it('explica como vincular a conta quando o e-mail já existe com outro método', () => {
    const mensagem = traduzirErroDeAuth({
      code: 'auth/account-exists-with-different-credential',
      message: 'Firebase: Error (auth/account-exists-with-different-credential).',
    });

    // Não basta dizer "já existe": o AC-AUTH-05 exige explicar como vincular.
    expect(mensagem).toMatch(/j[áa] (est[áa]|foi) cadastrado/i);
    expect(mensagem).toMatch(/entre .*(com|pelo) .*(m[ée]todo|e-mail e senha)/i);
  });
});

describe('traduzirErroDeAuth — nunca vaza o erro cru', () => {
  it.each([
    ['auth/popup-closed-by-user'],
    ['auth/account-exists-with-different-credential'],
    ['auth/internal-error'],
    ['auth/codigo-que-ainda-nao-existe'],
  ])('a mensagem de %s não contém o código nem o texto do Firebase', (codigo) => {
    const mensagem = traduzirErroDeAuth({
      code: codigo,
      message: 'Firebase: Error (auth/algum-codigo-cru).',
      stack: 'Error\n    at signInWithPopup (firebase.js:1:1)',
    });

    expect(mensagem).not.toMatch(/auth\//);
    expect(mensagem).not.toMatch(/Firebase/i);
    expect(mensagem).not.toMatch(/at signInWithPopup/);
  });

  it('código desconhecido cai numa mensagem genérica que orienta o usuário', () => {
    expect(traduzirErroDeAuth({ code: 'auth/algo-novo' })).toMatch(/tente novamente/i);
  });

  it('erro sem código nenhum também é traduzido, sem lançar', () => {
    expect(() => traduzirErroDeAuth(new Error('quebrou'))).not.toThrow();
    expect(traduzirErroDeAuth(new Error('quebrou'))).toMatch(/tente novamente/i);
  });

  it('aceita undefined sem lançar', () => {
    expect(traduzirErroDeAuth(undefined)).toMatch(/tente novamente/i);
  });
});
