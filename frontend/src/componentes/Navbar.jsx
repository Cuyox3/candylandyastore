import { useEffect, useState } from 'react';

/* =========================================================
   Barra de navegación.

   La usan la tienda y el panel: cambian los enlaces, no el armazón. El menú
   móvil se cierra al pulsar cualquier enlace, igual que en el sitio clásico.
   ========================================================= */
export default function Navbar({ inicio = '/', enlaces = [], activa = '', bajado = false, extra = null }) {
  const [abierto, setAbierto] = useState(false);

  /* Al navegar entre la tienda y el panel el menú tiene que quedar cerrado:
     si no, el panel abre con el desplegable móvil encima del formulario. */
  useEffect(() => setAbierto(false), [inicio]);

  return (
    <header className={'navbar' + (bajado ? ' scrolled' : '')} id="navbar">
      <div className="container nav-inner">
        <a href={inicio} className="brand" aria-label="Candylandia Store - Inicio">
          {/* El logo es lo primero que se pinta y el PNG pesa 240 KB. El WebP
              son 29 y se ve igual. El width/height son los del archivo: el CSS
              le pone la altura real, pero el navegador necesita la proporción
              para no mover la barra cuando la imagen aterrice. */}
          <picture>
            <source srcSet="/assets/logo.webp" type="image/webp" />
            <img
              src="/assets/logo.png"
              alt="Candylandia Store"
              width="540" height="452"
              fetchPriority="high" decoding="async"
            />
          </picture>
        </a>

        <nav className={'nav-links' + (abierto ? ' open' : '')} id="navLinks" aria-label="Navegación principal">
          {enlaces.map((e) => (
            <a
              key={e.href}
              href={e.href}
              className={
                (e.cta ? 'btn btn-pink nav-cta' : '') +
                (!e.cta && activa && e.href === `#${activa}` ? ' active' : '')
              }
              onClick={() => setAbierto(false)}
            >
              {e.texto}
            </a>
          ))}
          {extra}
        </nav>

        <button
          className={'burger' + (abierto ? ' open' : '')}
          id="burger"
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={abierto}
          aria-controls="navLinks"
          onClick={() => setAbierto((v) => !v)}
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  );
}
