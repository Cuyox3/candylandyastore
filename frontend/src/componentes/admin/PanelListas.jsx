import { useState } from 'react';

/* =========================================================
   Categorías y etiquetas, las dos listas que alimentan el formulario de
   producto.

   Van en el mismo archivo porque son el mismo mueble: una lista con su botón
   de añadir, cada fila editable en el sitio y un botón de quitar. Lo único
   que cambia son los campos, y eso se resuelve con dos componentes pequeños
   encima de una `Fila` común.

   Todo lo que toca la red se lo pide al padre (Admin.jsx) y DEJA que el error
   suba: aquí sólo se pinta. Así el aviso de «esa categoría tiene productos»
   sale del servidor y no de una regla repetida en el navegador que algún día
   dejaría de coincidir.
   ========================================================= */

function Fila({ children, onGuardar, onQuitar, puedeGuardar, etiquetaQuitar }) {
  const [ocupado, setOcupado] = useState('');

  async function lanzar(que, accion) {
    setOcupado(que);
    try {
      await accion();
    } finally {
      setOcupado('');
    }
  }

  return (
    <li className="lista-fila">
      <div className="lista-campos">{children}</div>
      <div className="lista-acciones">
        <button
          type="button" className="icono-btn" title="Guardar los cambios"
          aria-label="Guardar los cambios"
          disabled={!puedeGuardar || Boolean(ocupado)}
          onClick={() => lanzar('guardar', onGuardar)}
        >
          {ocupado === 'guardar' ? '…' : '💾'}
        </button>
        <button
          type="button" className="icono-btn peligro" title={etiquetaQuitar}
          aria-label={etiquetaQuitar}
          disabled={Boolean(ocupado)}
          onClick={() => lanzar('quitar', onQuitar)}
        >
          {ocupado === 'quitar' ? '…' : '🗑️'}
        </button>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------
   Categorías
   --------------------------------------------------------- */
function FilaCategoria({ categoria, cuantos, onGuardar, onQuitar }) {
  const [label, setLabel] = useState(categoria.label);
  const [orden, setOrden] = useState(categoria.orden);
  const [activa, setActiva] = useState(categoria.activa);

  const cambiado =
    label !== categoria.label || orden !== categoria.orden || activa !== categoria.activa;

  return (
    <Fila
      puedeGuardar={cambiado && label.trim().length > 0}
      etiquetaQuitar={`Quitar la categoría ${categoria.label}`}
      onGuardar={() => onGuardar(categoria, { label: label.trim(), orden: Number(orden), activa })}
      onQuitar={() => onQuitar(categoria, cuantos)}
    >
      <label className="sr-only" htmlFor={`cat-${categoria.slug}`}>
        Nombre de la categoría {categoria.label}
      </label>
      <input
        id={`cat-${categoria.slug}`} type="text" value={label} maxLength={60}
        onChange={(e) => setLabel(e.target.value)}
      />

      {/* El slug no se edita y se enseña apagado a propósito: es lo que cada
          producto guarda en su campo `cat`, así que cambiarlo los dejaría
          apuntando a una categoría que ya no existe. */}
      <code className="lista-slug" title="Identificador interno; no se puede cambiar">
        {categoria.slug}
      </code>

      <label className="sr-only" htmlFor={`cat-orden-${categoria.slug}`}>Orden</label>
      <input
        id={`cat-orden-${categoria.slug}`} type="number" className="lista-orden"
        value={orden} onChange={(e) => setOrden(e.target.value)} title="Orden en los filtros"
      />

      <label className="lista-check">
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        Visible
      </label>

      <span className="lista-cuenta" title="Productos en esta categoría">
        {cuantos} 🍬
      </span>
    </Fila>
  );
}

export function PanelCategorias({ categorias, productos, onCrear, onEditar, onQuitar }) {
  const [abierto, setAbierto] = useState(false);
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [guardando, setGuardando] = useState(false);

  /* El identificador se propone a partir del nombre, como hace el backend con
     los productos: quien administra escribe «Dulces de Japón» y no tiene que
     saber que por dentro se llama «dulces-de-japon». Se deja editable por si
     quiere otro. */
  function alEscribirNombre(valor) {
    const tocado = slug && slug !== sugerir(label);
    setLabel(valor);
    if (!tocado) setSlug(sugerir(valor));
  }

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onCrear({ slug: slug.trim(), label: label.trim(), orden: categorias.length, activa: true });
      setSlug(''); setLabel(''); setAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="lista-cabecera">
        <h3>🗂️ Categorías</h3>
        <button type="button" className="btn btn-purple btn-sm"
                onClick={() => setAbierto((v) => !v)}>
          {abierto ? 'Cancelar' : '+ Nueva categoría'}
        </button>
      </div>

      <p className="admin-ayuda">
        Son los filtros de la tienda y el desplegable del formulario. Quitar una exige
        que esté vacía; para esconderla sin borrarla, desmarca «Visible».
      </p>

      {abierto ? (
        <form className="lista-nueva" onSubmit={crear}>
          <div className="field">
            <label htmlFor="catNombre">Nombre *</label>
            <input id="catNombre" type="text" value={label} maxLength={60} required
                   placeholder="🇯🇵 Japón"
                   onChange={(e) => alEscribirNombre(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="catSlug">Identificador *</label>
            {/* El guion va escapado: los navegadores compilan `pattern` con la
                bandera `v` de las expresiones regulares, y ahí un `-` suelto
                dentro de los corchetes es un error de sintaxis. Con el error,
                el navegador descarta el patrón entero y deja pasar cualquier
                cosa —se veía en la consola, no en pantalla—. */}
            <input id="catSlug" type="text" value={slug} maxLength={40} required
                   pattern="[a-z0-9\-]+" placeholder="japon"
                   title="Sólo minúsculas, números y guiones"
                   onChange={(e) => setSlug(e.target.value)} />
            <small className="form-note">Sólo minúsculas, números y guiones. No se podrá cambiar.</small>
          </div>
          <button type="submit" className="btn btn-pink btn-block" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear categoría'}
          </button>
        </form>
      ) : null}

      {categorias.length === 0 ? (
        <p className="admin-empty">Todavía no hay categorías.</p>
      ) : (
        <ul className="lista-editable">
          {categorias.map((c) => (
            <FilaCategoria
              key={c.slug}
              categoria={c}
              cuantos={productos.filter((p) => p.cat === c.slug).length}
              onGuardar={onEditar}
              onQuitar={onQuitar}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/* Igual que `slugificar` del backend, pero sólo para proponer: el que manda
   es el que viaja en la petición, y el servidor lo valida otra vez. */
function sugerir(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // fuera tildes
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

/* ---------------------------------------------------------
   Etiquetas
   --------------------------------------------------------- */
function FilaEtiqueta({ etiqueta, colores, cuantos, onGuardar, onQuitar }) {
  const [texto, setTexto] = useState(etiqueta.etiqueta);
  const [tipo, setTipo] = useState(etiqueta.tipo);
  const [orden, setOrden] = useState(etiqueta.orden);
  const [activa, setActiva] = useState(etiqueta.activa);

  const cambiado =
    texto !== etiqueta.etiqueta || tipo !== etiqueta.tipo
    || orden !== etiqueta.orden || activa !== etiqueta.activa;

  return (
    <Fila
      puedeGuardar={cambiado && texto.trim().length > 0}
      etiquetaQuitar={`Quitar la etiqueta ${etiqueta.etiqueta}`}
      onGuardar={() => onGuardar(etiqueta, { etiqueta: texto.trim(), tipo, orden: Number(orden), activa })}
      onQuitar={() => onQuitar(etiqueta, cuantos)}
    >
      {/* La misma pastilla que la tarjeta de la tienda, con las mismas clases:
          así se ve el color de verdad y no una aproximación. */}
      <span className={'tag ' + (tipo || '')}>{texto || '—'}</span>

      <label className="sr-only" htmlFor={`eti-${etiqueta.id}`}>Texto de la etiqueta</label>
      <input id={`eti-${etiqueta.id}`} type="text" value={texto} maxLength={40}
             onChange={(e) => setTexto(e.target.value)} />

      <label className="sr-only" htmlFor={`eti-color-${etiqueta.id}`}>Color</label>
      <select id={`eti-color-${etiqueta.id}`} value={tipo}
              onChange={(e) => setTipo(e.target.value)}>
        {colores.map((c) => <option key={c.tipo} value={c.tipo}>{c.nombre}</option>)}
      </select>

      <label className="sr-only" htmlFor={`eti-orden-${etiqueta.id}`}>Orden</label>
      <input id={`eti-orden-${etiqueta.id}`} type="number" className="lista-orden"
             value={orden} onChange={(e) => setOrden(e.target.value)} title="Orden en el desplegable" />

      <label className="lista-check">
        <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
        Visible
      </label>

      <span className="lista-cuenta" title="Productos con esta etiqueta">{cuantos} 🍬</span>
    </Fila>
  );
}

export function PanelEtiquetas({ etiquetas, colores, productos, onCrear, onEditar, onQuitar }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [tipo, setTipo] = useState('');
  const [guardando, setGuardando] = useState(false);

  /* La opción «Sin etiqueta» viene del API con id 0 y no es una fila de la
     tabla: es «ninguna». No se lista porque no hay nada que editar en ella. */
  const reales = etiquetas.filter((e) => e.id !== 0);

  async function crear(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await onCrear({ etiqueta: texto.trim(), tipo, orden: reales.length, activa: true });
      setTexto(''); setTipo(''); setAbierto(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section className="admin-panel">
      <div className="lista-cabecera">
        <h3>🏷️ Etiquetas</h3>
        <button type="button" className="btn btn-purple btn-sm"
                onClick={() => setAbierto((v) => !v)}>
          {abierto ? 'Cancelar' : '+ Nueva etiqueta'}
        </button>
      </div>

      <p className="admin-ayuda">
        La pastilla de la esquina de la tarjeta. El color sale de una lista cerrada
        porque son los que la tienda sabe pintar.
      </p>

      {abierto ? (
        <form className="lista-nueva" onSubmit={crear}>
          <div className="field">
            <label htmlFor="etiNombre">Texto *</label>
            <input id="etiNombre" type="text" value={texto} maxLength={40} required
                   placeholder="Agotado"
                   onChange={(e) => setTexto(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="etiColor">Color</label>
            <select id="etiColor" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {colores.map((c) => <option key={c.tipo} value={c.tipo}>{c.nombre}</option>)}
            </select>
          </div>
          <p className="lista-muestra">
            Se verá así: <span className={'tag ' + (tipo || '')}>{texto || 'Agotado'}</span>
          </p>
          <button type="submit" className="btn btn-pink btn-block" disabled={guardando}>
            {guardando ? 'Creando…' : 'Crear etiqueta'}
          </button>
        </form>
      ) : null}

      {reales.length === 0 ? (
        <p className="admin-empty">No hay etiquetas. Los productos saldrán sin pastilla.</p>
      ) : (
        <ul className="lista-editable">
          {reales.map((e) => (
            <FilaEtiqueta
              key={e.id}
              etiqueta={e}
              colores={colores}
              cuantos={productos.filter((p) => p.etiqueta === e.etiqueta && p.tipo === e.tipo).length}
              onGuardar={onEditar}
              onQuitar={onQuitar}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
