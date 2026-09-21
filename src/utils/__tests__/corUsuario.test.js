// A cor de quem fala — AC-CHAT-02.
//
// O bug que este arquivo existe para impedir está em uma linha só da v0.7.0:
//
//     gerarCorParaUsuario(mensagem.email || usuarioEmail)
//
// Quando a mensagem não tem `email` — toda mensagem da v0.1.0 gravada antes de
// o campo existir —, a cor cai para o e-mail de **quem está olhando**. A mesma
// mensagem fica azul no computador da Ana e verde no do Bruno, e ninguém
// consegue usar cor para reconhecer quem falou.
//
// Os casos abaixo fecham essa porta pelos dois lados: a cor é função só da
// semente, e não existe caminho em que o leitor entre na conta.
import { corDaMensagem, corUsuario } from '../corUsuario';

describe('corUsuario — determinismo (AC-CHAT-02)', () => {
  it('devolve a mesma cor para o mesmo uid, em chamadas diferentes', () => {
    expect(corUsuario('uid-ana')).toEqual(corUsuario('uid-ana'));
  });

  it('devolve cores diferentes para uids diferentes', () => {
    expect(corUsuario('uid-ana').fundo).not.toBe(corUsuario('uid-bruno').fundo);
  });

  it('não depende de estado nenhum entre chamadas', () => {
    const daAna = corUsuario('uid-ana');
    corUsuario('uid-bruno');
    corUsuario('uid-carlos');

    expect(corUsuario('uid-ana')).toEqual(daAna);
  });

  it('devolve hexadecimal, que é o que a conta de contraste sabe ler', () => {
    expect(corUsuario('uid-ana').fundo).toMatch(/^#[0-9a-f]{6}$/);
    expect(corUsuario('uid-ana').texto).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('semente vazia continua devolvendo uma cor legível, sem lançar', () => {
    expect(() => corUsuario('')).not.toThrow();
    expect(corUsuario('').fundo).toMatch(/^#[0-9a-f]{6}$/);
    expect(corUsuario(null).fundo).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('corDaMensagem — de onde sai a semente', () => {
  it('usa o autorUid quando ele existe', () => {
    const mensagem = { autorUid: 'uid-ana', email: 'bruno@senai.br', nome: 'Ana' };

    expect(corDaMensagem(mensagem)).toEqual(corUsuario('uid-ana'));
  });

  it('cai no email da PRÓPRIA mensagem quando não há autorUid (legado v0.1.0)', () => {
    const mensagem = { nome: 'Autor Antigo', email: 'antigo@senai.br' };

    expect(corDaMensagem(mensagem)).toEqual(corUsuario('antigo@senai.br'));
  });

  it('o e-mail de quem está lendo NUNCA entra na conta', () => {
    // O cenário exato do bug: mensagem sem autorUid e sem email. A v0.7.0
    // pintava com a cor do leitor; aqui as duas leituras precisam coincidir.
    const semIdentidade = { nome: 'Autor Antigo', texto: 'sem email' };

    const comoAna = corDaMensagem(semIdentidade, { uid: 'uid-ana', email: 'ana@senai.br' });
    const comoBruno = corDaMensagem(semIdentidade, { uid: 'uid-bruno', email: 'bruno@senai.br' });

    expect(comoAna).toEqual(comoBruno);
  });

  it('a mesma pessoa tem a mesma cor em mensagens diferentes da mesma conversa', () => {
    const primeira = { autorUid: 'uid-ana', texto: 'primeira' };
    const segunda = { autorUid: 'uid-ana', texto: 'segunda' };

    expect(corDaMensagem(primeira)).toEqual(corDaMensagem(segunda));
  });

  it('mensagem sem nada não lança e devolve cor legível', () => {
    expect(() => corDaMensagem({})).not.toThrow();
    expect(corDaMensagem(undefined).fundo).toMatch(/^#[0-9a-f]{6}$/);
  });
});
