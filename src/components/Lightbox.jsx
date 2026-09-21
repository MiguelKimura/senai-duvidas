// Esqueleto do ciclo 6.
//
// A primeira versão ingênua: a imagem aparece por cima da página e pronto.
// É o que resolve "quero ver maior" e o que não resolve nada do resto — sem
// papel de diálogo, sem Esc, sem prender o foco. Os testes de AC-IMG-10
// falham nas asserções, que é onde eles precisam falhar.
import React from 'react';

export default function Lightbox({ url, descricao }) {
  return (
    <div className="lightbox">
      <img src={url} alt={descricao} />
    </div>
  );
}
