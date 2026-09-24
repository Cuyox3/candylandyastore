import { useEffect, useState } from 'react';

/* =========================================================
   La tarjeta de producto.

   Es EXACTAMENTE el mismo marcado que generaba cardHTML() en el sitio
   clásico: mismas clases, mismo orden de nodos y las dos variables de color
   (--c1 y --c2) en el style de .card-media. Gracias a eso styles.css no ha
   tenido que cambiar ni una línea.

   La usan la tienda, la vista previa del panel y el listado del panel, así
   que cualquier retoque se ve en los tres sitios a la vez — que es justo lo
   que se quería: que el panel enseñe la tarjeta REAL, no una aproximación.
   ========================================================= */
export default function TarjetaProducto({ producto, onPedir, botonInerte = false }) {
  const p = producto;

  /* Si el archivo de la foto no carga, la tarjeta vuelve al emoji en vez de
     quedarse con el icono de imagen rota. Pasa cuando se borra la foto del
     disco pero el producto sigue apuntando a ella. */
  const [fotoRota, setFotoRota] = useState(false);
  useEffect(() => setFotoRota(false), [p.img]);

  const hayFoto = Boolean(p.img) && !fotoRota;

  return (
    <article className="card" data-cat={p.cat}>
      <div className="card-media" style={{ '--c1': p.c1, '--c2': p.c2 }}>
        {p.etiqueta ? <span className={'tag ' + (p.tipo || '')}>{p.etiqueta}</span> : null}

        {hayFoto
          ? <img className="card-img" src={p.img} alt={p.nombre} loading="lazy"
                 onError={() => setFotoRota(true)} />
          : <span className="emoji">{p.emoji}</span>}
      </div>

      <div className="card-body">
        <span className="card-origin">{p.origen}</span>
        <h3>{p.nombre}</h3>
        <p>{p.desc}</p>
        <div className="card-foot">
          {/* El '$' va PEGADO al número en una sola cadena a propósito: como
              dos hijos sueltos, React crea dos nodos de texto y el navegador
              mide cada uno por su lado. Se nota: el precio queda 1/64 de píxel
              más ancho que en el sitio clásico y los bordes de las cifras se
              dibujan distinto. */}
          <span className="card-price">{'$' + formatearPrecio(p.precio)}</span>
          <button
            className="card-btn"
            type="button"
            tabIndex={botonInerte ? -1 : 0}
            onClick={botonInerte ? undefined : () => onPedir && onPedir(p)}
          >
            Lo quiero
          </button>
        </div>
      </div>
    </article>
  );
}

/* El backend guarda el precio con dos decimales (Numeric). Los enteros se
   enseñan sin ',00' porque así se veía en el catálogo de siempre, y los que
   llevan céntimos se muestran completos. */
export function formatearPrecio(precio) {
  const n = Number(precio) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
