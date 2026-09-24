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
  /* Escape cierra, como en el panel clásico.

     Aquí se bloqueaba además el scroll del fondo (body.overflow = hidden).
     Se quitó: en el escritorio eso hace desaparecer la barra de scroll y la
     página de detrás salta 15 px a la derecha al abrir la ventana, algo que
     el sitio clásico no hace. Si algún día molesta el scroll del fondo en el
     móvil, hay que compensar el ancho de la barra o no habrá paridad. */
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
