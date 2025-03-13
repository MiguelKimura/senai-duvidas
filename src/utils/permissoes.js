import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export const verificarPermissao = async (email) => {
  try {
    console.log("Verificando permissão para o e-mail:", email);

    // Verifica se o e-mail não é vazio ou nulo
    if (!email) {
      console.error("Email inválido fornecido");
      return false;
    }

    // Acesse diretamente o documento usando o e-mail como ID
    const docRef = doc(db, "autorizados", email.trim().toLowerCase());
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const docData = docSnap.data();
      console.log("Documento encontrado:", docData);

      // Verifica se o tipo é exatamente "professor" (evita erro de maiúsculas/minúsculas)
      if (docData.Tipo && docData.Tipo.toLowerCase() === "professor") {
        console.log("Usuário autorizado como professor");
        return true;
      } else {
        console.log("Usuário não autorizado, tipo encontrado:", docData.Tipo);
        return false;
      }
    } else {
      console.log("Documento não encontrado para o e-mail:", email);
      return false;
    }
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);
    return false;
  }
};
