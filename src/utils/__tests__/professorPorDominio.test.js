// A porta automática para o papel de professor (v1.1.0): e-mail do domínio
// do SENAI-SP, confirmado. A mesma regra vive em `firestore.rules`.
import {
  aguardaConfirmacaoDeProfessor,
  ehEmailDeProfessor,
  ehProfessorPorDominio,
} from '../professorPorDominio';

describe('ehEmailDeProfessor', () => {
  it.each(['maria@sp.senai.br', 'Maria.Silva@SP.SENAI.BR', '  joao@sp.senai.br  '])(
    'aceita %p',
    (email) => {
      expect(ehEmailDeProfessor(email)).toBe(true);
    }
  );

  it.each([
    'maria@aluno.sp.senai.br',
    'maria@naosp.senai.br',
    'maria@sp.senai.br.golpe.com',
    'maria@senai.br',
    'maria@gmail.com',
    '',
    null,
    undefined,
  ])('recusa %p', (email) => {
    expect(ehEmailDeProfessor(email)).toBe(false);
  });
});

describe('ehProfessorPorDominio', () => {
  it('exige o e-mail confirmado', () => {
    expect(ehProfessorPorDominio({ email: 'maria@sp.senai.br', emailVerified: true })).toBe(
      true
    );
    expect(ehProfessorPorDominio({ email: 'maria@sp.senai.br', emailVerified: false })).toBe(
      false
    );
    expect(ehProfessorPorDominio({ email: 'maria@sp.senai.br' })).toBe(false);
  });

  it('confirmado não basta fora do domínio', () => {
    expect(ehProfessorPorDominio({ email: 'maria@gmail.com', emailVerified: true })).toBe(
      false
    );
  });

  it('sem usuário, não é professor', () => {
    expect(ehProfessorPorDominio(null)).toBe(false);
  });
});

describe('aguardaConfirmacaoDeProfessor', () => {
  it('é o e-mail institucional ainda não confirmado', () => {
    expect(
      aguardaConfirmacaoDeProfessor({ email: 'maria@sp.senai.br', emailVerified: false })
    ).toBe(true);
    expect(
      aguardaConfirmacaoDeProfessor({ email: 'maria@sp.senai.br', emailVerified: true })
    ).toBe(false);
    expect(
      aguardaConfirmacaoDeProfessor({ email: 'ana@gmail.com', emailVerified: false })
    ).toBe(false);
  });
});
