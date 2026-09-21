// Portão de todas as rotas autenticadas — AC-AUTH-09.
//
// Existem quatro estados, e o desenho da v0.2.0 só enxergava dois. O terceiro
// ("autenticado, papel ainda desconhecido") é o que produzia a piscada da tela
// de login; o quarto ("autenticado, não deu para saber o papel") é o que
// impede que uma queda de rede vire permissão presumida.
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Para onde cada papel é mandado quando entra na rota do outro. */
const ROTA_INICIAL = {
  aluno: '/aluno',
  professor: '/professor',
};

/**
 * Rota que exige autenticação e, opcionalmente, um papel.
 *
 * @param {object} props
 * @param {'aluno'|'professor'} [props.papel] papel exigido; omitido, basta estar autenticado.
 * @param {React.ReactNode} props.children tela protegida.
 */
export default function RotaProtegida({ papel, children }) {
  const { usuario, papel: papelDoUsuario, carregando, erro, tentarNovamente } = useAuth();

  // 1. Ainda resolvendo. Nem tela protegida, nem tela de login.
  if (carregando) {
    return (
      <p className="rota-protegida-carregando" role="status">
        Carregando...
      </p>
    );
  }

  // 2. Sem sessão. `replace` para o "voltar" do navegador não trazer a pessoa
  //    de volta à URL protegida depois do logout (AC-AUTH-08).
  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  // 3. Autenticado, mas o Firestore não respondeu: sem papel não se abre nada.
  if (!papelDoUsuario) {
    return (
      <div className="rota-protegida-erro">
        <p role="alert">{erro}</p>
        <button type="button" onClick={tentarNovamente}>
          Tentar novamente
        </button>
      </div>
    );
  }

  // 4. Papel resolvido e diferente do exigido: cada um na sua tela.
  if (papel && papelDoUsuario !== papel) {
    return <Navigate to={ROTA_INICIAL[papelDoUsuario] || '/'} replace />;
  }

  return <>{children}</>;
}
