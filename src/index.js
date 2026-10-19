import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { garantirHttps } from './utils/httpsObrigatorio';

// HTTPS antes de qualquer outra coisa (AC-SEC-06). Se a página foi aberta em
// HTTP, a navegação para a versão segura já começou e montar a aplicação por
// cima só faria o usuário ver um lampejo da tela de login antes de a troca
// acontecer.
if (!garantirHttps(window.location)) {
  const root = ReactDOM.createRoot(document.getElementById('root'));

  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Métricas de performance. Para inspecioná-las, passe uma função:
  // reportWebVitals(console.log). Saiba mais: https://bit.ly/CRA-vitals
  reportWebVitals();
}
