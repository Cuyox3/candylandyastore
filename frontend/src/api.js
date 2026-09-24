/* =========================================================
   Candylandia Store — acceso al API

   Todo lo que hable con el backend pasa por aquí. Un solo sitio donde está
   escrito de dónde salen los datos, cómo se manda el token y qué hacer cuando
   la respuesta viene mal.

   La URL base es relativa a propósito: en producción el nginx del contenedor
   sirve el front y hace de proxy a /api/, así que el navegador nunca ve otro
   dominio. En desarrollo, el proxy de Vite hace lo mismo contra :8000.
   ========================================================= */

const BASE = '/api/v1';
const LLAVE_TOKEN = 'candylandia_token';

/* ---------------------------------------------------------
   Token de sesión del panel
   Se guarda en localStorage y NO en una cookie porque no hay
   nada que el servidor necesite leer solo: lo manda el front
   en la cabecera Authorization.
   --------------------------------------------------------- */
export const sesion = {
  leer() {
    try { return localStorage.getItem(LLAVE_TOKEN) || ''; }
    catch (err) { return ''; }          // modo privado
  },
  guardar(token) {
    try { localStorage.setItem(LLAVE_TOKEN, token); } catch (err) { /* nada */ }
  },
  borrar() {
    try { localStorage.removeItem(LLAVE_TOKEN); } catch (err) { /* nada */ }
  }
};

/* Se dispara cuando el servidor rechaza el token: el panel lo escucha para
   devolver al usuario a la pantalla de acceso sin que el resto del código
   tenga que acordarse de comprobarlo en cada llamada. */
export const EVENTO_SIN_SESION = 'candylandia:sin-sesion';

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado;
  }
}

async function peticion(ruta, opciones = {}) {
  const { autenticada = false, cuerpo, formulario, ...resto } = opciones;

  const cabeceras = { ...(resto.headers || {}) };
  if (cuerpo !== undefined) cabeceras['Content-Type'] = 'application/json';
  if (autenticada) {
    const token = sesion.leer();
    if (token) cabeceras.Authorization = `Bearer ${token}`;
  }

  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      ...resto,
      headers: cabeceras,
      body: formulario !== undefined ? formulario
          : cuerpo !== undefined ? JSON.stringify(cuerpo)
          : undefined
    });
  } catch (err) {
    /* fetch sólo falla así cuando no hubo respuesta: servidor caído, sin red
       o el navegador cortó la petición. Un 500 NO entra por aquí. */
    throw new ErrorApi('No se pudo conectar con el servidor. ¿Está encendido?', 0);
  }

  if (respuesta.status === 401 && autenticada) {
    sesion.borrar();
    window.dispatchEvent(new CustomEvent(EVENTO_SIN_SESION));
  }

  if (respuesta.status === 204) return null;

  const tipo = respuesta.headers.get('content-type') || '';
  const datos = tipo.includes('application/json')
    ? await respuesta.json().catch(() => null)
    : await respuesta.text();

  if (!respuesta.ok) {
    const detalle = (datos && datos.detail) || (typeof datos === 'string' && datos)
      || `El servidor respondió ${respuesta.status}.`;
    throw new ErrorApi(detalle, respuesta.status);
  }

  return datos;
}

/* ---------------------------------------------------------
   Tienda (público)
   --------------------------------------------------------- */
export const api = {
  config:      ()        => peticion('/config'),
  categorias:  ()        => peticion('/categorias'),
  etiquetas:   ()        => peticion('/etiquetas'),

  productos(cat = 'todos', buscar = '') {
    const params = new URLSearchParams();
    if (cat && cat !== 'todos') params.set('cat', cat);
    if (buscar) params.set('buscar', buscar);
    const cola = params.toString();
    return peticion('/productos' + (cola ? `?${cola}` : ''));
  },

  suscribir: (email)     => peticion('/suscriptores', { method:'POST', cuerpo:{ email } }),
  contacto:  (datos)     => peticion('/mensajes',     { method:'POST', cuerpo:datos }),

  /* ---------------------------------------------------------
     Panel (requiere token)
     --------------------------------------------------------- */
  login: (usuario, password) =>
    peticion('/auth/login', { method:'POST', cuerpo:{ usuario, password } }),

  yo: () => peticion('/auth/yo', { autenticada:true }),

  cambiarPassword: (password_actual, password_nueva) =>
    peticion('/auth/password', { method:'POST', autenticada:true,
      cuerpo:{ password_actual, password_nueva } }),

  crearProducto: (datos) =>
    peticion('/productos', { method:'POST', autenticada:true, cuerpo:datos }),

  editarProducto: (id, datos) =>
    peticion(`/productos/${encodeURIComponent(id)}`, { method:'PATCH', autenticada:true, cuerpo:datos }),

  quitarProducto: (id) =>
    peticion(`/productos/${encodeURIComponent(id)}`, { method:'DELETE', autenticada:true }),

  exportar:  ()      => peticion('/catalogo/exportar',  { autenticada:true }),
  importar:  (lista) => peticion('/catalogo/importar',  { method:'POST', autenticada:true, cuerpo:{ productos:lista } }),
  restaurar: ()      => peticion('/catalogo/restaurar', { method:'POST', autenticada:true }),

  subirImagen(archivo) {
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    /* Sin Content-Type: lo pone el navegador con el boundary del multipart.
       Escribirlo a mano rompe la subida de una forma difícil de ver. */
    return peticion('/imagenes', { method:'POST', autenticada:true, formulario });
  },

  borrarImagen: (ruta) =>
    peticion(`/imagenes?ruta=${encodeURIComponent(ruta)}`, { method:'DELETE', autenticada:true })
};
