/* Barra promocional de arriba. Los mensajes se repiten dos veces porque la
   animación de styles.css desplaza la pista un 50%: con una sola tanda se
   vería el hueco al dar la vuelta. */
export default function TopBar({ mensajes }) {
  return (
    <div className="topbar">
      <div className="topbar-track">
        {mensajes.map((m, i) => <span key={`a-${i}`}>{m}</span>)}
        {mensajes.map((m, i) => <span key={`b-${i}`}>{m}</span>)}
      </div>
    </div>
  );
}
