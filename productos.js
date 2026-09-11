/* =========================================================
   Candylandia Store — catálogo de productos
   Este archivo lo usan la tienda (index.html) y el panel
   de administración (admin.html).

   · PRODUCTOS_BASE  → catálogo "de fábrica" que viaja en el código.
   · CandyDB         → guarda los cambios del panel en el navegador
                       (localStorage) sin necesidad de servidor.

   Los productos que agregues desde el panel viven en TU navegador.
   Para que los vea todo el mundo, usa "Exportar catálogo" en el panel
   y pega el resultado dentro de PRODUCTOS_BASE aquí abajo.
   ========================================================= */

/* Categorías disponibles (se usan en los filtros y en el panel) */
const CATEGORIAS = [
  { id:'japon',   label:'🇯🇵 Japón' },
  { id:'corea',   label:'🇰🇷 Corea' },
  { id:'usa',     label:'🇺🇸 Estados Unidos' },
  { id:'europa',  label:'🇪🇺 Europa' },
  { id:'bebidas', label:'🥤 Bebidas' }
];

/* Etiquetas disponibles para la esquina de la tarjeta */
const ETIQUETAS = [
  { tipo:'',      etiqueta:'',           label:'Sin etiqueta' },
  { tipo:'nuevo', etiqueta:'Nuevo',      label:'Nuevo (cian)' },
  { tipo:'top',   etiqueta:'Top ventas', label:'Top ventas (amarillo)' }
];

/* ---------------------------------------------------------
   CATÁLOGO BASE
   Para agregar uno a mano, copia un bloque y cambia los datos.
   cat: japon | corea | usa | europa | bebidas
   --------------------------------------------------------- */
const PRODUCTOS_BASE = [
  { id:'p-kitkat-matcha', cat:'japon', emoji:'🍫', nombre:'Kit Kat Matcha', origen:'Japón',
    desc:'Chocolate blanco con té verde de Uji. El clásico que todos piden.',
    precio:89, etiqueta:'Top ventas', tipo:'top', c1:'#8FD98A', c2:'#D9F5C7' },

  { id:'p-hichew', cat:'japon', emoji:'🍡', nombre:'Hi-Chew Surtido', origen:'Japón',
    desc:'Caramelo masticable de fresa, uva y mango. Sabor intenso de verdad.',
    precio:65, etiqueta:'', tipo:'', c1:'#FF8AC4', c2:'#FFD6EA' },

  { id:'p-pocky-fresa', cat:'japon', emoji:'🍜', nombre:'Pocky Fresa', origen:'Japón',
    desc:'Palitos crujientes bañados en crema de fresa. Ideal para compartir.',
    precio:52, etiqueta:'', tipo:'', c1:'#F42A8F', c2:'#FFB8DC' },

  { id:'p-peach-ring', cat:'corea', emoji:'🍬', nombre:'Gomitas Peach Ring', origen:'Corea',
    desc:'Aros de durazno con azúcar ácida. Suaves, jugosas y adictivas.',
    precio:79, etiqueta:'Nuevo', tipo:'nuevo', c1:'#FFB36B', c2:'#FFE3C2' },

  { id:'p-buldak', cat:'corea', emoji:'🔥', nombre:'Ramen Picante Buldak', origen:'Corea',
    desc:'El reto viral de fideos extra picantes. Ten leche a la mano.',
    precio:75, etiqueta:'Top ventas', tipo:'top', c1:'#FF6B6B', c2:'#FFC9C9' },

  { id:'p-honey-butter', cat:'corea', emoji:'🍯', nombre:'Honey Butter Chips', origen:'Corea',
    desc:'Papas con miel y mantequilla. El snack dulce-salado más famoso.',
    precio:98, etiqueta:'', tipo:'', c1:'#FFC93C', c2:'#FFF0B8' },

  { id:'p-reeses', cat:'usa', emoji:'🥜', nombre:'Reese’s Big Cup', origen:'Estados Unidos',
    desc:'Chocolate con leche relleno de crema de cacahuate. Un clásico eterno.',
    precio:59, etiqueta:'', tipo:'', c1:'#E08A3C', c2:'#FFD9A8' },

  { id:'p-nerds-clusters', cat:'usa', emoji:'🌈', nombre:'Nerds Gummy Clusters', origen:'Estados Unidos',
    desc:'Gomita suave forrada de nerds crujientes. Textura brutal.',
    precio:139, etiqueta:'Top ventas', tipo:'top', c1:'#A05CD6', c2:'#E4CBF7' },

  { id:'p-oreo-limitada', cat:'usa', emoji:'🍪', nombre:'Oreo Edición Limitada', origen:'Estados Unidos',
    desc:'Sabores que solo salen unos meses al año. Pregunta por el del mes.',
    precio:115, etiqueta:'Nuevo', tipo:'nuevo', c1:'#6E5A8C', c2:'#D6CDE8' },

  { id:'p-kinder-maxi', cat:'europa', emoji:'🥚', nombre:'Kinder Sorpresa Maxi', origen:'Italia',
    desc:'Chocolate con leche y juguete coleccionable en versión grande.',
    precio:129, etiqueta:'', tipo:'', c1:'#FF8A29', c2:'#FFD8AE' },

  { id:'p-haribo', cat:'europa', emoji:'🐻', nombre:'Haribo Alemán Original', origen:'Alemania',
    desc:'Los ositos de oro de la receta europea. Se nota la diferencia.',
    precio:95, etiqueta:'', tipo:'', c1:'#FFC93C', c2:'#FFF2C4' },

  { id:'p-toffifee', cat:'europa', emoji:'🍮', nombre:'Toffifee Caja 15', origen:'Alemania',
    desc:'Caramelo, avellana, crema de nuez y chocolate en un solo bocado.',
    precio:149, etiqueta:'', tipo:'', c1:'#C98A5E', c2:'#F0DAC4' },

  { id:'p-ramune', cat:'bebidas', emoji:'🥤', nombre:'Ramune Original', origen:'Japón',
    desc:'La soda de la canica. Divertida de abrir y refrescante de tomar.',
    precio:69, etiqueta:'Top ventas', tipo:'top', c1:'#29B6E8', c2:'#BEEBFB' },

  { id:'p-milkis-melon', cat:'bebidas', emoji:'🧋', nombre:'Milkis Melón', origen:'Corea',
    desc:'Soda cremosa de yogurt con melón. Suave, burbujeante y distinta.',
    precio:55, etiqueta:'Nuevo', tipo:'nuevo', c1:'#9FE08A', c2:'#E2F7D4' },

  { id:'p-fanta-mundo', cat:'bebidas', emoji:'🍊', nombre:'Fanta Sabores del Mundo', origen:'Europa / Asia',
    desc:'Sabores que no existen en México: piña, sandía, manzana verde.',
    precio:62, etiqueta:'', tipo:'', c1:'#FF6B35', c2:'#FFD1BB' },

  { id:'p-paleta-gigante', cat:'usa', emoji:'🍭', nombre:'Paleta Gigante Arcoíris', origen:'Estados Unidos',
    desc:'La paleta espiral de 30 cm. Perfecta para fotos y para regalar.',
    precio:99, etiqueta:'', tipo:'', c1:'#F42A8F', c2:'#7FDBFF' }
];

/* ---------------------------------------------------------
   CandyDB — almacenamiento del catálogo en el navegador
   --------------------------------------------------------- */
const CandyDB = (function(){
  const KEY = 'candylandia_productos_v1';

  function clonarBase(){
    return PRODUCTOS_BASE.map(p => Object.assign({}, p));
  }

  function normalizar(p){
    return {
      id:       String(p.id || nuevoId(p.nombre)),
      cat:      String(p.cat || 'japon'),
      emoji:    String(p.emoji || '🍬'),
      nombre:   String(p.nombre || 'Sin nombre'),
      origen:   String(p.origen || ''),
      desc:     String(p.desc || ''),
      precio:   Number(p.precio) || 0,
      etiqueta: String(p.etiqueta || ''),
      tipo:     String(p.tipo || ''),
      c1:       String(p.c1 || '#F42A8F'),
      c2:       String(p.c2 || '#FFB8DC')
    };
  }

  function nuevoId(nombre){
    const slug = String(nombre || 'producto')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'producto';
    return slug + '-' + Date.now().toString(36).slice(-4);
  }

  function leer(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return null;
      const lista = JSON.parse(raw);
      return Array.isArray(lista) ? lista.map(normalizar) : null;
    }catch(err){
      return null; // modo privado o dato corrupto: usamos el catálogo base
    }
  }

  function escribir(lista){
    try{
      localStorage.setItem(KEY, JSON.stringify(lista));
      return true;
    }catch(err){
      return false;
    }
  }

  return {
    /* Todos los productos (los guardados o, si no hay, el catálogo base) */
    todos(){
      return leer() || clonarBase();
    },

    /* Productos de una categoría ('todos' devuelve el catálogo completo) */
    porCategoria(cat){
      const lista = this.todos();
      return (cat === 'todos') ? lista : lista.filter(p => p.cat === cat);
    },

    /* Agrega un producto nuevo al inicio del catálogo */
    agregar(datos){
      const producto = normalizar(Object.assign({}, datos, { id: nuevoId(datos.nombre) }));
      const lista = this.todos();
      lista.unshift(producto);
      return escribir(lista) ? producto : null;
    },

    /* Quita un producto por id. Devuelve el producto eliminado o null */
    quitar(id){
      const lista = this.todos();
      const i = lista.findIndex(p => p.id === id);
      if(i === -1) return null;
      const [fuera] = lista.splice(i, 1);
      return escribir(lista) ? fuera : null;
    },

    /* Reemplaza todo el catálogo (importar) */
    reemplazar(lista){
      if(!Array.isArray(lista)) return false;
      return escribir(lista.map(normalizar));
    },

    /* Vuelve al catálogo original del código */
    restaurar(){
      try{ localStorage.removeItem(KEY); }catch(err){ /* nada */ }
      return clonarBase();
    },

    /* true si hay cambios guardados en este navegador */
    hayCambios(){
      return leer() !== null;
    },

    /* JSON listo para pegar en PRODUCTOS_BASE */
    exportar(){
      return JSON.stringify(this.todos(), null, 2);
    },

    base: clonarBase,
    nuevoId
  };
})();
