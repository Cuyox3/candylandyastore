/* =========================================================
   Candylandia Store — configuración del front

   Equivale al objeto CONFIG del script.js clásico. El número de WhatsApp lo
   manda el backend (/api/v1/config) para no tenerlo escrito en dos sitios;
   esto es el valor por defecto mientras esa respuesta llega, y el que se usa
   si el API no contesta.
   ========================================================= */

export const CONFIG = {
  whatsapp: '5215512345678',
  negocio: 'Candylandia Store'
};

export function waLink(texto) {
  return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(texto);
}

/* Emojis sugeridos en el formulario del panel (venían de admin.js) */
export const EMOJIS = ['🍫','🍬','🍭','🍪','🍡','🧁','🍩','🥤','🧋','🍜','🌈','🔥','🍯','🥜','🥚','🐻','🍮','🍊','🍓','🧃'];

/* Combinaciones de color sugeridas para el degradado de la tarjeta */
export const PALETAS = [
  ['#F42A8F','#FFB8DC'], ['#29B6E8','#BEEBFB'], ['#A05CD6','#E4CBF7'],
  ['#FFC93C','#FFF0B8'], ['#FF8A29','#FFD8AE'], ['#8FD98A','#D9F5C7'],
  ['#FF6B6B','#FFC9C9'], ['#6E5A8C','#D6CDE8']
];
