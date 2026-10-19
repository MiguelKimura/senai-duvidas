// Security Rules do Storage — AC-IMG-06, AC-IMG-11, AC-SEC-08, AC-CHAMADO-08.
//
// A task 03 abriu o caminho `salas/{salaId}/chamados/{chamadoId}/{arquivo}`
// exigindo sessão, tipo de imagem e tamanho, e deixou dois `TODO(task-04)`:
// fechar o caminho legado `imagens/{arquivo}` e exigir que quem envia seja
// **membro da sala**. Os dois ficaram para cá porque dependiam de existir a
// tela que faz upload — apertar antes quebraria produção sem substituto.
//
// Agora a tela existe, e os casos abaixo foram INVERTIDOS: os que começavam
// com "INSEGURO" hoje exigem a recusa.
//
// O que a regra do cliente e a do servidor cobrem é diferente de propósito:
// `services/anexos.js` confere magic bytes e dá a mensagem em português, e é
// o que o aluno vê; a rule confere `contentType` e tamanho, e é o que vale
// para quem trocou o cliente por um `curl`.
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { doc, setDoc } = require('firebase/firestore');
const { ref, uploadBytes, uploadString, getDownloadURL, deleteObject } = require('firebase/storage');
const { projetoDeTeste } = require('./projetoDeTeste');

let ambiente;

const SALA = 'sala-a';
const CHAMADO = 'c1';
const CAMINHO = `salas/${SALA}/chamados/${CHAMADO}/print.png`;
const UM_MEGABYTE = 1024 * 1024;

/** Um PNG de mentira do tamanho pedido, em bytes. */
function bytesDeImagem(tamanho) {
  return new Uint8Array(tamanho);
}

beforeAll(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: projetoDeTeste(),
    firestore: {
      rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(__dirname, '../../storage.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  if (ambiente) await ambiente.cleanup();
});

beforeEach(async () => {
  await ambiente.clearStorage();
  await ambiente.clearFirestore();

  // O vínculo é a autoridade sobre quem vê o quê, e é o mesmo documento que as
  // rules do Firestore consultam do outro lado (AC-SEC-02).
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    const db = contexto.firestore();

    await setDoc(doc(db, 'salas', SALA), {
      nome: 'Turma 3B',
      curso: 'Informatica',
      anoLetivo: 2026,
      professorUid: 'uid-professora',
      ativa: true,
    });
    await setDoc(doc(db, 'salas', SALA, 'membros', 'uid-ana'), { papel: 'aluno' });
    await setDoc(doc(db, 'salas', SALA, 'membros', 'uid-professora'), { papel: 'professor' });
  });
});

/** O Storage de quem é membro da sala. */
function daAna() {
  return ambiente.authenticatedContext('uid-ana').storage();
}

/** O Storage de quem está logado mas não entrou nesta sala. */
function doEstranho() {
  return ambiente.authenticatedContext('uid-carla').storage();
}

function enviarComo(storage, caminho = CAMINHO, tamanho = 1024, tipo = 'image/png') {
  return uploadBytes(ref(storage, caminho), bytesDeImagem(tamanho), { contentType: tipo });
}

/** Põe um arquivo no Storage por fora das rules, para testar leitura e delete. */
async function semearAnexo(caminho = CAMINHO) {
  await ambiente.withSecurityRulesDisabled(async (contexto) => {
    await uploadBytes(ref(contexto.storage(), caminho), bytesDeImagem(64), {
      contentType: 'image/png',
    });
  });
}

describe('anexo da sala — quem pode enviar (AC-IMG-11, AC-SEC-02)', () => {
  it('o membro da sala envia o print do chamado', async () => {
    await assertSucceeds(enviarComo(daAna()));
  });

  it('quem está logado mas NÃO é membro da sala é recusado', async () => {
    // Era "o aluno autenticado envia uma imagem para o chamado da sala", sem
    // olhar de que sala ele é. A checagem depende de `firestore.exists()`, e é
    // ela que fecha o AC-SEC-02 no Storage: a 3B não escreve na pasta da 2A.
    await assertFails(enviarComo(doEstranho()));
  });

  it('quem nem está logado não envia nada', async () => {
    await assertFails(enviarComo(ambiente.unauthenticatedContext().storage()));
  });

  it('o professor dono da sala também envia', async () => {
    await assertSucceeds(enviarComo(ambiente.authenticatedContext('uid-professora').storage()));
  });

  it('a sala que não existe não aceita anexo nenhum', async () => {
    await assertFails(enviarComo(daAna(), 'salas/sala-fantasma/chamados/c1/print.png'));
  });
});

describe('anexo da sala — quem pode ler (AC-IMG-11)', () => {
  it('o membro da sala lê o anexo', async () => {
    await semearAnexo();

    await assertSucceeds(getDownloadURL(ref(daAna(), CAMINHO)));
  });

  it('quem não é membro NÃO lê o anexo', async () => {
    // Era "a leitura do anexo é pública, como o card espera". O card precisa
    // da URL, e quem a obtém é quem já leu o chamado — e só membro lê chamado.
    // Leitura pública entregaria o print de um aluno a quem tivesse o caminho.
    await semearAnexo();

    await assertFails(getDownloadURL(ref(doEstranho(), CAMINHO)));
  });

  it('visitante sem sessão não lê o anexo', async () => {
    await semearAnexo();

    await assertFails(getDownloadURL(ref(ambiente.unauthenticatedContext().storage(), CAMINHO)));
  });
});

describe('anexo da sala — o teto de 5 MB vale no servidor (AC-IMG-06)', () => {
  it('aceita um arquivo de 1 MB', async () => {
    await assertSucceeds(enviarComo(daAna(), CAMINHO, UM_MEGABYTE));
  });

  it('nega 6 MB mesmo com o cliente trocado por um curl', async () => {
    // O limite do cliente existe para dar a mensagem em português antes de
    // gastar a banda do laboratório. Este é o que vale.
    await assertFails(enviarComo(daAna(), CAMINHO, 6 * UM_MEGABYTE));
  });
});

describe('anexo da sala — só imagem entra (AC-SEC-08)', () => {
  it('nega um contentType que não é imagem', async () => {
    await assertFails(
      uploadString(ref(daAna(), `salas/${SALA}/chamados/${CHAMADO}/planilha.csv`), 'a;b', 'raw', {
        contentType: 'text/csv',
      })
    );
  });

  it('nega um executável disfarçado de .png pelo contentType', async () => {
    await assertFails(enviarComo(daAna(), CAMINHO, 512, 'application/x-msdownload'));
  });

  it('aceita os quatro formatos da interface', async () => {
    const formatos = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

    await Promise.all(
      formatos.map((tipo, indice) =>
        assertSucceeds(
          enviarComo(daAna(), `salas/${SALA}/chamados/${CHAMADO}/a${indice}`, 512, tipo)
        )
      )
    );
  });

  it('nega BMP, que é imagem mas não está na lista da interface', async () => {
    await assertFails(enviarComo(daAna(), CAMINHO, 512, 'image/bmp'));
  });
});

describe('anexo da sala — quem pode apagar (AC-CHAMADO-08)', () => {
  it('o membro apaga o anexo ao excluir o chamado', async () => {
    await semearAnexo();

    await assertSucceeds(deleteObject(ref(daAna(), CAMINHO)));
  });

  it('quem não é membro não apaga o anexo de ninguém', async () => {
    await semearAnexo();

    await assertFails(deleteObject(ref(doEstranho(), CAMINHO)));
  });
});

describe('imagens/ — o caminho legado, agora fechado para escrita', () => {
  it('NÃO aceita mais upload, nem de quem está logado', async () => {
    // Era "um usuário autenticado envia uma imagem para imagens/". O caminho
    // não tem sala nem uid: nenhuma rule consegue dizer quem pode ler o que
    // está ali, e dois `print.png` se sobrescrevem.
    await assertFails(uploadString(ref(daAna(), 'imagens/print.png'), 'conteudo'));
  });

  it('NÃO aceita upload de quem nem está logado', async () => {
    await assertFails(
      uploadString(ref(ambiente.unauthenticatedContext().storage(), 'imagens/anonimo.png'), 'x')
    );
  });

  it('continua legível: o chamado da v0.1.0 que apontar para lá ainda exibe', async () => {
    // Fechar a leitura apagaria a imagem de chamados antigos da tela. O que
    // está lá continua onde está, e nada novo entra (AC-IMG-13).
    await semearAnexo('imagens/antigo.png');

    await assertSucceeds(
      getDownloadURL(ref(ambiente.unauthenticatedContext().storage(), 'imagens/antigo.png'))
    );
  });
});

describe('caminhos fora do mapa nascem fechados', () => {
  it('nega escrita em qualquer outro caminho', async () => {
    await assertFails(uploadString(ref(daAna(), 'outro/lugar.png'), 'conteudo'));
  });

  it('nega leitura em qualquer outro caminho', async () => {
    await assertFails(getDownloadURL(ref(daAna(), 'outro/lugar.png')));
  });
});
