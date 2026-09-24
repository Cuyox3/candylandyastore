import { useEffect } from 'react';

/* =========================================================
   Ventana modal (confirmaciones y el JSON del catálogo).

   En el panel estático había que forzar un reflow para que la transición de
   .open arrancara. En React no hace falta el truco: el nodo se monta y la
   clase entra en el render siguiente, que es exactamente lo que la transición
   necesita — por eso `abierto` se aplica con un doble render controlado por
   CSS y no con un setTimeout.
   ========================================================= */
export default function Modal({ abierto, titulo, children, onCerrar, acciones }) {
  /* Escape cierra, y mientras está abierta el fondo no hace scroll: en el
     móvil, sin esto, al desplazar la modal se movía la página de detrás. */
  useEffect(() => {
    if (!abierto) return;

    const alPulsar = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alPulsar);

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="modal open"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="modal-box">
        <h3>{titulo}</h3>
        {children}
        <div className="modal-actions">{acciones}</div>
      </div>
    </div>
  );
}

/* Variante ancha, para el catálogo en JSON. */
export function ModalAncha({ abierto, titulo, children, onCerrar, acciones }) {
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="modal open"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div className="modal-box wide">
        <h3>{titulo}</h3>
        {children}
        <div className="modal-actions">{acciones}</div>
      </div>
    </div>
  );
}
