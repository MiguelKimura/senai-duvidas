// `verificarPermissao` é o único portão que hoje separa aluno de professor no
// cadastro. Ele é executado **no cliente**, então não é uma garantia de
// segurança — o AC-AUTH-07 exige que a mesma regra exista nas Firestore Rules,
// o que a task 03 implementa. Aqui fixa-se o que a função faz hoje.
import * as firestore from 'firebase/firestore';
import { __resetarFirestore, __semearColecao } from 'firebase/firestore';
import { verificarPermissao } from '../permissoes';

beforeEach(() => {
  __resetarFirestore();
});

afterEach(() => {
  jest.restoreAllMocks();
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

// O console do navegador é lido em projeção, na frente da turma, e fica
// gravado em qualquer captura de tela de suporte. O e-mail de quem está
// entrando não pode aparecer lá.
describe('verificarPermissao — nenhum dado pessoal no console', () => {
  /** Tudo o que foi escrito no console durante a chamada, como texto. */
  async function consoleDurante(chamada) {
    const escrito = [];
    const registrar = (...argumentos) => escrito.push(JSON.stringify(argumentos));

    jest.spyOn(console, 'log').mockImplementation(registrar);
    jest.spyOn(console, 'error').mockImplementation(registrar);
    jest.spyOn(console, 'warn').mockImplementation(registrar);

    await chamada();

    return escrito.join(' ');
  }

  it('não registra o e-mail consultado quando autoriza', async () => {
    __semearColecao('autorizados', [{ id: 'carlos@senai.br', Tipo: 'professor' }]);

    const saida = await consoleDurante(() => verificarPermissao('carlos@senai.br'));

    expect(saida).not.toMatch(/carlos@senai\.br/);
  });

  it('não registra o e-mail consultado quando nega', async () => {
    const saida = await consoleDurante(() => verificarPermissao('intruso@senai.br'));

    expect(saida).not.toMatch(/intruso@senai\.br/);
  });

  it('não despeja o documento de autorizados no console', async () => {
    __semearColecao('autorizados', [
      { id: 'carlos@senai.br', Tipo: 'professor', matricula: '2024-0031' },
    ]);

    const saida = await consoleDurante(() => verificarPermissao('carlos@senai.br'));

    expect(saida).not.toMatch(/2024-0031/);
  });

  it('continua negando em silêncio quando o e-mail é vazio', async () => {
    const saida = await consoleDurante(() => verificarPermissao(''));

    expect(saida).toBe('');
  });

  // A mensagem de erro do Firestore cita o caminho do documento — e o caminho
  // é `autorizados/{email}`. Registrar o erro cru publica o e-mail.
  it('nega sem registrar nada quando a leitura do Firestore falha', async () => {
    jest
      .spyOn(firestore, 'getDoc')
      .mockRejectedValue(new Error('Missing permissions on autorizados/carlos@senai.br'));

    let permitido;
    const saida = await consoleDurante(async () => {
      permitido = await verificarPermissao('carlos@senai.br');
    });

    expect(permitido).toBe(false);
    expect(saida).toBe('');
  });
});
