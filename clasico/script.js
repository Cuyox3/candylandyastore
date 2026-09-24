/* =========================================================
   Candylandia Store — script principal
   Edita CONFIG para personalizar el sitio sin tocar el HTML.
   ========================================================= */

const CONFIG = {
  // Número de WhatsApp en formato internacional, solo dígitos (52 = México)
  whatsapp: '5215512345678',
  negocio: 'Candylandia Store'
};

/* ---------------------------------------------------------
   1. Render de productos
   El catálogo vive en productos.js y puede editarse desde
   el panel de administración (admin.html).
   --------------------------------------------------------- */
const grid    = document.getElementById('products');
const filtros = document.getElementById('filters');

function waLink(texto){
  return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(texto);
}

/* Escapa texto para poder inyectarlo en el HTML sin romper la tarjeta */
function esc(txt){
  return String(txt).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

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
          <button class="card-btn" data-nombre="${esc(p.nombre)}">Lo quiero</button>
        </div>
      </div>
    </article>`;
}

function renderFiltros(){
  if(!filtros) return;
  filtros.innerHTML =
    '<button class="filter active" data-filter="todos">Todos</button>' +
    CATEGORIAS.map(c =>
      `<button class="filter" data-filter="${esc(c.id)}">${esc(c.label)}</button>`
    ).join('');
}

function renderProductos(filtro){
  if(!grid) return;
  const lista = CandyDB.porCategoria(filtro);

  grid.innerHTML = lista.length
    ? lista.map(cardHTML).join('')
    : '<p style="grid-column:1/-1;text-align:center;color:#6B5573">Pronto agregaremos productos de esta categoría 🍬</p>';

  /* Si una foto aún no está en la carpeta, usa la copia del navegador */
  CandyImg.aplicarRespaldos(grid);
}

renderFiltros();
renderProductos('todos');

/* Filtros */
if(filtros){
  filtros.addEventListener('click', e => {
    const btn = e.target.closest('.filter');
    if(!btn) return;
    filtros.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProductos(btn.dataset.filter);
  });
}

/* Botón "Lo quiero" de cada producto → WhatsApp */
if(grid){
  grid.addEventListener('click', e => {
    const btn = e.target.closest('.card-btn');
    if(!btn) return;
    const msg = `¡Hola ${CONFIG.negocio}! 🍬 Me interesa el producto: ${btn.dataset.nombre}. ¿Tienen disponible?`;
    window.open(waLink(msg), '_blank', 'noopener');
  });
}

/* ---------------------------------------------------------
   2. Menú móvil
   --------------------------------------------------------- */
const burger = document.getElementById('burger');
const navLinks = document.getElementById('navLinks');

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

/* ---------------------------------------------------------
   3. Navbar con sombra + link activo + botón "subir"
   --------------------------------------------------------- */
const navbar   = document.getElementById('navbar');
const toTop    = document.getElementById('toTop');
const secciones = [...document.querySelectorAll('section[id]')];
const enlaces   = [...navLinks.querySelectorAll('a:not(.nav-cta)')];

function onScroll(){
  const y = window.scrollY;
  navbar.classList.toggle('scrolled', y > 12);
  toTop.classList.toggle('show', y > 600);

  let actual = '';
  secciones.forEach(sec => {
    if(y >= sec.offsetTop - 140) actual = sec.id;
  });
  enlaces.forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + actual);
  });
}
window.addEventListener('scroll', onScroll, { passive:true });
onScroll();

toTop.addEventListener('click', () => window.scrollTo({ top:0, behavior:'smooth' }));

/* ---------------------------------------------------------
   4. Animación de aparición al hacer scroll
   --------------------------------------------------------- */
const observer = new IntersectionObserver((entradas) => {
  entradas.forEach(en => {
    if(en.isIntersecting){
      en.target.classList.add('visible');
      observer.unobserve(en.target);
    }
  });
}, { threshold:0.12, rootMargin:'0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

/* ---------------------------------------------------------
   5. Formulario de contacto → arma el mensaje de WhatsApp
   (Funciona en GitHub Pages sin servidor ni backend)
   --------------------------------------------------------- */
const contactForm = document.getElementById('contactForm');
const contactMsg  = document.getElementById('contactMsg');

contactForm.addEventListener('submit', e => {
  e.preventDefault();
  const campos = ['nombre','email','motivo','mensaje'];
  let valido = true;

  campos.forEach(id => {
    const el = document.getElementById(id);
    const vacio = !el.value.trim();
    const correoMal = (id === 'email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value.trim());
    const error = vacio || correoMal;
    el.classList.toggle('invalid', error);
    if(error) valido = false;
  });

  if(!valido){
    contactMsg.textContent = 'Revisa los campos marcados, por favor.';
    contactMsg.classList.add('error');
    return;
  }

  const tel = document.getElementById('tel').value.trim();
  const texto =
`¡Hola ${CONFIG.negocio}! 🍭
Nombre: ${document.getElementById('nombre').value.trim()}
Correo: ${document.getElementById('email').value.trim()}${tel ? '\nTeléfono: ' + tel : ''}
Motivo: ${document.getElementById('motivo').value}
Mensaje: ${document.getElementById('mensaje').value.trim()}`;

  window.open(waLink(texto), '_blank', 'noopener');

  contactMsg.classList.remove('error');
  contactMsg.textContent = '¡Listo! Abrimos WhatsApp con tu mensaje. 💬';
  contactForm.reset();
});

/* ---------------------------------------------------------
   6. Newsletter (demo, guarda el correo en el navegador)
   --------------------------------------------------------- */
const newsForm = document.getElementById('newsletterForm');
const newsMsg  = document.getElementById('newsMsg');

newsForm.addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('newsEmail');
  const valor = input.value.trim();

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)){
    newsMsg.textContent = 'Escribe un correo válido para suscribirte.';
    newsMsg.classList.add('error');
    return;
  }

  try{
    const previos = JSON.parse(localStorage.getItem('candylandia_subs') || '[]');
    if(!previos.includes(valor)) previos.push(valor);
    localStorage.setItem('candylandia_subs', JSON.stringify(previos));
  }catch(err){ /* modo privado: no pasa nada */ }

  newsMsg.classList.remove('error');
  newsMsg.textContent = '¡Gracias! Ya eres parte del club dulce 🍬';
  newsForm.reset();
});

/* ---------------------------------------------------------
   7. Año del footer
   --------------------------------------------------------- */
document.getElementById('year').textContent = new Date().getFullYear();
