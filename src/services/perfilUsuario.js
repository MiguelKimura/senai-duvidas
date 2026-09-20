// Esqueleto do resolvedor de perfil e papel. Existe para que o teste do ciclo
// falhe na asserção, e não no import.

/**
 * @param {{uid: string, email?: string, displayName?: string}} _usuario
 * @returns {Promise<{perfil: object|null, papel: string|null, criado: boolean}>}
 */
export async function garantirPerfil(_usuario) {
  return { perfil: null, papel: null, criado: false };
}
