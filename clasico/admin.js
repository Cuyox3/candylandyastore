/* =========================================================
   Candylandia Store — panel de administración
   Agrega, modifica y quita productos del catálogo (productos.js).
   ========================================================= */

const ADMIN = {
  /* Usuario y clave para entrar al panel. Cámbialos por los que quieras.
     Ojo: al ser un sitio estático, estos datos viajan en el código
     y solo sirven para evitar entradas casuales, no son seguridad real. */
  usuario: 'admin',
  clave: 'demo123',

  /* Emojis sugeridos en el formulario */
  emojis: ['🍫','🍬','🍭','🍪','🍡','🧁','🍩','🥤','🧋','🍜','🌈','🔥','🍯','🥜','🥚','🐻','🍮','🍊','🍓','🧃'],

  /* Combinaciones de color sugeridas (degradado de la tarjeta) */
  paletas: [
    ['#F42A8F','#FFB8DC'], ['#29B6E8','#BEEBFB'], ['#A05CD6','#E4CBF7'],
    ['#FFC93C','#FFF0B8'], ['#FF8A29','#FFD8AE'], ['#8FD98A','#D9F5C7'],
    ['#FF6B6B','#FFC9C9'], ['#6E5A8C','#D6CDE8']
  ]
};

/* ---------------------------------------------------------
   Utilidades
   --------------------------------------------------------- */
const $ = sel => document.querySelector(sel);

function esc(txt){
  return String(txt).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

const toast = $('#toast');
let toastTimer;
function aviso(texto, error){
  toast.textContent = texto;
  toast.classList.toggle('error', !!error);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* Tarjeta idéntica a la de la tienda */
function cardHTML(p){
  const tag = p.etiqueta
    ? `<span class="tag ${esc(p.tipo)}">${esc(p.etiqueta)}</span>`
    : '';
  return `
    <article class="card" data-cat="${esc(p.cat)}">
      <div class="card-media" style="--c1:${esc(p.c1)};--c2:${esc(p.c2)}">
        ${tag}
        ${CandyImg.mediaHTML(p, esc)}
      </div>
      <div class="card-body">
        <span class="card-origin">${esc(p.origen)}</span>
        <h3>${esc(p.nombre)}</h3>
        <p>${esc(p.desc)}</p>
        <div class="card-foot">
          <span class="card-price">$${esc(p.precio)}</span>
          <button class="card-btn" type="button" tabindex="-1">Lo quiero</button>
        </div>
      </div>
    </article>`;
}

/* ---------------------------------------------------------
   1. Acceso al panel
   --------------------------------------------------------- */
const gate     = $('#gate');
const gateForm = $('#gateForm');
const gateMsg  = $('#gateMsg');
const panel    = $('#panel');
const btnSalir = $('#btnSalir');
const SESION   = 'candylandia_admin_ok';

/* Se llama al final del archivo, cuando ya existe todo lo que usa render() */
function abrirPanel(){
  gate.closest('section').hidden = true;
  panel.hidden = false;
  btnSalir.hidden = false;
  render();
}

gateForm.addEventListener('submit', e => {
  e.preventDefault();
  const inUsuario = $('#usuario');
  const inClave   = $('#clave');

  /* Comparamos sin espacios sobrantes; el usuario no distingue mayúsculas */
  const okUsuario = inUsuario.value.trim().toLowerCase() === ADMIN.usuario;
  const okClave   = inClave.value === ADMIN.clave;

  inUsuario.classList.toggle('invalid', !okUsuario);
  inClave.classList.toggle('invalid', !okClave);

  if(!okUsuario || !okClave){
    gateMsg.classList.add('error');
    gateMsg.textContent = 'Usuario o clave incorrectos. Inténtalo de nuevo.';
    return;
  }

  gateMsg.classList.remove('error');
  gateMsg.textContent = '';
  try{ sessionStorage.setItem(SESION, '1'); }catch(err){ /* nada */ }
  abrirPanel();
});

btnSalir.addEventListener('click', () => {
  try{ sessionStorage.removeItem(SESION); }catch(err){ /* nada */ }
  location.reload();
});

/* ---------------------------------------------------------
   2. Opciones del formulario (categorías, etiquetas, emojis, colores)
   --------------------------------------------------------- */
const selCat      = $('#fCat');
const selEtiqueta = $('#fEtiqueta');

selCat.innerHTML = CATEGORIAS
  .map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');

selEtiqueta.innerHTML = ETIQUETAS
  .map((e, i) => `<option value="${i}">${esc(e.label)}</option>`).join('');

$('#emojiPicks').innerHTML = ADMIN.emojis
  .map(e => `<button type="button" class="chip-pick" data-emoji="${esc(e)}">${esc(e)}</button>`).join('');

$('#swatches').innerHTML = ADMIN.paletas
  .map(([c1, c2]) =>
    `<button type="button" class="swatch" style="--c1:${c1};--c2:${c2}"
       data-c1="${c1}" data-c2="${c2}" aria-label="Usar colores ${c1} y ${c2}"></button>`
  ).join('');

$('#emojiPicks').addEventListener('click', e => {
  const btn = e.target.closest('.chip-pick');
  if(!btn) return;
  $('#fEmoji').value = btn.dataset.emoji;
  actualizarPreview();
});

$('#swatches').addEventListener('click', e => {
  const btn = e.target.closest('.swatch');
  if(!btn) return;
  $('#fC1').value = btn.dataset.c1;
  $('#fC2').value = btn.dataset.c2;
  actualizarPreview();
});

/* ---------------------------------------------------------
   3. Vista previa en vivo
   --------------------------------------------------------- */
const form = $('#formProducto');

/* ---------------------------------------------------------
   3.1 Foto del producto (opcional)
   La foto se comprime aquí mismo y se guarda como archivo en
   assets/productos/ cuando guardas el producto. Ver imagenes.js.
   --------------------------------------------------------- */
const inputArchivo = $('#fArchivo');
const imgDrop      = $('#imgDrop');
const imgThumb     = $('#imgThumb');
const imgPreview   = $('#imgPreview');
const imgTexto     = $('#imgTexto');
const imgEstado    = $('#imgEstado');
const btnQuitarImg = $('#btnQuitarImg');

let fotoNueva = null;  /* foto recién elegida, todavía sin guardar */
let fotoRuta  = '';    /* ruta de la foto que ya tiene el producto */

const kb = bytes => Math.max(1, Math.round(bytes / 1024)) + ' KB';

function mensajeFoto(texto, error){
  imgEstado.textContent = texto || '';
  imgEstado.classList.toggle('error', !!error);
}

/* Muestra u oculta la miniatura del recuadro */
function pintarFoto(src){
  const hay = !!src;
  imgThumb.hidden = !hay;
  btnQuitarImg.hidden = !hay;
  imgTexto.hidden = hay;
  imgDrop.classList.toggle('con-foto', hay);
  if(hay) imgPreview.src = src;
  else imgPreview.removeAttribute('src');
}

/* Deja el campo sin foto (el producto volverá a usar su emoji) */
function limpiarFoto(){
  fotoNueva = null;
  fotoRuta  = '';
  inputArchivo.value = '';
  pintarFoto('');
  mensajeFoto('');
}

/* Al editar: muestra la foto que ya tiene el producto */
function cargarFotoDeProducto(ruta){
  fotoNueva = null;
  inputArchivo.value = '';
  fotoRuta = ruta || '';
  if(!fotoRuta){
    pintarFoto('');
    mensajeFoto('');
    return;
  }
  /* Si el archivo aún no está en la carpeta, usamos la copia del navegador */
  pintarFoto(CandyImg.respaldo(fotoRuta) || fotoRuta);
  mensajeFoto('Foto actual: ' + fotoRuta);
}

/* Procesa el archivo que eligió o arrastró el usuario */
async function recibirArchivo(file){
  if(!file) return;
  mensajeFoto('Procesando la imagen…');
  try{
    const foto = await CandyImg.comprimir(file);
    fotoNueva = foto;
    fotoRuta  = '';
    pintarFoto(foto.dataURL);
    mensajeFoto(`Lista (${kb(foto.peso)}). Se guardará en ${CandyImg.carpeta}/ al guardar el producto.`);
    actualizarPreview();
  }catch(err){
    inputArchivo.value = '';
    mensajeFoto(err.message || 'No se pudo usar esa imagen.', true);
  }
}

$('#btnElegirImg').addEventListener('click', () => inputArchivo.click());

inputArchivo.addEventListener('change', () => recibirArchivo(inputArchivo.files[0]));

btnQuitarImg.addEventListener('click', () => {
  limpiarFoto();
  actualizarPreview();
  aviso('Foto quitada. La tarjeta vuelve a mostrar el emoji.');
});

/* Arrastrar y soltar */
['dragenter','dragover'].forEach(ev => {
  imgDrop.addEventListener(ev, e => {
    e.preventDefault();
    imgDrop.classList.add('arrastrando');
  });
});
['dragleave','drop'].forEach(ev => {
  imgDrop.addEventListener(ev, e => {
    e.preventDefault();
    imgDrop.classList.remove('arrastrando');
  });
});
imgDrop.addEventListener('drop', e => {
  const file = e.dataTransfer && e.dataTransfer.files[0];
  if(file) recibirArchivo(file);
});

function datosFormulario(){
  const etq = ETIQUETAS[Number(selEtiqueta.value)] || ETIQUETAS[0];
  return {
    cat:      selCat.value,
    emoji:    $('#fEmoji').value.trim() || '🍬',
    nombre:   $('#fNombre').value.trim() || 'Nombre del producto',
    origen:   $('#fOrigen').value.trim() || 'País de origen',
    desc:     $('#fDesc').value.trim() || 'Aquí va la descripción que verá tu cliente.',
    precio:   Number($('#fPrecio').value) || 0,
    /* En la vista previa mostramos la foto recién elegida (dataURL);
       al guardar se cambia por su ruta en assets/productos/ */
    img:      fotoNueva ? fotoNueva.dataURL : fotoRuta,
    etiqueta: etq.etiqueta,
    tipo:     etq.tipo,
    c1:       $('#fC1').value,
    c2:       $('#fC2').value
  };
}

function actualizarPreview(){
  $('#preview').innerHTML = cardHTML(datosFormulario());
  CandyImg.aplicarRespaldos($('#preview'));
}

form.addEventListener('input', actualizarPreview);
form.addEventListener('change', actualizarPreview);
actualizarPreview();

/* ---------------------------------------------------------
   4. Agregar / modificar producto
   El mismo formulario sirve para las dos cosas:
   si `editandoId` tiene un id, guarda sobre ese producto;
   si es null, crea uno nuevo.
   --------------------------------------------------------- */
const formMsg     = $('#formMsg');
const formTitulo  = $('#formTitulo');
const formSub     = $('#formSub');
const btnGuardar  = $('#btnGuardar');
const btnCancelar = $('#btnCancelar');

let editandoId = null;

/* Deja el formulario limpio y en modo "agregar" */
function modoAgregar(){
  editandoId = null;
  form.reset();
  limpiarFoto();
  $('#fC1').value = '#F42A8F';
  $('#fC2').value = '#FFB8DC';
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  formMsg.classList.remove('error');
  formMsg.textContent = '';
  formTitulo.textContent = '➕ Agregar producto';
  formSub.textContent = 'Se coloca al inicio del catálogo para que se vea primero.';
  btnGuardar.textContent = 'Agregar al catálogo 🍬';
  btnCancelar.hidden = true;
  actualizarPreview();
  renderLista();
}

/* Carga un producto en el formulario y pasa a modo "modificar" */
function modoEditar(p){
  editandoId = p.id;

  selCat.value       = p.cat;
  $('#fNombre').value = p.nombre;
  $('#fPrecio').value = p.precio;
  $('#fOrigen').value = p.origen;
  $('#fEmoji').value  = p.emoji;
  $('#fDesc').value   = p.desc;
  $('#fC1').value     = p.c1;
  $('#fC2').value     = p.c2;
  cargarFotoDeProducto(p.img);

  /* Buscamos qué etiqueta de la lista corresponde a este producto */
  const iEtq = ETIQUETAS.findIndex(e => e.tipo === p.tipo && e.etiqueta === p.etiqueta);
  selEtiqueta.value = String(iEtq === -1 ? 0 : iEtq);

  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  formMsg.classList.remove('error');
  formMsg.textContent = '';
  formTitulo.textContent = '✎ Modificando producto';
  formSub.textContent = `Estás editando "${p.nombre}". Guarda para aplicar los cambios.`;
  btnGuardar.textContent = 'Guardar cambios 💾';
  btnCancelar.hidden = false;

  actualizarPreview();
  renderLista();
  form.scrollIntoView({ behavior:'smooth', block:'start' });
  $('#fNombre').focus();
}

btnCancelar.addEventListener('click', () => {
  modoAgregar();
  aviso('Edición cancelada.');
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  const campos = ['fNombre','fOrigen','fEmoji','fDesc','fPrecio'];
  let valido = true;
  let avisoFoto = '';

  campos.forEach(id => {
    const el = document.getElementById(id);
    const vacio = !el.value.trim();
    const precioMal = (id === 'fPrecio') && !(Number(el.value) > 0);
    const error = vacio || precioMal;
    el.classList.toggle('invalid', error);
    if(error) valido = false;
  });

  if(!valido){
    formMsg.classList.add('error');
    formMsg.textContent = 'Revisa los campos marcados, por favor.';
    return;
  }

  const editando = editandoId !== null;
  const datos    = datosFormulario();

  /* Si hay una foto nueva, primero la guardamos como archivo en
     assets/productos/ y en el producto dejamos solo su ruta. */
  if(fotoNueva){
    btnGuardar.disabled = true;
    const nombreArchivo = CandyDB.nuevoId(datos.nombre) + '.' + fotoNueva.ext;
    const ruta = CandyImg.ruta(nombreArchivo);
    let modo;
    try{
      modo = await CandyImg.guardarArchivo(nombreArchivo, fotoNueva.blob);
    }finally{
      btnGuardar.disabled = false;
    }
    /* Copia de respaldo para que la tarjeta se vea aunque el
       archivo todavía no esté en su sitio */
    CandyImg.guardarRespaldo(ruta, fotoNueva.dataURL);
    datos.img = ruta;
    fotoNueva = null;
    fotoRuta  = ruta;
    avisoFoto = (modo === 'carpeta')
      ? `Foto guardada en ${ruta} ✅`
      : `Se descargó ${nombreArchivo}. Colócalo en ${CandyImg.carpeta}/ del proyecto.`;
  }

  const producto = editando
    ? CandyDB.actualizar(editandoId, datos)
    : CandyDB.agregar(datos);

  if(!producto){
    formMsg.classList.add('error');
    formMsg.textContent = editando
      ? 'No se pudo guardar. Puede que el producto ya no exista.'
      : 'No se pudo guardar. Revisa que tu navegador permita almacenamiento.';
    return;
  }

  modoAgregar();   // limpia el formulario y vuelve a modo agregar
  render();
  aviso(editando
    ? `"${producto.nombre}" se actualizó ✨`
    : `"${producto.nombre}" ya está en la tienda 🍬`);
  if(avisoFoto) setTimeout(() => aviso(avisoFoto), 2400);
  $('#fNombre').focus();
});

/* ---------------------------------------------------------
   5. Listado + búsqueda
   --------------------------------------------------------- */
const lista  = $('#adminProducts');
const buscar = $('#buscar');

function filtrarLista(){
  const q = buscar.value.trim().toLowerCase();
  const todos = CandyDB.todos();
  if(!q) return todos;
  return todos.filter(p =>
    (p.nombre + ' ' + p.origen + ' ' + p.cat + ' ' + p.desc).toLowerCase().includes(q)
  );
}

function renderLista(){
  const productos = filtrarLista();

  if(!productos.length){
    lista.innerHTML = buscar.value.trim()
      ? '<p class="admin-empty">Ningún producto coincide con tu búsqueda 🔍</p>'
      : '<p class="admin-empty">Tu catálogo está vacío. Agrega tu primer dulce 🍭</p>';
    return;
  }

  lista.innerHTML = productos.map(p => `
    <div class="admin-item${p.id === editandoId ? ' editando' : ''}">
      <button type="button" class="card-edit" data-id="${esc(p.id)}"
        aria-label="Modificar ${esc(p.nombre)}" title="Modificar producto">✎</button>
      <button type="button" class="card-del" data-id="${esc(p.id)}"
        aria-label="Quitar ${esc(p.nombre)}" title="Quitar del catálogo">✕</button>
      ${cardHTML(p)}
    </div>`).join('');

  CandyImg.aplicarRespaldos(lista);
}

function renderStats(){
  const todos = CandyDB.todos();
  const chips = [`<span class="stat-chip">🍬 <b>${todos.length}</b> productos</span>`];

  CATEGORIAS.forEach(c => {
    const n = todos.filter(p => p.cat === c.id).length;
    chips.push(`<span class="stat-chip">${esc(c.label)} <b>${n}</b></span>`);
  });

  if(CandyDB.hayCambios()){
    chips.push('<span class="stat-chip">✏️ Con cambios sin publicar</span>');
  }

  $('#stats').innerHTML = chips.join('');
}

function render(){
  renderLista();
  renderStats();
  /* Suelta las copias de fotos que ya no usa ningún producto */
  CandyImg.limpiarRespaldos(CandyDB.todos().map(p => p.img).filter(Boolean));
}

buscar.addEventListener('input', renderLista);

/* ---------------------------------------------------------
   6. Modales (confirmar y JSON)
   --------------------------------------------------------- */
function abrirModal(el){
  el.hidden = false;
  void el.offsetWidth; // fuerza el reflow para que corra la transición
  el.classList.add('open');
}
function cerrarModal(el){
  el.classList.remove('open');
  setTimeout(() => { el.hidden = true; }, 230);
}

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => {
    if(e.target === m || e.target.closest('[data-cerrar]')){
      if(m === document.getElementById('modalConfirm')) alConfirmar = null;
      cerrarModal(m);
    }
  });
});

document.addEventListener('keydown', e => {
  if(e.key !== 'Escape') return;
  alConfirmar = null;
  document.querySelectorAll('.modal.open').forEach(cerrarModal);
});

/* ---------------------------------------------------------
   7. Confirmación reutilizable + quitar producto
   --------------------------------------------------------- */
const modalConfirm = $('#modalConfirm');
const btnConfirmOk = $('#confirmOk');
let alConfirmar = null;

function confirmar(titulo, texto, textoBoton, accion){
  $('#confirmTitulo').textContent = titulo;
  $('#confirmTexto').textContent  = texto;
  btnConfirmOk.textContent = textoBoton;
  alConfirmar = accion;
  abrirModal(modalConfirm);
}

btnConfirmOk.addEventListener('click', () => {
  const accion = alConfirmar;
  alConfirmar = null;
  cerrarModal(modalConfirm);
  if(accion) accion();
});

lista.addEventListener('click', e => {
  const btn = e.target.closest('.card-edit, .card-del');
  if(!btn) return;

  const producto = CandyDB.obtener(btn.dataset.id);
  if(!producto){
    aviso('Ese producto ya no está en el catálogo.', true);
    render();
    return;
  }

  /* ✎ Modificar: carga el producto en el formulario */
  if(btn.classList.contains('card-edit')){
    modoEditar(producto);
    return;
  }

  /* ✕ Quitar: pide confirmación primero */
  confirmar(
    `¿Quitar "${producto.nombre}"?`,
    'Dejará de aparecer en la tienda. Puedes volver a agregarlo cuando quieras.',
    'Sí, quitar',
    () => {
      const fuera = CandyDB.quitar(producto.id);
      if(!fuera){
        aviso('No se pudo quitar el producto.', true);
        return;
      }
      /* Si justo era el que estábamos editando, salimos del modo edición */
      if(editandoId === fuera.id) modoAgregar();
      render();
      aviso(`"${fuera.nombre}" salió del catálogo 🗑️`);
    }
  );
});

/* ---------------------------------------------------------
   8. Exportar / importar / restaurar
   --------------------------------------------------------- */
const modalJson = $('#modalJson');
const jsonArea  = $('#jsonArea');
const jsonBtn   = $('#jsonAccion');
let modoJson    = 'exportar';

$('#btnExportar').addEventListener('click', () => {
  modoJson = 'exportar';
  $('#jsonTitulo').textContent = 'Exportar catálogo';
  $('#jsonTexto').innerHTML =
    'Copia este contenido y pégalo dentro de <code>PRODUCTOS_BASE</code> en <code>productos.js</code> ' +
    'para que todos tus clientes vean los cambios.';
  jsonArea.value = CandyDB.exportar();
  jsonArea.readOnly = true;
  jsonBtn.textContent = 'Copiar';
  abrirModal(modalJson);
});

$('#btnImportar').addEventListener('click', () => {
  modoJson = 'importar';
  $('#jsonTitulo').textContent = 'Importar catálogo';
  $('#jsonTexto').textContent =
    'Pega aquí un catálogo en JSON. Reemplazará por completo el catálogo actual de este navegador.';
  jsonArea.value = '';
  jsonArea.readOnly = false;
  jsonBtn.textContent = 'Importar';
  abrirModal(modalJson);
  setTimeout(() => jsonArea.focus(), 250);
});

jsonBtn.addEventListener('click', async () => {
  if(modoJson === 'exportar'){
    try{
      await navigator.clipboard.writeText(jsonArea.value);
      aviso('Catálogo copiado al portapapeles 📋');
    }catch(err){
      jsonArea.select();
      aviso('Copia el texto seleccionado con Ctrl/Cmd + C', true);
    }
    return;
  }

  let datos;
  try{
    datos = JSON.parse(jsonArea.value);
  }catch(err){
    aviso('El JSON tiene errores de formato.', true);
    return;
  }

  if(!Array.isArray(datos) || !datos.length){
    aviso('El JSON debe ser una lista de productos.', true);
    return;
  }

  if(!CandyDB.reemplazar(datos)){
    aviso('No se pudo guardar el catálogo importado.', true);
    return;
  }

  cerrarModal(modalJson);
  modoAgregar();
  render();
  aviso(`Catálogo importado: ${datos.length} productos 📦`);
});

$('#btnRestaurar').addEventListener('click', () => {
  confirmar(
    '¿Restaurar el catálogo original?',
    'Se borrarán los productos que agregaste y volverán los que están en productos.js.',
    'Sí, restaurar',
    () => {
      CandyDB.restaurar();
      modoAgregar();
      render();
      aviso('Catálogo original restaurado 🔄');
    }
  );
});

/* ---------------------------------------------------------
   9. Carpeta del proyecto (para guardar las fotos)
   Chrome y Edge pueden escribir en una carpeta de tu disco si
   tú la eliges y das permiso. El permiso se recuerda.
   --------------------------------------------------------- */
const btnCarpeta  = $('#btnCarpeta');
const notaCarpeta = $('#notaCarpetaTxt');

function textoCarpeta(lista){
  if(!CandyImg.soportaCarpeta()){
    notaCarpeta.innerHTML =
      'Tu navegador no puede escribir en carpetas, así que las fotos se <strong>descargarán</strong>. ' +
      'Colócalas en <code>' + CandyImg.carpeta + '/</code> dentro del proyecto. ' +
      '(Chrome y Edge sí pueden guardarlas solos.)';
    btnCarpeta.hidden = true;
    return;
  }
  notaCarpeta.innerHTML = lista
    ? 'Las fotos se guardan solas en <code>' + CandyImg.carpeta + '/</code> dentro de la carpeta que elegiste. ✅'
    : 'Elige la <strong>carpeta del proyecto</strong> una vez y las fotos se guardarán solas en ' +
      '<code>' + CandyImg.carpeta + '/</code>. Si no, se descargarán y las moverás a mano.';
  btnCarpeta.textContent = lista ? 'Cambiar carpeta' : 'Elegir carpeta del proyecto';
  btnCarpeta.hidden = false;
}

btnCarpeta.addEventListener('click', async () => {
  try{
    await CandyImg.elegirCarpeta();
    textoCarpeta(true);
    aviso('Carpeta lista: las fotos se guardarán en ' + CandyImg.carpeta + '/ 📁');
  }catch(err){
    /* Cancelar el selector no es un error que valga la pena gritar */
    if(err && err.name === 'AbortError') return;
    aviso(err.message || 'No se pudo usar esa carpeta.', true);
  }
});

/* Al abrir el panel comprobamos si ya había una carpeta autorizada */
CandyImg.carpetaGuardada(false).then(handle => textoCarpeta(!!handle));

/* ---------------------------------------------------------
   10. Menú móvil + año del footer
   --------------------------------------------------------- */
const burger   = $('#burger');
const navLinks = $('#navLinks');

burger.addEventListener('click', () => {
  const abierto = navLinks.classList.toggle('open');
  burger.classList.toggle('open', abierto);
  burger.setAttribute('aria-expanded', String(abierto));
  burger.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
});

navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    burger.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  });
});

const navbar = $('#navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 12);
}, { passive:true });

$('#year').textContent = new Date().getFullYear();

/* ---------------------------------------------------------
   11. Si ya hay sesión abierta, entra directo
   (va al final: render() necesita todo lo definido arriba)
   --------------------------------------------------------- */
try{
  if(sessionStorage.getItem(SESION) === '1') abrirPanel();
}catch(err){ /* modo privado: pedirá la clave */ }
