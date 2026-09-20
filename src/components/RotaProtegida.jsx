// Esqueleto da rota protegida. Existe para que o teste do ciclo falhe na
// asserção, e não no import.
import React from 'react';

export default function RotaProtegida({ children }) {
  return <>{children}</>;
}
