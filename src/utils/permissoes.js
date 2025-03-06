import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Função para verificar se o e-mail está na coleção de autorizados com o tipo "professor"
export const verificarPermissao = async (email) => {
  try {
    // Para depuração, o debugger pode ser útil, mas certifique-se de que a DevTools está aberta.
    debugger;

    console.log("Verificando permissão para o e-mail:", email);  // Exibe o email que está sendo verificado

    // Referência ao documento com o e-mail na coleção "autorizados"
    const emailRef = doc(db, "autorizados", email);

    // Pega o documento do e-mail
    const docSnap = await getDoc(emailRef);

    // Verifica se o documento existe e se o campo Tipo é igual a "professor"
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log("Documento encontrado:", data); // Exibe o conteúdo do documento

      // Verifica o tipo
      if (data.Tipo === "professor") {
        console.log("Usuário autorizado como professor");
          return true;  // O e-mail é autorizado e é um professor
        } else {
        console.log("Usuário não autorizado, tipo encontrado:", data.Tipo);
        return false; // O tipo não é "professor"
      }
    } else {
      console.log("Documento não encontrado para o e-mail:", email); // Exibe quando o documento não existe
      return false; // O e-mail não está autorizado
    }
  } catch (error) {
    console.error("Erro ao verificar permissão:", error);  // Exibe o erro no console
    return false; // Caso haja erro, a permissão será negada
  }
};
