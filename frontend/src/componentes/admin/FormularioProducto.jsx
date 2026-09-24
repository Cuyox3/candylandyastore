import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { EMOJIS, PALETAS } from '../../config';
import TarjetaProducto from '../TarjetaProducto';

/* El emoji arranca vacío, como en el panel clásico: así se ve el 🍫 gris del
   placeholder y no un valor puesto de oficio. La vista previa sigue enseñando
   un 🍬 mientras no se elija ninguno. */
const VACIO = {
  nombre: '', cat: '', precio: '', origen: '', emoji: '',
  desc: '', etiqueta: '', tipo: '', c1: '#F42A8F', c2: '#FFB8DC', img: ''
};

/* =========================================================
   Alta y edición de productos.

   El mismo formulario sirve para las dos cosas: si recibe `editando`, guarda
   sobre ese producto; si no, crea uno nuevo. Es como funcionaba el panel
   clásico y evita tener dos formularios que se van separando con el tiempo.

   La vista previa usa el MISMO componente de tarjeta que la tienda, así que
   lo que se ve aquí es literalmente lo que va a salir publicado.
   ========================================================= */
export default function FormularioProducto({ categorias, etiquetas, editando, onGuardar, onCancelar, aviso }) {
  const [datos, setDatos]   = useState(VACIO);
  const [malos, setMalos]   = useState({});
  const [msg, setMsg]       = useState({ texto:'', error:false });
  const [guardando, setGuardando] = useState(false);

  const [subiendo, setSubiendo]     = useState(false);
  const [estadoImg, setEstadoImg]   = useState({ texto:'', error:false });
  const [arrastrando, setArrastrando] = useState(false);
  const inputArchivo = useRef(null);

  /* Al pulsar ✎ en una tarjeta, el formulario se rellena con ese producto.
     Al salir de la edición vuelve a quedar vacío, con la categoría por
     defecto puesta para no obligar a elegirla cada vez. */
  useEffect(() => {
    if (editando) {
      setDatos({
        nombre: editando.nombre, cat: editando.cat, precio: String(editando.precio),
        origen: editando.origen, emoji: editando.emoji, desc: editando.desc,
        etiqueta: editando.etiqueta, tipo: editando.tipo,
        c1: editando.c1, c2: editando.c2, img: editando.img || ''
      });
      setEstadoImg({ texto: editando.img ? 'Foto actual del producto.' : '', error:false });
    } else {
      setDatos({ ...VACIO, cat: categorias[0]?.slug || '' });
      setEstadoImg({ texto:'', error:false });
    }
    setMalos({});
    setMsg({ texto:'', error:false });
  }, [editando, categorias]);

  function cambiar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    if (malos[campo]) setMalos((m) => ({ ...m, [campo]: false }));
  }

  /* La etiqueta y su `tipo` (el color) van juntos: se eligen con un solo
     desplegable y aquí se separan en los dos campos que espera el API. */
  function elegirEtiqueta(indice) {
    const e = etiquetas[indice] || etiquetas[0] || { etiqueta:'', tipo:'' };
    setDatos((d) => ({ ...d, etiqueta: e.etiqueta, tipo: e.tipo }));
  }

  const indiceEtiqueta = Math.max(
    0,
    etiquetas.findIndex((e) => e.etiqueta === datos.etiqueta && e.tipo === datos.tipo)
  );

  /* ---------------------------------------------------------
     Foto del producto
     La compresión ya NO se hace en el navegador: la imagen viaja tal cual y
     el servidor la reduce a 560 px y la convierte a WebP. Así el resultado
     es el mismo desde cualquier navegador, y el archivo queda en el disco
     del servidor en vez de en la carpeta de Descargas de quien lo subió.
     --------------------------------------------------------- */
  async function subirFoto(archivo) {
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      setEstadoImg({ texto:'Ese archivo no es una imagen.', error:true });
      return;
    }

    setSubiendo(true);
    setEstadoImg({ texto:'Subiendo la foto…', error:false });
    try {
      const r = await api.subirImagen(archivo);
      setDatos((d) => ({ ...d, img: r.img }));
      setEstadoImg({
        texto: `Foto lista · ${r.ancho}×${r.alto} px · ${Math.round(r.peso / 1024)} KB`,
        error: false
      });
    } catch (err) {
      setEstadoImg({ texto: err.message, error:true });
    } finally {
      setSubiendo(false);
    }
  }

  function quitarFoto() {
    /* El archivo del servidor NO se borra aquí: si estás editando y luego te
       arrepientes sin guardar, el producto publicado seguiría apuntando a una
       foto que ya no existe. La limpieza se hace al guardar. */
    setDatos((d) => ({ ...d, img: '' }));
    setEstadoImg({ texto:'La tarjeta volverá a mostrar el emoji.', error:false });
    if (inputArchivo.current) inputArchivo.current.value = '';
  }

  /* ---------------------------------------------------------
     Guardar
     --------------------------------------------------------- */
  async function enviar(e) {
    e.preventDefault();

    const precio = Number(datos.precio);
    const fallos = {
      nombre: !datos.nombre.trim(),
      cat:    !datos.cat,
      origen: !datos.origen.trim(),
      emoji:  !datos.emoji.trim(),
      desc:   !datos.desc.trim(),
      precio: !(precio > 0)
    };
    setMalos(fallos);

    if (Object.values(fallos).some(Boolean)) {
      setMsg({ texto:'Revisa los campos marcados, por favor.', error:true });
      return;
    }

    setGuardando(true);
    try {
      await onGuardar({
        nombre: datos.nombre.trim(),
        cat: datos.cat,
        precio,
        origen: datos.origen.trim(),
        emoji: datos.emoji.trim(),
        desc: datos.desc.trim(),
        etiqueta: datos.etiqueta,
        tipo: datos.tipo,
        c1: datos.c1,
        c2: datos.c2,
        img: datos.img
      });

      setMsg({ texto:'', error:false });
      if (!editando) {
        setDatos({ ...VACIO, cat: categorias[0]?.slug || '' });
        setEstadoImg({ texto:'', error:false });
        if (inputArchivo.current) inputArchivo.current.value = '';
      }
    } catch (err) {
      setMsg({ texto: err.message, error:true });
      aviso && aviso(err.message, true);
    } finally {
      setGuardando(false);
    }
  }

  /* La vista previa necesita un producto completo aunque falten campos. */
  const previa = {
    ...datos,
    precio: Number(datos.precio) || 0,
    nombre: datos.nombre || 'Nombre del producto',
    origen: datos.origen || 'País de origen',
    desc:   datos.desc   || 'Aquí va la descripción que verá tu cliente.',
    emoji:  datos.emoji  || '🍬'
  };

  return (
    <section className="admin-panel">
      <h3 id="formTitulo">{editando ? '✎ Modificar producto' : '➕ Agregar producto'}</h3>
      <p id="formSub">
        {editando
          ? `Estás editando «${editando.nombre}». Los cambios se ven en la tienda al guardar.`
          : 'Se coloca al inicio del catálogo para que se vea primero.'}
      </p>

      <form id="formProducto" noValidate onSubmit={enviar}>
        <div className="field">
          <label htmlFor="fNombre">Nombre del producto *</label>
          <input type="text" id="fNombre" name="nombre" placeholder="Ej. Kit Kat Matcha" maxLength={60} required
                 className={malos.nombre ? 'invalid' : ''}
                 value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="fCat">Categoría *</label>
            <select id="fCat" name="cat" required
                    className={malos.cat ? 'invalid' : ''}
                    value={datos.cat} onChange={(e) => cambiar('cat', e.target.value)}>
              {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="fPrecio">Precio (MXN) *</label>
            <input type="number" id="fPrecio" name="precio" placeholder="89" min="1" max="99999" step="1" required
                   className={malos.precio ? 'invalid' : ''}
                   value={datos.precio} onChange={(e) => cambiar('precio', e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="fOrigen">País de origen *</label>
          <input type="text" id="fOrigen" name="origen" placeholder="Ej. Japón" maxLength={40} required
                 className={malos.origen ? 'invalid' : ''}
                 value={datos.origen} onChange={(e) => cambiar('origen', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="fEmoji">Emoji del producto *</label>
          <input type="text" id="fEmoji" name="emoji" placeholder="🍫" maxLength={4} required
                 className={malos.emoji ? 'invalid' : ''}
                 value={datos.emoji} onChange={(e) => cambiar('emoji', e.target.value)} />
          <div className="chips" id="emojiPicks" aria-label="Emojis sugeridos">
            {EMOJIS.map((em) => (
              <button type="button" className="chip-pick" key={em}
                      onClick={() => cambiar('emoji', em)}>{em}</button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="fArchivo">Foto del producto <small>(opcional, sustituye al emoji)</small></label>

          <div
            className={'img-drop' + (arrastrando ? ' arrastrando' : '') + (datos.img ? ' con-foto' : '')}
            id="imgDrop"
            onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              subirFoto(e.dataTransfer.files?.[0]);
            }}
          >
            <input type="file" id="fArchivo" name="archivo" ref={inputArchivo}
                   accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden
                   onChange={(e) => subirFoto(e.target.files?.[0])} />

            {datos.img && (
              <div className="img-thumb" id="imgThumb">
                <img id="imgPreview" src={datos.img} alt="Vista previa de la foto del producto" />
              </div>
            )}

            {!datos.img && (
              <p className="img-drop-txt" id="imgTexto">
                Arrastra una foto aquí o <b>elige un archivo</b>
                <br /><small>PNG, JPG o WebP · se reduce a 560 px automáticamente</small>
              </p>
            )}

            <div className="img-acciones">
              <button type="button" className="btn btn-ghost btn-sm" id="btnElegirImg"
                      disabled={subiendo}
                      onClick={() => inputArchivo.current?.click()}>
                {subiendo ? 'Subiendo…' : '📷 Elegir foto'}
              </button>
              {datos.img && (
                <button type="button" className="btn btn-ghost btn-sm" id="btnQuitarImg"
                        onClick={quitarFoto}>Quitar foto</button>
              )}
            </div>
          </div>

          <p className={'img-estado' + (estadoImg.error ? ' error' : '')} id="imgEstado" role="status">
            {estadoImg.texto}
          </p>
        </div>

        <div className="field">
          <label htmlFor="fDesc">Descripción *</label>
          <textarea id="fDesc" name="desc" rows="3" maxLength={160}
                    placeholder="Cuéntale al cliente por qué le va a encantar…" required
                    className={malos.desc ? 'invalid' : ''}
                    value={datos.desc} onChange={(e) => cambiar('desc', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="fEtiqueta">Etiqueta</label>
          <select id="fEtiqueta" name="etiqueta"
                  value={indiceEtiqueta}
                  onChange={(e) => elegirEtiqueta(Number(e.target.value))}>
            {etiquetas.map((e, i) => <option key={e.label} value={i}>{e.label}</option>)}
          </select>
        </div>

        <div className="field">
          <label htmlFor="fC1">Colores de la tarjeta</label>
          <div className="color-row">
            <input type="color" id="fC1" name="c1" aria-label="Color inicial del degradado"
                   value={datos.c1} onChange={(e) => cambiar('c1', e.target.value.toUpperCase())} />
            <input type="color" id="fC2" name="c2" aria-label="Color final del degradado"
                   value={datos.c2} onChange={(e) => cambiar('c2', e.target.value.toUpperCase())} />
            <div className="swatches" id="swatches" aria-label="Combinaciones sugeridas">
              {PALETAS.map(([a, b]) => (
                <button type="button" className="swatch" key={a + b}
                        style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
                        title={`${a} → ${b}`}
                        aria-label={`Usar el degradado ${a} a ${b}`}
                        onClick={() => setDatos((d) => ({ ...d, c1: a, c2: b }))} />
              ))}
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-pink btn-lg btn-block" id="btnGuardar" disabled={guardando}>
          {guardando ? 'Guardando…' : (editando ? 'Guardar cambios 💾' : 'Agregar al catálogo 🍬')}
        </button>

        {editando && (
          <button type="button" className="btn btn-ghost btn-block" id="btnCancelar" onClick={onCancelar}>
            Cancelar edición
          </button>
        )}

        <p className={'form-msg' + (msg.error ? ' error' : '')} id="formMsg" role="status">{msg.texto}</p>
      </form>

      <div className="admin-preview">
        <h4>Vista previa</h4>
        <div id="preview">
          <TarjetaProducto producto={previa} botonInerte />
        </div>
      </div>
    </section>
  );
}
