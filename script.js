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
   1. CATÁLOGO DE PRODUCTOS (ejemplos)
   Para agregar uno nuevo, copia un bloque y cambia los datos.
   cat: japon | corea | usa | europa | bebidas
   --------------------------------------------------------- */
const PRODUCTOS = [
  { cat:'japon', emoji:'🍫', nombre:'Kit Kat Matcha', origen:'Japón',
    desc:'Chocolate blanco con té verde de Uji. El clásico que todos piden.',
    precio:89, etiqueta:'Top ventas', tipo:'top', c1:'#8FD98A', c2:'#D9F5C7' },

  { cat:'japon', emoji:'🍡', nombre:'Hi-Chew Surtido', origen:'Japón',
    desc:'Caramelo masticable de fresa, uva y mango. Sabor intenso de verdad.',
    precio:65, etiqueta:'', tipo:'', c1:'#FF8AC4', c2:'#FFD6EA' },

  { cat:'japon', emoji:'🍜', nombre:'Pocky Fresa', origen:'Japón',
    desc:'Palitos crujientes bañados en crema de fresa. Ideal para compartir.',
    precio:52, etiqueta:'', tipo:'', c1:'#F42A8F', c2:'#FFB8DC' },

  { cat:'corea', emoji:'🍬', nombre:'Gomitas Peach Ring', origen:'Corea',
    desc:'Aros de durazno con azúcar ácida. Suaves, jugosas y adictivas.',
    precio:79, etiqueta:'Nuevo', tipo:'nuevo', c1:'#FFB36B', c2:'#FFE3C2' },

  { cat:'corea', emoji:'🔥', nombre:'Ramen Picante Buldak', origen:'Corea',
    desc:'El reto viral de fideos extra picantes. Ten leche a la mano.',
    precio:75, etiqueta:'Top ventas', tipo:'top', c1:'#FF6B6B', c2:'#FFC9C9' },

  { cat:'corea', emoji:'🍯', nombre:'Honey Butter Chips', origen:'Corea',
    desc:'Papas con miel y mantequilla. El snack dulce-salado más famoso.',
    precio:98, etiqueta:'', tipo:'', c1:'#FFC93C', c2:'#FFF0B8' },

  { cat:'usa', emoji:'🥜', nombre:'Reese’s Big Cup', origen:'Estados Unidos',
    desc:'Chocolate con leche relleno de crema de cacahuate. Un clásico eterno.',
    precio:59, etiqueta:'', tipo:'', c1:'#E08A3C', c2:'#FFD9A8' },

  { cat:'usa', emoji:'🌈', nombre:'Nerds Gummy Clusters', origen:'Estados Unidos',
    desc:'Gomita suave forrada de nerds crujientes. Textura brutal.',
    precio:139, etiqueta:'Top ventas', tipo:'top', c1:'#A05CD6', c2:'#E4CBF7' },

  { cat:'usa', emoji:'🍪', nombre:'Oreo Edición Limitada', origen:'Estados Unidos',
    desc:'Sabores que solo salen unos meses al año. Pregunta por el del mes.',
    precio:115, etiqueta:'Nuevo', tipo:'nuevo', c1:'#6E5A8C', c2:'#D6CDE8' },

  { cat:'europa', emoji:'🥚', nombre:'Kinder Sorpresa Maxi', origen:'Italia',
    desc:'Chocolate con leche y juguete coleccionable en versión grande.',
    precio:129, etiqueta:'', tipo:'', c1:'#FF8A29', c2:'#FFD8AE' },

  { cat:'europa', emoji:'🐻', nombre:'Haribo Alemán Original', origen:'Alemania',
    desc:'Los ositos de oro de la receta europea. Se nota la diferencia.',
    precio:95, etiqueta:'', tipo:'', c1:'#FFC93C', c2:'#FFF2C4' },

  { cat:'europa', emoji:'🍮', nombre:'Toffifee Caja 15', origen:'Alemania',
    desc:'Caramelo, avellana, crema de nuez y chocolate en un solo bocado.',
    precio:149, etiqueta:'', tipo:'', c1:'#C98A5E', c2:'#F0DAC4' },

  { cat:'bebidas', emoji:'🥤', nombre:'Ramune Original', origen:'Japón',
    desc:'La soda de la canica. Divertida de abrir y refrescante de tomar.',
    precio:69, etiqueta:'Top ventas', tipo:'top', c1:'#29B6E8', c2:'#BEEBFB' },

  { cat:'bebidas', emoji:'🧋', nombre:'Milkis Melón', origen:'Corea',
    desc:'Soda cremosa de yogurt con melón. Suave, burbujeante y distinta.',
    precio:55, etiqueta:'Nuevo', tipo:'nuevo', c1:'#9FE08A', c2:'#E2F7D4' },

  { cat:'bebidas', emoji:'🍊', nombre:'Fanta Sabores del Mundo', origen:'Europa / Asia',
    desc:'Sabores que no existen en México: piña, sandía, manzana verde.',
    precio:62, etiqueta:'', tipo:'', c1:'#FF6B35', c2:'#FFD1BB' },

  { cat:'usa', emoji:'🍭', nombre:'Paleta Gigante Arcoíris', origen:'Estados Unidos',
    desc:'La paleta espiral de 30 cm. Perfecta para fotos y para regalar.',
    precio:99, etiqueta:'', tipo:'', c1:'#F42A8F', c2:'#7FDBFF' }
];

/* ---------------------------------------------------------
   2. Render de productos
   --------------------------------------------------------- */
const grid = document.getElementById('products');

function waLink(texto){
  return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(texto);
}

function cardHTML(p){
  const tag = p.etiqueta
    ? `<span class="tag ${p.tipo}">${p.etiqueta}</span>`
    : '';
  return `
    <article class="card" data-cat="${p.cat}">
      <div class="card-media" style="--c1:${p.c1};--c2:${p.c2}">
        ${tag}
        <span class="emoji">${p.emoji}</span>
      </div>
      <div class="card-body">
        <span class="card-origin">${p.origen}</span>
        <h3>${p.nombre}</h3>
        <p>${p.desc}</p>
        <div class="card-foot">
          <span class="card-price">$${p.precio}</span>
          <button class="card-btn" data-nombre="${p.nombre}">Lo quiero</button>
        </div>
      </div>
    </article>`;
}

function renderProductos(filtro){
  if(!grid) return;
  const lista = (filtro === 'todos')
    ? PRODUCTOS
    : PRODUCTOS.filter(p => p.cat === filtro);

  grid.innerHTML = lista.length
    ? lista.map(cardHTML).join('')
    : '<p style="grid-column:1/-1;text-align:center;color:#6B5573">Pronto agregaremos productos de esta categoría 🍬</p>';
}

renderProductos('todos');

/* Filtros */
const filtros = document.querySelectorAll('.filter');
filtros.forEach(btn => {
  btn.addEventListener('click', () => {
    filtros.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderProductos(btn.dataset.filter);
  });
});

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
   3. Menú móvil
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
   4. Navbar con sombra + link activo + botón "subir"
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
   5. Animación de aparición al hacer scroll
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
   6. Formulario de contacto → arma el mensaje de WhatsApp
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
   7. Newsletter (demo, guarda el correo en el navegador)
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
   8. Año del footer
   --------------------------------------------------------- */
document.getElementById('year').textContent = new Date().getFullYear();
