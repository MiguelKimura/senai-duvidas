// Fake do `firebase/storage`. Hoje só `uploadImage` em `src/firebase.js` o usa,
// e a interface ainda nem oferece upload de arquivo (AC-IMG-02 é da task 04).
// O fake guarda o que foi enviado para que o teste possa verificar o caminho.

let arquivos = new Map();

export function getStorage() {
  return { __tipo: 'storage-fake' };
}

export function ref(_storage, caminho) {
  return { __tipo: 'storage-ref', __caminho: caminho };
}

export async function uploadBytes(referencia, arquivo) {
  arquivos.set(referencia.__caminho, arquivo);

  return { ref: referencia };
}

export async function getDownloadURL(referencia) {
  if (!arquivos.has(referencia.__caminho)) {
    const erro = new Error('Objeto não encontrado no Storage.');
    erro.code = 'storage/object-not-found';
    throw erro;
  }

  return `https://fake.storage/${referencia.__caminho}`;
}

export function __resetarStorage() {
  arquivos = new Map();
}

export function __arquivosEnviados() {
  return [...arquivos.keys()];
}
