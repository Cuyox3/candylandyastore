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
          <img src="/assets/logo.png" alt="Logo de Candylandia Store" />
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
