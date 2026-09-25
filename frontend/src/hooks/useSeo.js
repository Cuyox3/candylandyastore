import { useEffect } from 'react';

/* =========================================================
   Lo que cada ruta le cuenta a los buscadores.

   index.html trae la cabecera de la TIENDA escrita en crudo, que es lo que
   ven los robots que no ejecutan JavaScript. Este hook existe para la otra
   mitad del problema: la aplicación tiene dos rutas (/ y /admin) y un solo
   index.html, así que cuando alguien entra al panel hay que cambiar el
   título, la descripción, la dirección canónica y el `robots` — y devolverlo
   todo a su sitio al salir. Si no, volver del panel a la tienda dejaría la
   página principal anunciándose como «Panel de administración» y, lo que es
   peor, con un `noindex` pegado.

   Es un react-helmet de tres funciones. La librería entera son 8 KB para
   hacer esto mismo en un sitio que tiene dos páginas.
   ========================================================= */

/* El dominio va completo y escrito aquí, no sacado de window.location: si se
   dedujera del navegador, quien entrara por www.candylandiastore.mx recibiría
   una canónica que apunta a www, y entonces Google vería dos sitios iguales
   en vez de uno. Tiene que coincidir con DOMAIN del .env. */
const RAIZ = (import.meta.env?.VITE_SITE_URL || 'https://candylandiastore.mx')
  .replace(/\/+$/, '');

export const SITIO = {
  url: RAIZ,
  nombre: 'Candylandia Store',
  imagen: `${RAIZ}/assets/og-candylandia.jpg`
};

/** Convierte '/api/v1/fotos/p-x' en una dirección absoluta. Las `data:` y las
 *  que ya vienen absolutas se devuelven tal cual; una `data:` no sirve para
 *  los datos estructurados, así que el que llama la descarta. */
export function absoluta(ruta) {
  if (!ruta) return '';
  if (/^(https?:|data:)/.test(ruta)) return ruta;
  return RAIZ + (ruta.startsWith('/') ? ruta : `/${ruta}`);
}

/* --- acceso a las etiquetas del <head> ------------------------------------
   Se busca la que ya existe antes de crear una nueva: index.html trae casi
   todas escritas, y duplicarlas es la forma tonta de que un buscador lea la
   equivocada. */
function obtener(selector, construir) {
  let nodo = document.head.querySelector(selector);
  if (!nodo) {
    nodo = construir();
    nodo.dataset.seo = 'runtime';   // marca para saber que la puso el código
    document.head.appendChild(nodo);
  }
  return nodo;
}

function meta(nombre, atributo = 'name') {
  return obtener(`meta[${atributo}="${nombre}"]`, () => {
    const el = document.createElement('meta');
    el.setAttribute(atributo, nombre);
    return el;
  });
}

function canonico() {
  return obtener('link[rel="canonical"]', () => {
    const el = document.createElement('link');
    el.rel = 'canonical';
    return el;
  });
}

/**
 * Pone la cabecera de la ruta y la devuelve a como estaba al desmontarse.
 *
 * @param {object} opciones
 * @param {string} opciones.titulo       <title> y og:title
 * @param {string} opciones.descripcion  meta description y og:description
 * @param {string} opciones.canonica     dirección canónica ABSOLUTA
 * @param {string} opciones.robots       'index, follow…' o 'noindex, nofollow'
 */
export function useSeo({ titulo, descripcion, canonica, robots } = {}) {
  useEffect(() => {
    /* Cada entrada es [cómo leerlo, cómo escribirlo, valor nuevo]. Guardar lo
       anterior ANTES de tocar nada es lo que permite restaurarlo después. */
    const cambios = [];

    const anotar = (nodo, atributo, valor) => {
      if (valor === undefined || valor === null) return;
      cambios.push([nodo, atributo, nodo.getAttribute(atributo)]);
      nodo.setAttribute(atributo, valor);
    };

    const tituloPrevio = document.title;
    if (titulo) document.title = titulo;

    anotar(meta('description'), 'content', descripcion);
    anotar(meta('robots'), 'content', robots);
    anotar(canonico(), 'href', canonica);

    /* Las de redes van detrás de las suyas: og:title y og:description son las
       que usa WhatsApp cuando alguien pega el enlace del panel en un chat. */
    anotar(meta('og:title', 'property'), 'content', titulo);
    anotar(meta('og:description', 'property'), 'content', descripcion);
    anotar(meta('og:url', 'property'), 'content', canonica);
    anotar(meta('twitter:title'), 'content', titulo);
    anotar(meta('twitter:description'), 'content', descripcion);

    return () => {
      document.title = tituloPrevio;
      for (const [nodo, atributo, previo] of cambios) {
        if (previo === null) nodo.removeAttribute(atributo);
        else nodo.setAttribute(atributo, previo);
      }
    };
  }, [titulo, descripcion, canonica, robots]);
}

/**
 * Añade un bloque JSON-LD al <head> mientras el componente esté montado.
 *
 * `datos` tiene que venir memorizado (useMemo) o el objeto será distinto en
 * cada render y el bloque se quitará y se volverá a poner sin parar.
 *
 * @param {string} id     nombre para distinguirlo en el DOM (data-ld)
 * @param {object} datos  el objeto schema.org, o null para no poner nada
 */
export function useJsonLd(id, datos) {
  useEffect(() => {
    if (!datos) return undefined;

    const nodo = document.createElement('script');
    nodo.type = 'application/ld+json';
    nodo.dataset.ld = id;
    /* textContent y no innerHTML: el contenido sale de la base de datos y
       aquí no se está escribiendo HTML, se está escribiendo JSON. */
    nodo.textContent = JSON.stringify(datos);
    document.head.appendChild(nodo);

    return () => nodo.remove();
  }, [id, datos]);
}
