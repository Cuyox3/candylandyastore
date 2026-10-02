/* =========================================================
   Candylandia Store — configuración del front

   Equivale al objeto CONFIG del script.js clásico. El número de WhatsApp lo
   manda el backend (/api/v1/config) para no tenerlo escrito en dos sitios;
   esto es el valor por defecto mientras esa respuesta llega, y el que se usa
   si el API no contesta.
   ========================================================= */

export const CONFIG = {
  whatsapp: '5215630450041',
  negocio: 'Candylandia Store',
  correo: 'candylandiaviveros@gmail.com',
  direccion: 'C. Viveros de la Hacienda 35, Habit. Viveros del Valle, 54060 Tlalnepantla, Méx.',
  /* ¿Puede el servidor mandar correos? Lo dice /api/v1/config al arrancar.
     Empieza en false para no enseñar el botón de «Enviar por correo» durante
     el parpadeo inicial si resulta que el SMTP no está configurado. */
  correoActivo: false
};

export function waLink(texto) {
  return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(texto);
}

/* El número como se escribe, a partir del que usa WhatsApp.

   Se calcula en vez de llevarlo escrito aparte porque CONFIG.whatsapp lo pisa
   el backend al arrancar (/api/v1/config): con el número a mano en el marcado,
   cambiarlo en el .env dejaba la tienda enseñando el viejo. */
export function telefonoBonito(numero = CONFIG.whatsapp) {
  const digitos = String(numero).replace(/\D/g, '');
  // Los móviles de México van a WhatsApp como 52 + 1 + diez dígitos. Ese 1 es
  // cosa de WhatsApp y no se marca, así que tampoco se enseña.
  const nacional = digitos.replace(/^521?/, '');
  if (nacional.length !== 10) return '+' + digitos;   // otro país: se deja crudo
  return `+52 ${nacional.slice(0, 2)} ${nacional.slice(2, 6)} ${nacional.slice(6)}`;
}

/* Enlace al mapa, con la app que le toque a cada quien.

   En iPhone y iPad se abre Mapas (maps.apple.com); en lo demás, Google Maps.
   Mandar a un iPhone a Google Maps no es un desastre, pero si no tiene la app
   instalada acaba en el navegador pidiendo que se la descargue, cuando el
   sistema ya trae un mapa que sabe abrir esa dirección.

   La detección mira también `maxTouchPoints` porque el iPad de iPadOS 13 en
   adelante miente en el userAgent y se presenta como un Mac de escritorio;
   sin esa comprobación, a los iPad se les manda a Google Maps. */
export function esApple() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

export function mapaUrl(direccion = CONFIG.direccion) {
  const q = encodeURIComponent(direccion);
  return esApple()
    ? `https://maps.apple.com/?q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/* =========================================================
   Las redes de la tienda, en un solo sitio.

   Viven aquí y no repartidas por el marcado para que cambiar una cuenta sea
   tocar una línea, no buscarla en el contacto y en el pie. Cada una lleva su
   color de marca, que es lo que pinta el degradado de la pastilla.

   `rel="noopener"` lo pone el componente que las dibuja: sin eso, la página
   que se abre puede manipular la nuestra desde window.opener.
   ========================================================= */
export const REDES = [
  {
    nombre: 'Facebook',
    emoji: '👍',
    url: 'https://www.facebook.com/share/19ZWkt2otA/?mibextid=wwXIfr',
    c1: '#1877F2', c2: '#6BA8F7'
  },
  {
    nombre: 'Instagram',
    emoji: '📸',
    url: 'https://www.instagram.com/candylandiastoremx?stkn=MnpuZXoyM2VrcjRh',
    c1: '#E1306C', c2: '#F7A8C4'
  },
  {
    nombre: 'TikTok',
    emoji: '🎵',
    url: 'https://www.tiktok.com/@candylandiastoremx?_r=1',
    c1: '#010101', c2: '#69C9D0'
  },
  {
    /* El /c/ de este enlace no es un número de teléfono: abre el CATÁLOGO de
       WhatsApp Business, que es otra pantalla distinta a la del chat. El chat
       normal es el de waLink(), y los dos conviven a propósito. */
    nombre: 'Catálogo en WhatsApp',
    emoji: '🛍️',
    url: 'https://wa.me/c/5215630450041',
    c1: '#25D366', c2: '#8FF0B4'
  }
];

/* Emojis sugeridos en el formulario del panel (venían de admin.js) */
export const EMOJIS = ['🍫','🍬','🍭','🍪','🍡','🧁','🍩','🥤','🧋','🍜','🌈','🔥','🍯','🥜','🥚','🐻','🍮','🍊','🍓','🧃'];

/* Combinaciones de color sugeridas para el degradado de la tarjeta */
export const PALETAS = [
  ['#F42A8F','#FFB8DC'], ['#29B6E8','#BEEBFB'], ['#A05CD6','#E4CBF7'],
  ['#FFC93C','#FFF0B8'], ['#FF8A29','#FFD8AE'], ['#8FD98A','#D9F5C7'],
  ['#FF6B6B','#FFC9C9'], ['#6E5A8C','#D6CDE8']
];
