/* =========================================================
   Candylandia Store — panel de administración
   Agrega y quita productos del catálogo (productos.js).
   ========================================================= */

const ADMIN = {
  /* Clave para entrar al panel. Cámbiala por la que quieras.
     Ojo: al ser un sitio estático, esta clave viaja en el código
     y solo sirve para evitar entradas casuales, no es seguridad real. */
  clave: 'candylandia2021',

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
        <span class="emoji">${esc(p.emoji)}</span>
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
  const input = $('#clave');
  if(input.value !== ADMIN.clave){
    input.classList.add('invalid');
    gateMsg.classList.add('error');
    gateMsg.textContent = 'Clave incorrecta. Inténtalo de nuevo.';
    return;
  }
  input.classList.remove('invalid');
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

function datosFormulario(){
  const etq = ETIQUETAS[Number(selEtiqueta.value)] || ETIQUETAS[0];
  return {
    cat:      selCat.value,
    emoji:    $('#fEmoji').value.trim() || '🍬',
    nombre:   $('#fNombre').value.trim() || 'Nombre del producto',
    origen:   $('#fOrigen').value.trim() || 'País de origen',
    desc:     $('#fDesc').value.trim() || 'Aquí va la descripción que verá tu cliente.',
    precio:   Number($('#fPrecio').value) || 0,
    etiqueta: etq.etiqueta,
    tipo:     etq.tipo,
    c1:       $('#fC1').value,
    c2:       $('#fC2').value
  };
}

function actualizarPreview(){
  $('#preview').innerHTML = cardHTML(datosFormulario());
}

form.addEventListener('input', actualizarPreview);
form.addEventListener('change', actualizarPreview);
actualizarPreview();

/* ---------------------------------------------------------
   4. Agregar producto
   --------------------------------------------------------- */
const formMsg = $('#formMsg');

form.addEventListener('submit', e => {
  e.preventDefault();
  const campos = ['fNombre','fOrigen','fEmoji','fDesc','fPrecio'];
  let valido = true;

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

  const producto = CandyDB.agregar(datosFormulario());

  if(!producto){
    formMsg.classList.add('error');
    formMsg.textContent = 'No se pudo guardar. Revisa que tu navegador permita almacenamiento.';
    return;
  }

  formMsg.classList.remove('error');
  formMsg.textContent = '';
  form.reset();
  $('#fC1').value = '#F42A8F';
  $('#fC2').value = '#FFB8DC';
  actualizarPreview();
  render();
  aviso(`"${producto.nombre}" ya está en la tienda 🍬`);
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
    <div class="admin-item">
      <button type="button" class="card-del" data-id="${esc(p.id)}"
        aria-label="Quitar ${esc(p.nombre)}" title="Quitar del catálogo">✕</button>
      ${cardHTML(p)}
    </div>`).join('');
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
  const btn = e.target.closest('.card-del');
  if(!btn) return;

  const producto = CandyDB.todos().find(p => p.id === btn.dataset.id);
  if(!producto) return;

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
      render();
      aviso('Catálogo original restaurado 🔄');
    }
  );
});

/* ---------------------------------------------------------
   9. Menú móvil + año del footer
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
   10. Si ya hay sesión abierta, entra directo
   (va al final: render() necesita todo lo definido arriba)
   --------------------------------------------------------- */
try{
  if(sessionStorage.getItem(SESION) === '1') abrirPanel();
}catch(err){ /* modo privado: pedirá la clave */ }
