import React from 'react';
import ReactDOM from 'react-dom/client';  // Alterado para 'react-dom/client'
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Agora cria a raiz usando o 'createRoot' importado de 'react-dom/client'
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Se você deseja medir a performance do seu app, passe uma função
// para registrar os resultados (por exemplo: reportWebVitals(console.log))
// ou envie para um endpoint de análise. Saiba mais: https://bit.ly/CRA-vitals
reportWebVitals();
