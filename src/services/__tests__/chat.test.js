// O serviço da conversa da sala — AC-CHAT-08, AC-CHAT-09, AC-CHAT-10.
//
// Duas coisas moram aqui porque não podem morar num componente:
//
// **O limite de 500 caracteres (AC-CHAT-09).** A rule já o exige do lado do
// servidor. Repeti-lo aqui não é redundância: é o que transforma uma recusa
// crua do Firestore numa frase em português antes de a escrita sair.
//
// **O `!clear` (AC-CHAT-08).** Hoje qualquer aluno apaga a conversa da turma, e
// o laço que apaga é `forEach(async doc => await deleteDoc(...))` — que dispara
// N deleções e **não espera nenhuma**. Se metade falhar, ninguém fica sabendo:
// o `forEach` descarta as promessas, e o `await` de dentro não sai do callback.
// Os casos abaixo exigem papel de professor, lote com espera e relato de falha.
import {
  __documentosDe,
  __recusarEscritaEm,
  __resetarFirestore,
  __semearColecao,
  collection,
  getDocs,
  getFirestore,
} from 'firebase/firestore';
import {
  ErroDeChat,
  TAMANHO_MAXIMO_DA_MENSAGEM,
  ehComandoLimpar,
  enviarMensagem,
  limparConversa,
  validarTexto,
} from '../chat';
import { PAPEL_DE_ALUNO, PAPEL_DE_PROFESSOR } from '../salas';

const db = getFirestore();
const CHAT_DA_SALA = 'salas/sala-a/chat';

const ANA = {
  uid: 'uid-ana',
  nome: 'Ana Souza',
  email: 'ana@senai.br',
  papel: PAPEL_DE_ALUNO,
};

const CARLOS = {
  uid: 'uid-carlos',
  nome: 'Carlos Lima',
  email: 'carlos@senai.br',
  papel: PAPEL_DE_PROFESSOR,
};

/** Semeia `quantidade` mensagens na conversa da sala. */
function semearConversa(quantidade) {
  __semearColecao(
    CHAT_DA_SALA,
    Array.from({ length: quantidade }, (_, indice) => ({
      id: `m${indice}`,
      autorUid: indice % 2 === 0 ? ANA.uid : CARLOS.uid,
      autorNome: 'Alguém',
      texto: `Mensagem ${indice}`,
      horario: new Date(Date.UTC(2026, 2, 10, 12, 0, indice)),
    }))
  );
}

beforeEach(() => {
  __resetarFirestore();
});

describe('validarTexto — o limite de 500 caracteres (AC-CHAT-09)', () => {
  it('devolve o texto sem os espaços das pontas', () => {
    expect(validarTexto('  Bom dia, turma  ')).toBe('Bom dia, turma');
  });

  it('recusa texto vazio', () => {
    expect(() => validarTexto('   ')).toThrow(ErroDeChat);
  });

  it('aceita exatamente 500 caracteres', () => {
    const limite = 'a'.repeat(TAMANHO_MAXIMO_DA_MENSAGEM);

    expect(validarTexto(limite)).toBe(limite);
  });

  it('recusa 501 caracteres, com a mensagem que a tela exibe', () => {
    const excedente = 'a'.repeat(TAMANHO_MAXIMO_DA_MENSAGEM + 1);

    expect(() => validarTexto(excedente)).toThrow(/500/);
  });

  it('conta o texto já aparado, não o que o usuário digitou com espaços', () => {
    const comEspacos = `   ${'a'.repeat(TAMANHO_MAXIMO_DA_MENSAGEM)}   `;

    expect(validarTexto(comEspacos)).toHaveLength(TAMANHO_MAXIMO_DA_MENSAGEM);
  });

  it('recusa o que não é string, em vez de gravar "undefined"', () => {
    expect(() => validarTexto(undefined)).toThrow(ErroDeChat);
    expect(() => validarTexto(42)).toThrow(ErroDeChat);
  });
});

describe('enviarMensagem — o que vai para o banco', () => {
  it('grava autorUid, autorNome e autorPapel (campos desta versão)', async () => {
    await enviarMensagem('sala-a', CARLOS, 'Bom dia');

    const [mensagem] = __documentosDe(CHAT_DA_SALA);
    expect(mensagem.autorUid).toBe(CARLOS.uid);
    expect(mensagem.autorNome).toBe('Carlos Lima');
    expect(mensagem.autorPapel).toBe(PAPEL_DE_PROFESSOR);
  });

  it('continua gravando nome e email, para o cliente da v0.4.0 (compat. futura)', async () => {
    await enviarMensagem('sala-a', ANA, 'Bom dia');

    const [mensagem] = __documentosDe(CHAT_DA_SALA);
    expect(mensagem.nome).toBe('Ana Souza');
    expect(mensagem.email).toBe('ana@senai.br');
  });

  it('grava editadaEm como null, para o campo existir desde o primeiro dia', async () => {
    await enviarMensagem('sala-a', ANA, 'Bom dia');

    expect(__documentosDe(CHAT_DA_SALA)[0].editadaEm).toBeNull();
  });

  it('valida antes de escrever: mensagem grande não chega ao banco', async () => {
    await expect(
      enviarMensagem('sala-a', ANA, 'a'.repeat(TAMANHO_MAXIMO_DA_MENSAGEM + 1))
    ).rejects.toThrow(ErroDeChat);

    expect(__documentosDe(CHAT_DA_SALA)).toHaveLength(0);
  });

  it('grava o texto aparado, não o que tinha espaços nas pontas', async () => {
    await enviarMensagem('sala-a', ANA, '  Bom dia  ');

    expect(__documentosDe(CHAT_DA_SALA)[0].texto).toBe('Bom dia');
  });
});

describe('limparConversa — autorização (AC-CHAT-08)', () => {
  it('recusa o !clear de um ALUNO antes de tocar no banco', async () => {
    semearConversa(3);

    await expect(limparConversa('sala-a', ANA)).rejects.toThrow(ErroDeChat);
    expect(__documentosDe(CHAT_DA_SALA)).toHaveLength(3);
  });

  it('a recusa explica que o comando é do professor', async () => {
    semearConversa(1);

    await expect(limparConversa('sala-a', ANA)).rejects.toThrow(/professor/i);
  });

  it('o professor da sala limpa a conversa', async () => {
    semearConversa(3);

    await limparConversa('sala-a', CARLOS);

    expect(__documentosDe(CHAT_DA_SALA)).toHaveLength(0);
  });

  it('sem papel nenhum, recusa — ausência de papel não é permissão', async () => {
    semearConversa(1);

    await expect(limparConversa('sala-a', { uid: 'uid-x' })).rejects.toThrow(ErroDeChat);
  });
});

describe('limparConversa — o lote e a falha parcial', () => {
  it('espera a deleção terminar antes de resolver', async () => {
    semearConversa(5);

    await limparConversa('sala-a', CARLOS);

    // Sem espera, esta leitura corre ANTES das deleções e ainda vê as cinco.
    const restantes = await getDocs(collection(db, CHAT_DA_SALA));
    expect(restantes.size).toBe(0);
  });

  it('relata quantas mensagens apagou', async () => {
    semearConversa(7);

    await expect(limparConversa('sala-a', CARLOS)).resolves.toMatchObject({ apagadas: 7 });
  });

  it('divide em lotes de no máximo 500, que é o teto do writeBatch', async () => {
    semearConversa(3);

    const resultado = await limparConversa('sala-a', CARLOS);

    expect(resultado.lotes).toBe(1);
  });

  it('propaga a falha em vez de engolir: o !clear que não apagou precisa doer', async () => {
    semearConversa(2);
    __recusarEscritaEm(`${CHAT_DA_SALA}/m0`);

    await expect(limparConversa('sala-a', CARLOS)).rejects.toThrow();
  });

  it('conversa vazia não é erro: apaga zero e resolve', async () => {
    await expect(limparConversa('sala-a', CARLOS)).resolves.toMatchObject({
      apagadas: 0,
      lotes: 0,
    });
  });
});

describe('ehComandoLimpar', () => {
  it('reconhece !clear em qualquer caixa e com espaços', () => {
    expect(ehComandoLimpar('!clear')).toBe(true);
    expect(ehComandoLimpar('  !CLEAR  ')).toBe(true);
  });

  it('não confunde com uma mensagem que apenas cita o comando', () => {
    expect(ehComandoLimpar('use o !clear para limpar')).toBe(false);
    expect(ehComandoLimpar('')).toBe(false);
  });
});
