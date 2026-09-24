import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, sesion, EVENTO_SIN_SESION } from '../api';
import TopBar from '../componentes/TopBar';
import Navbar from '../componentes/Navbar';
import { FooterBottom } from '../componentes/Footer';
import Modal, { ModalAncha } from '../componentes/Modal';
import Toast from '../componentes/Toast';
import Acceso from '../componentes/admin/Acceso';
import FormularioProducto from '../componentes/admin/FormularioProducto';
import ListaProductos from '../componentes/admin/ListaProductos';
import { useToast } from '../hooks/useToast';
import { useTitulo } from '../hooks/useTitulo';

/* La cinta rosa de arriba, con los mismos tres avisos de admin.html. El
   tercero cambió de texto —antes decía «en este navegador»— porque ahora el
   catálogo vive en el servidor y lo que se guarda aquí lo ve todo el mundo. */
const MENSAJES = [
  '🍬 Panel de administración de Candylandia Store',
  '✨ Agrega, modifica y quita productos · con foto o con emoji',
  '💾 Los cambios se guardan en el servidor'
];

/* Los enlaces del panel apuntan a la tienda, igual que en admin.html. */
const ENLACES = [
  { href: '/',            texto: 'Ver tienda' },
  { href: '/#productos',  texto: 'Productos' },
  { href: '/#contacto',   texto: 'Contacto' }
];

/* =========================================================
   Panel de administración.

   Es el mismo panel del sitio clásico, con una diferencia de fondo: el
   catálogo ya no vive en localStorage sino en Postgres, así que lo que se
   guarda aquí lo ve todo el mundo, no solo este navegador. Por eso los dos
   avisos de arriba cambiaron de texto: el de «exporta y pega en productos.js»
   ya no tiene sentido.
   ========================================================= */
export default function Admin() {
  useTitulo('Panel de administración | Candylandia Store');

  /* --- sesión --- */
  const [comprobando, setComprobando] = useState(true);
  const [dentro, setDentro]           = useState(false);

  /* --- datos --- */
  const [categorias, setCategorias] = useState([]);
  const [etiquetas, setEtiquetas]   = useState([]);
  const [productos, setProductos]   = useState([]);
  const [cargando, setCargando]     = useState(false);

  /* --- interfaz --- */
  const [buscar, setBuscar]     = useState('');
  const [editando, setEditando] = useState(null);
  const [bajado, setBajado]     = useState(false);
  const { aviso, mostrar }      = useToast();

  /* --- ventanas --- */
  const [confirmar, setConfirmar] = useState(null);  // { titulo, texto, textoOk, alAceptar }
  const [json, setJson]           = useState(null);  // { modo, texto }
  const areaJson = useRef(null);

  /* ---------------------------------------------------------
     Arranque: si hay un token guardado, se comprueba contra el servidor.
     Un token caducado se descarta aquí y no en la primera acción, que sería
     un susto innecesario en mitad de una edición.
     --------------------------------------------------------- */
  useEffect(() => {
    let vivo = true;

    (async () => {
      if (!sesion.leer()) {
        if (vivo) setComprobando(false);
        return;
      }
      try {
        await api.yo();
        if (vivo) setDentro(true);
      } catch {
        sesion.borrar();
      } finally {
        if (vivo) setComprobando(false);
      }
    })();

    return () => { vivo = false; };
  }, []);

  /* Si el token caduca mientras el panel está abierto, api.js avisa por este
     evento y volvemos a la pantalla de acceso sin recargar la página. */
  useEffect(() => {
    const alPerderSesion = () => {
      setDentro(false);
      setEditando(null);
      mostrar('Tu sesión caducó. Entra otra vez, por favor.', true);
    };
    window.addEventListener(EVENTO_SIN_SESION, alPerderSesion);
    return () => window.removeEventListener(EVENTO_SIN_SESION, alPerderSesion);
  }, [mostrar]);

  /* La navbar se oscurece igual que en la tienda. */
  useEffect(() => {
    const alRodar = () => setBajado(window.scrollY > 12);
    alRodar();
    window.addEventListener('scroll', alRodar, { passive: true });
    return () => window.removeEventListener('scroll', alRodar);
  }, []);

  /* ---------------------------------------------------------
     Carga del catálogo
     --------------------------------------------------------- */
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [cats, etis, prods] = await Promise.all([
        api.categorias(),
        api.etiquetas(),
        api.productos()
      ]);
      setCategorias(cats);
      setEtiquetas(etis);
      setProductos(prods);
    } catch (err) {
      mostrar(err.message, true);
    } finally {
      setCargando(false);
    }
  }, [mostrar]);

  useEffect(() => { if (dentro) cargar(); }, [dentro, cargar]);

  /* ---------------------------------------------------------
     Entrar y salir
     --------------------------------------------------------- */
  async function entrar(usuario, password) {
    const r = await api.login(usuario, password);   // si falla, Acceso pinta el error
    /* El campo es `access_token`, como manda el esquema Token del API. Con
       `r.token` se guardaba la cadena "undefined" y el panel se abría igual
       —el catálogo se lee sin permiso— pero guardar, editar o borrar moría
       con un 401 y la sesión no sobrevivía a recargar la página. */
    sesion.guardar(r.access_token);
    setDentro(true);
    mostrar(`¡Hola, ${r.usuario}! 🍭`);
  }

  function salir() {
    sesion.borrar();
    setDentro(false);
    setEditando(null);
    setProductos([]);
    setBuscar('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------------------------------------------------
     Alta, edición y baja

     El formulario espera que estas funciones lancen el error si algo sale
     mal: así el mensaje queda pegado al campo que lo provocó y no solo en el
     avisito de abajo, que se va solo a los tres segundos.
     --------------------------------------------------------- */
  async function guardar(datos) {
    if (editando) {
      const actualizado = await api.editarProducto(editando.id, datos);
      setProductos((lista) => lista.map((p) => (p.id === actualizado.id ? actualizado : p)));
      setEditando(null);
      mostrar(`«${actualizado.nombre}» quedó actualizado ✏️`);
    } else {
      const creado = await api.crearProducto(datos);
      setProductos((lista) => [creado, ...lista]);
      mostrar(`«${creado.nombre}» ya está en la tienda 🍬`);
    }
  }

  function editar(p) {
    setEditando(p);
    /* El formulario está arriba del listado en móvil: sin esto uno pulsa ✎ y
       parece que no pasó nada. */
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function quitar(p) {
    setConfirmar({
      titulo: `¿Quitar "${p.nombre}"?`,
      texto: 'Dejará de aparecer en la tienda. Puedes volver a agregarlo cuando quieras.',
      textoOk: 'Sí, quitar',
      alAceptar: async () => {
        await api.quitarProducto(p.id);
        setProductos((lista) => lista.filter((x) => x.id !== p.id));
        if (editando && editando.id === p.id) setEditando(null);
        mostrar(`«${p.nombre}» salió del catálogo`);
      }
    });
  }

  /* ---------------------------------------------------------
     Catálogo completo
     --------------------------------------------------------- */
  async function exportar() {
    try {
      const lista = await api.exportar();
      setJson({ modo: 'exportar', texto: JSON.stringify(lista, null, 2) });
    } catch (err) {
      mostrar(err.message, true);
    }
  }

  function importar() {
    setJson({ modo: 'importar', texto: '' });
  }

  function restaurar() {
    setConfirmar({
      titulo: '¿Restaurar el catálogo de fábrica?',
      texto: 'Se borran todos los productos actuales y vuelven los 16 originales. '
           + 'Exporta antes si quieres conservar lo que tienes.',
      textoOk: 'Sí, restaurar',
      alAceptar: async () => {
        const r = await api.restaurar();
        setEditando(null);
        await cargar();
        mostrar(r.detalle);
      }
    });
  }

  /* El botón de la derecha de la ventana JSON: copiar si estamos exportando,
     importar si estamos pegando. */
  async function accionJson() {
    if (json.modo === 'exportar') {
      try {
        await navigator.clipboard.writeText(json.texto);
        mostrar('Catálogo copiado al portapapeles 📋');
      } catch {
        /* Sin permiso de portapapeles (o sin HTTPS) queda seleccionar a mano. */
        areaJson.current?.select();
        mostrar('Copia el texto seleccionado con Ctrl+C', true);
      }
      return;
    }

    let lista;
    try {
      lista = JSON.parse(json.texto);
    } catch {
      mostrar('Ese texto no es un JSON válido.', true);
      return;
    }
    if (!Array.isArray(lista) || lista.length === 0) {
      mostrar('El JSON tiene que ser una lista de productos.', true);
      return;
    }

    setJson(null);
    setConfirmar({
      titulo: '¿Reemplazar el catálogo?',
      texto: `Se borran los ${productos.length} producto(s) actuales y entran los ${lista.length} del JSON.`,
      textoOk: 'Sí, reemplazar',
      alAceptar: async () => {
        const r = await api.importar(lista);
        setEditando(null);
        await cargar();
        mostrar(r.detalle);
      }
    });
  }

  /* Las confirmaciones hacen trabajo de red: la ventana se queda abierta
     hasta que termina, y si el servidor dice que no, el error se ve ahí. */
  const [confirmando, setConfirmando] = useState(false);
  async function aceptarConfirmacion() {
    setConfirmando(true);
    try {
      await confirmar.alAceptar();
      setConfirmar(null);
    } catch (err) {
      mostrar(err.message, true);
    } finally {
      setConfirmando(false);
    }
  }

  /* ---------------------------------------------------------
     Búsqueda: se filtra en memoria porque el catálogo de una dulcería cabe
     de sobra, y así la lista responde mientras se escribe.
     --------------------------------------------------------- */
  const visibles = useMemo(() => {
    const q = buscar.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) =>
      `${p.nombre} ${p.origen} ${p.cat} ${p.desc}`.toLowerCase().includes(q)
    );
  }, [productos, buscar]);

  const chips = useMemo(() => {
    const lista = [{ clave: 'total', contenido: <>🍬 <b>{productos.length}</b> productos</> }];
    for (const c of categorias) {
      const n = productos.filter((p) => p.cat === c.slug).length;
      if (n > 0) lista.push({ clave: c.slug, contenido: <>{c.label} <b>{n}</b></> });
    }
    return lista;
  }, [productos, categorias]);

  /* ---------------------------------------------------------
     Pintado
     --------------------------------------------------------- */
  const cerrarSesionBtn = dentro ? (
    <button type="button" className="btn btn-outline nav-logout" onClick={salir}>
      Cerrar sesión
    </button>
  ) : null;

  return (
    <>
      <TopBar mensajes={MENSAJES} />
      <Navbar inicio="/" enlaces={ENLACES} bajado={bajado} extra={cerrarSesionBtn} />

      {/* Mientras se comprueba el token no se enseña ni el acceso ni el panel:
          ver la pantalla de clave un instante y que desaparezca sola es peor
          que esperar medio segundo. */}
      {comprobando ? (
        <section className="section">
          <div className="container gate">
            <p className="form-msg" role="status">Comprobando tu sesión…</p>
          </div>
        </section>
      ) : !dentro ? (
        <Acceso onEntrar={entrar} />
      ) : (
        <main className="section section-alt" id="panel">
          <div className="container">

            <div className="admin-head">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h2>Administra tus <span className="grad-text">productos</span></h2>
                <p>
                  Agrega dulces nuevos, modifica los que ya tienes o quita los que ya no
                  vendes. La tienda se actualiza al instante.
                </p>
              </div>
              <a href="/#productos" className="btn btn-cyan">Ver la tienda 🍭</a>
            </div>

            <div className="admin-stats" id="stats">
              {chips.map((c) => (
                <span className="stat-chip" key={c.clave}>{c.contenido}</span>
              ))}
            </div>

            <div className="admin-note">
              <span>💾</span>
              <p>
                Los cambios se guardan en <strong>el servidor</strong> y se publican al
                instante: no hace falta exportar nada ni tocar archivos.
              </p>
            </div>

            <div className="admin-note">
              <span>📁</span>
              <p>
                Las fotos que subas se guardan en el servidor, reducidas a 560 px y
                convertidas a WebP. Se sirven desde <code>/media/productos/</code>.
              </p>
            </div>

            <div className="admin-grid">
              <FormularioProducto
                categorias={categorias}
                etiquetas={etiquetas}
                editando={editando}
                onGuardar={guardar}
                onCancelar={() => setEditando(null)}
                aviso={mostrar}
              />

              {cargando && productos.length === 0 ? (
                <section className="admin-panel">
                  <h3>🗂️ Productos en el catálogo</h3>
                  <p className="admin-empty">Cargando el catálogo…</p>
                </section>
              ) : (
                <ListaProductos
                  productos={visibles}
                  buscar={buscar}
                  onBuscar={setBuscar}
                  editandoId={editando ? editando.id : null}
                  onEditar={editar}
                  onQuitar={quitar}
                  onExportar={exportar}
                  onImportar={importar}
                  onRestaurar={restaurar}
                />
              )}
            </div>

          </div>
        </main>
      )}

      <footer className="footer">
        <FooterBottom>
          <p>© <span id="year">{new Date().getFullYear()}</span> Candylandia Store · Panel de administración</p>
          <p><a href="/">Volver a la tienda</a></p>
        </FooterBottom>
      </footer>

      <Modal
        abierto={Boolean(confirmar)}
        titulo={confirmar ? confirmar.titulo : ''}
        onCerrar={() => { if (!confirmando) setConfirmar(null); }}
        acciones={
          <>
            <button type="button" className="btn btn-ghost" disabled={confirmando}
                    onClick={() => setConfirmar(null)}>Cancelar</button>
            <button type="button" className="btn btn-danger" disabled={confirmando}
                    onClick={aceptarConfirmacion}>
              {confirmando ? 'Un momento…' : (confirmar ? confirmar.textoOk : '')}
            </button>
          </>
        }
      >
        <p>{confirmar ? confirmar.texto : ''}</p>
      </Modal>

      <ModalAncha
        abierto={Boolean(json)}
        titulo={json && json.modo === 'exportar' ? 'Catálogo en JSON' : 'Importar catálogo'}
        onCerrar={() => setJson(null)}
        acciones={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => setJson(null)}>Cerrar</button>
            <button type="button" className="btn btn-purple" onClick={accionJson}>
              {json && json.modo === 'exportar' ? 'Copiar' : 'Importar'}
            </button>
          </>
        }
      >
        <p>
          {json && json.modo === 'exportar'
            ? 'Este es tu respaldo. Guárdalo antes de hacer cambios grandes: se vuelve a cargar con Importar.'
            : 'Pega aquí un catálogo exportado. Reemplaza todos los productos actuales.'}
        </p>
        <label className="sr-only" htmlFor="jsonArea">Catálogo en formato JSON</label>
        <textarea
          id="jsonArea" spellCheck="false" ref={areaJson}
          readOnly={Boolean(json) && json.modo === 'exportar'}
          placeholder={json && json.modo === 'importar' ? '[ { "nombre": "…", "cat": "…" } ]' : undefined}
          value={json ? json.texto : ''}
          onChange={(e) => setJson((j) => ({ ...j, texto: e.target.value }))}
        />
      </ModalAncha>

      <Toast aviso={aviso} />
    </>
  );
}
