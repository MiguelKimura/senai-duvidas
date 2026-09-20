// Testes das Security Rules do Storage.
//
// Mesmo espírito do arquivo de Firestore: documentam o estado atual, que é
// aberto. A task 04 implementa o upload de verdade e aperta estas regras.
const fs = require('fs');
const path = require('path');
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require('@firebase/rules-unit-testing');
const { ref, uploadString, getDownloadURL } = require('firebase/storage');
const { projetoDeTeste } = require('./projetoDeTeste');

let ambiente;

beforeAll(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: projetoDeTeste(),
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
});

describe('storage — estado atual', () => {
  it('um usuário autenticado envia uma imagem para imagens/', async () => {
    const storage = ambiente.authenticatedContext('uid-ana').storage();

    await assertSucceeds(uploadString(ref(storage, 'imagens/print.png'), 'conteudo'));
  });

  // TODO(task-04): endurecer. Sem request.auth, sem limite de tamanho e sem
  // restrição de contentType.
  it('INSEGURO: quem nem está logado envia arquivo para imagens/', async () => {
    const storage = ambiente.unauthenticatedContext().storage();

    await assertSucceeds(uploadString(ref(storage, 'imagens/anonimo.png'), 'conteudo'));
  });

  // TODO(task-04): endurecer. O caminho não tem uid nem sala.
  it('INSEGURO: um upload sobrescreve o arquivo de outra pessoa pelo nome', async () => {
    const daAna = ambiente.authenticatedContext('uid-ana').storage();
    const doBruno = ambiente.authenticatedContext('uid-bruno').storage();

    await assertSucceeds(uploadString(ref(daAna, 'imagens/print.png'), 'da ana'));
    await assertSucceeds(uploadString(ref(doBruno, 'imagens/print.png'), 'do bruno'));
  });

  it('a leitura do anexo é pública, como a interface espera', async () => {
    const storage = ambiente.authenticatedContext('uid-ana').storage();
    await uploadString(ref(storage, 'imagens/print.png'), 'conteudo');

    const visitante = ambiente.unauthenticatedContext().storage();
    await assertSucceeds(getDownloadURL(ref(visitante, 'imagens/print.png')));
  });
});

describe('caminhos fora de imagens/ nascem fechados', () => {
  it('nega escrita em qualquer outro caminho', async () => {
    const storage = ambiente.authenticatedContext('uid-ana').storage();

    await assertFails(uploadString(ref(storage, 'outro/lugar.png'), 'conteudo'));
  });
});
