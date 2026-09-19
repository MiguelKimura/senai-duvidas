// As fábricas existem para que cada teste declare apenas o que lhe importa.
// Um teste de ordenação fala de horário e ignora nome, e-mail e cor; um teste de
// autoria fala de e-mail e ignora o resto. Sem isso, todo teste vira uma parede
// de dados irrelevantes e qualquer mudança de modelo quebra a suíte inteira.
import { fabricaChamado, fabricaMensagem, fabricaUsuario } from '../index';

describe('fabricaChamado', () => {
  it('produz um chamado completo no formato gravado hoje', () => {
    const chamado = fabricaChamado();

    expect(chamado).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        nome: expect.any(String),
        email: expect.any(String),
        descricao: expect.any(String),
        horario: expect.any(String),
        cor: expect.any(String),
      })
    );
  });

  it('grava horario como string ISO, que é o formato da v0.1.0', () => {
    const chamado = fabricaChamado();

    expect(chamado.horario).toBe(new Date(chamado.horario).toISOString());
  });

  it('deixa a sobrescrita vencer o padrão', () => {
    const chamado = fabricaChamado({ descricao: 'a impressora parou', imagem: null });

    expect(chamado.descricao).toBe('a impressora parou');
    expect(chamado.imagem).toBeNull();
  });

  it('gera ids distintos a cada chamada, para não colidir em listas', () => {
    expect(fabricaChamado().id).not.toBe(fabricaChamado().id);
  });
});

describe('fabricaUsuario', () => {
  it('produz um aluno por padrão', () => {
    const usuario = fabricaUsuario();

    expect(usuario.tipo).toBe('aluno');
    expect(usuario).toEqual(
      expect.objectContaining({
        uid: expect.any(String),
        nome: expect.any(String),
        email: expect.any(String),
      })
    );
  });

  it('produz um professor quando pedido', () => {
    expect(fabricaUsuario({ tipo: 'professor' }).tipo).toBe('professor');
  });
});

describe('fabricaMensagem', () => {
  it('produz uma mensagem de chat com texto, nome, email e horario', () => {
    const mensagem = fabricaMensagem();

    expect(mensagem).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        texto: expect.any(String),
        nome: expect.any(String),
        email: expect.any(String),
        horario: expect.any(Date),
      })
    );
  });
});
