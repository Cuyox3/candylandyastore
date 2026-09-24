/* El avisito flotante del panel. Se monta siempre para que la transición de
   opacidad tenga de dónde salir; lo que cambia es la clase .show. */
export default function Toast({ aviso }) {
  return (
    <div
      className={'toast' + (aviso ? ' show' : '') + (aviso && aviso.error ? ' error' : '')}
      role="status"
      aria-live="polite"
    >
      {aviso ? aviso.texto : ''}
    </div>
  );
}
