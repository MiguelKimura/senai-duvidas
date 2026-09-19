// `verificarPermissao` é o único portão que hoje separa aluno de professor no
// cadastro. Ele é executado **no cliente**, então não é uma garantia de
// segurança — o AC-AUTH-07 exige que a mesma regra exista nas Firestore Rules,
// o que a task 03 implementa. Aqui fixa-se o que a função faz hoje.
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import { verificarPermissao } from '../permissoes';

beforeEach(() => {
  __resetarFirestore();
});

describe('verificarPermissao', () => {
  it('autoriza quem tem autorizados/{email} com Tipo "professor"', async () => {
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);

    await expect(verificarPermissao('carlos@senai.br')).resolves.toBe(true);
  });

  it('ignora maiúsculas no valor de Tipo', async () => {
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'PROFESSOR' }]);

    await expect(verificarPermissao('carlos@senai.br')).resolves.toBe(true);
  });

  it('normaliza o e-mail recebido, aparando espaços e caixa alta', async () => {
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);

    await expect(verificarPermissao('  Carlos@Senai.BR  ')).resolves.toBe(true);
  });

  it('nega quem não tem documento em autorizados', async () => {
    await expect(verificarPermissao('intruso@senai.br')).resolves.toBe(false);
  });

  it('nega quem tem documento com Tipo diferente de professor', async () => {
    __semearColecao('autorizados', [{ id: 'monitor@senai.br', Tipo: 'monitor' }]);

    await expect(verificarPermissao('monitor@senai.br')).resolves.toBe(false);
  });

  it('nega documento sem o campo Tipo, sem lançar exceção', async () => {
    __semearColecao('autorizados', [{ id: 'vazio@senai.br' }]);

    await expect(verificarPermissao('vazio@senai.br')).resolves.toBe(false);
  });

  it('nega e-mail vazio sem consultar o banco', async () => {
    await expect(verificarPermissao('')).resolves.toBe(false);
    await expect(verificarPermissao(undefined)).resolves.toBe(false);
  });
});
