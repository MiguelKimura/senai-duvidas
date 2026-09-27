// A validação da descrição do chamado — AC-CHAMADO-01.
//
// O critério pede "descrição textual obrigatória (1 a 1000 caracteres)". A
// metade de servidor disso existe desde a v0.5.0, em `firestore.rules`:
//
//     request.resource.data.descricao.size() > 0
//     && request.resource.data.descricao.size() <= 1000
//
// A metade de cliente nunca existiu. `TelaAluno.addProblema` tinha
// `if (!descricao) return;` e nada mais: o aluno que colasse um log de 4000
// caracteres via o modal fechar, o card não aparecer e nenhuma explicação em
// lugar nenhum — a recusa acontecia do outro lado da rede, num `catch` que só
// escrevia no console.
//
// Este módulo é a metade de cliente, e ele existe separado do componente por
// dois motivos: a regra precisa ser exercitável sem montar React, e ela precisa
// ser **a mesma** nos dois lugares que criam chamado.
import {
  DESCRICAO_MAXIMA,
  DESCRICAO_MINIMA,
  MENSAGEM_VAZIA,
  mensagemDeDescricao,
  validarDescricao,
} from '../descricaoDoChamado';

describe('os limites são exatamente os que a rule pratica', () => {
  it('vai de 1 a 1000 caracteres', () => {
    expect(DESCRICAO_MINIMA).toBe(1);
    expect(DESCRICAO_MAXIMA).toBe(1000);
  });
});

describe('validarDescricao — o que passa', () => {
  it('aceita uma descrição comum', () => {
    expect(validarDescricao('O VS Code não abre')).toEqual({
      valida: true,
      texto: 'O VS Code não abre',
      tamanho: 18,
      motivo: null,
    });
  });

  it('aceita exatamente um caractere, que é o piso da rule', () => {
    expect(validarDescricao('?')).toMatchObject({ valida: true, tamanho: 1 });
  });

  it('aceita exatamente 1000 caracteres, que é o teto da rule', () => {
    expect(validarDescricao('a'.repeat(1000))).toMatchObject({ valida: true, tamanho: 1000 });
  });

  it('devolve o texto já sem os espaços das pontas, que é o que vai ao banco', () => {
    expect(validarDescricao('  o mouse não clica  ')).toMatchObject({
      valida: true,
      texto: 'o mouse não clica',
    });
  });
});

describe('validarDescricao — o que não passa', () => {
  it('recusa a descrição vazia', () => {
    expect(validarDescricao('')).toMatchObject({ valida: false, motivo: 'vazia' });
  });

  it('recusa a descrição só de espaços, que a rule aceitaria', () => {
    // A rule confere `size() > 0` sobre a string bruta: três espaços passam por
    // ela. Um card em branco na fila da turma é ruído que ninguém consegue
    // atender, então o cliente é mais estrito de propósito — e como ele envia o
    // texto já aparado, os dois lados continuam concordando.
    expect(validarDescricao('   ')).toMatchObject({ valida: false, motivo: 'vazia' });
  });

  it('recusa 1001 caracteres, que é o primeiro valor que a rule nega', () => {
    expect(validarDescricao('a'.repeat(1001))).toMatchObject({
      valida: false,
      motivo: 'longa',
      tamanho: 1001,
    });
  });

  it('recusa o log de 4000 caracteres que motivou este módulo', () => {
    expect(validarDescricao('erro na linha 12\n'.repeat(250))).toMatchObject({
      valida: false,
      motivo: 'longa',
    });
  });

  it('trata ausência e tipo errado como vazio, sem lançar', () => {
    for (const nada of [undefined, null, 0, false, {}, []]) {
      expect(validarDescricao(nada)).toMatchObject({ valida: false, motivo: 'vazia' });
    }
  });
});

describe('validarDescricao — o par emoji, onde os dois lados poderiam discordar', () => {
  // O `size()` da rule conta caracteres; o `.length` do JavaScript conta
  // unidades UTF-16, e um emoji fora do plano básico ocupa duas. Contar pelo
  // `.length` é o lado seguro do desacordo: o cliente recusa antes de a rede
  // ser usada em algo que o servidor recusaria depois. O contrário — cliente
  // aceitar e servidor negar — é justamente o defeito que este ciclo fecha.
  it('conta a unidade UTF-16, que é o limite mais apertado dos dois', () => {
    expect(validarDescricao('🙂'.repeat(500))).toMatchObject({ valida: true, tamanho: 1000 });
    expect(validarDescricao('🙂'.repeat(501))).toMatchObject({ valida: false, motivo: 'longa' });
  });
});

describe('mensagemDeDescricao — o aluno precisa saber o que fazer', () => {
  it('não diz nada quando a descrição está boa', () => {
    expect(mensagemDeDescricao(validarDescricao('tudo certo'))).toBeNull();
  });

  it('explica o campo vazio sem jargão', () => {
    expect(mensagemDeDescricao(validarDescricao(''))).toBe(MENSAGEM_VAZIA);
    expect(MENSAGEM_VAZIA).toMatch(/descreva/i);
  });

  it('no texto longo demais, diz o tamanho atual e o teto', () => {
    const mensagem = mensagemDeDescricao(validarDescricao('a'.repeat(1234)));

    expect(mensagem).toContain('1234');
    expect(mensagem).toContain('1000');
  });

  it('nenhuma mensagem é código do Firebase nem inglês', () => {
    const mensagens = [
      mensagemDeDescricao(validarDescricao('')),
      mensagemDeDescricao(validarDescricao('a'.repeat(1001))),
    ];

    for (const mensagem of mensagens) {
      expect(mensagem).not.toMatch(/permission-denied|invalid-argument|FirebaseError|[Ee]rror:/);
    }
  });
});
