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
import { corDaMensagem, corDeMatiz, corUsuario } from '../corUsuario';
import { CONTRASTE_MINIMO, razaoContraste } from '../paleta';

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
    const comoBruno = corDaMensagem(semIdentidade, {
      uid: 'uid-bruno',
      email: 'bruno@senai.br',
    });

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

// ---------------------------------------------------------------------------
// Contraste — AC-CHAT-02 e AC-ANIM-10.
//
// Uma cor por usuário só é útil se o nome e o texto continuarem legíveis por
// cima dela. A paleta do card (task 05) resolveu isso com nove cores escolhidas
// à mão e verificadas uma a uma; aqui não dá: o matiz sai de um hash, e não há
// lista para revisar. A verificação precisa ser a busca em si.
//
// Mil UIDs sintéticos não é número redondo por acaso: são mais matizes do que
// os 360 possíveis, então o laço percorre o círculo de cores inteiro várias
// vezes. Se existir uma faixa de matiz em que a conta falha — o amarelo é a
// suspeita clássica —, ela cai aqui.
// ---------------------------------------------------------------------------
describe('corUsuario — contraste (AC-CHAT-02, AC-ANIM-10)', () => {
  /** UIDs no formato que o Firebase Auth gera: 28 caracteres alfanuméricos. */
  function uidSintetico(indice) {
    return `uid${String(indice).padStart(25, '0')}`;
  }

  it('garante contraste WCAG AA para 1000 UIDs sintéticos', () => {
    const reprovados = [];

    for (let indice = 0; indice < 1000; indice += 1) {
      const { fundo, texto } = corUsuario(uidSintetico(indice));
      const razao = razaoContraste(fundo, texto);

      if (razao < CONTRASTE_MINIMO) reprovados.push({ fundo, texto, razao });
    }

    expect(reprovados).toEqual([]);
  });

  it('cobre o círculo de matizes inteiro, e não uma fatia dele', () => {
    const fundos = new Set(
      Array.from({ length: 1000 }, (_, indice) => corUsuario(uidSintetico(indice)).fundo)
    );

    // Menos de 100 fundos distintos em mil sementes seria hash agrupando —
    // exatamente o defeito do resumo da v0.1.0.
    expect(fundos.size).toBeGreaterThan(100);
  });

  it('também garante contraste para as sementes legadas, que são e-mails', () => {
    const emails = Array.from({ length: 200 }, (_, indice) => `aluno${indice}@senai.br`);

    emails.forEach((email) => {
      const { fundo, texto } = corUsuario(email);
      expect(razaoContraste(fundo, texto)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    });
  });

  it('a busca de luminosidade não devolve branco puro, que apagaria o balão', () => {
    for (let indice = 0; indice < 200; indice += 1) {
      expect(corUsuario(uidSintetico(indice)).fundo).not.toBe('#ffffff');
    }
  });
});

// ---------------------------------------------------------------------------
// A busca de luminosidade.
//
// O bloco acima é uma rede de proteção: com a luminosidade fixa que o ciclo 1
// escolheu, ele já passa. Uma rede que nunca pega nada não prova nada — o que
// ela protege de verdade é o dia em que alguém mexer na saturação ou no tom
// para a task 08 e não perceber que reprovou o contraste.
//
// O que os casos abaixo exigem é o mecanismo: dado um ponto de partida que
// REPROVA, a função precisa clarear até passar — e parar no primeiro tom que
// passa, em vez de fugir para o branco e transformar mil cores em mil brancos.
// ---------------------------------------------------------------------------
describe('corDeMatiz — ajuste de luminosidade até passar', () => {
  it('clareia quando o ponto de partida reprova no contraste', () => {
    // L=0,50 com a saturação do chat dá razão ≈ 2,0 contra o texto escuro.
    const cor = corDeMatiz(210, { luminosidadeInicial: 0.5 });

    expect(razaoContraste(cor.fundo, cor.texto)).toBeGreaterThanOrEqual(CONTRASTE_MINIMO);
    expect(cor.luminosidade).toBeGreaterThan(0.5);
  });

  it('não mexe no ponto de partida quando ele já passa', () => {
    const cor = corDeMatiz(210, { luminosidadeInicial: 0.82 });

    expect(cor.luminosidade).toBe(0.82);
  });

  it('para no PRIMEIRO tom que passa, em vez de clarear até o branco', () => {
    // Clarear até o teto seria a saída preguiçosa e passaria no contraste —
    // e entregaria mil brancos. O tom escolhido precisa ser o mais saturado
    // que ainda se lê.
    const cor = corDeMatiz(210, { luminosidadeInicial: 0.5 });
    const umPassoAbaixo = { ...cor, luminosidade: cor.luminosidade - 0.02 };
    const corUmPassoAbaixo = corDeMatiz(210, {
      luminosidadeInicial: umPassoAbaixo.luminosidade,
      passos: 0,
    });

    expect(razaoContraste(corUmPassoAbaixo.fundo, cor.texto)).toBeLessThan(CONTRASTE_MINIMO);
  });

  it('preserva o matiz pedido: a busca mexe no tom, nunca na cor', () => {
    const escura = corDeMatiz(120, { luminosidadeInicial: 0.4 });
    const clara = corDeMatiz(120, { luminosidadeInicial: 0.9 });

    expect(escura.matiz).toBe(120);
    expect(clara.matiz).toBe(120);
  });

  it('desiste no teto e entrega o tom mais claro, sem laço infinito', () => {
    // Nenhuma saturação torna um matiz ilegível sobre o texto escuro, mas a
    // função não pode depender disso: sem teto, uma mudança de texto para
    // branco puro travaria o navegador da turma inteira.
    const cor = corDeMatiz(60, { luminosidadeInicial: 0.5, passos: 1 });

    expect(cor.luminosidade).toBeLessThanOrEqual(0.96);
    expect(cor.fundo).toMatch(/^#[0-9a-f]{6}$/);
  });
});
