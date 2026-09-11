# 🍬 Candylandia Store — Landing Page

Landing page responsiva para una tienda de **dulces de importación**, lista para publicarse en **GitHub Pages** sin configuración adicional.

## 📁 Estructura

```
candylandia-store/
├── index.html      ← la página completa
├── admin.html      ← panel de administración de productos
├── styles.css      ← estilos y responsive (tienda + panel)
├── productos.js    ← catálogo de productos (lo comparten la tienda y el panel)
├── script.js       ← render de la tienda, filtros, menú y formularios
├── admin.js        ← lógica del panel (alta, baja, exportar/importar)
├── .nojekyll       ← evita que GitHub Pages procese el sitio con Jekyll
└── assets/
    ├── logo.png    ← logo de la marca
    └── mascota.png ← mascota "Candy"
```

## 🚀 Publicar en GitHub Pages (3 pasos)

1. Crea un repositorio nuevo en GitHub (por ejemplo `candylandia-store`).
2. Sube **el contenido de esta carpeta** a la raíz del repo (que `index.html` quede en la raíz, no dentro de otra carpeta):

   ```bash
   git init
   git add .
   git commit -m "Landing page Candylandia Store"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/candylandia-store.git
   git push -u origin main
   ```

3. En GitHub ve a **Settings → Pages** y en *Build and deployment* elige:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` · carpeta `/ (root)` → **Save**

En 1–2 minutos el sitio queda en:
`https://TU-USUARIO.github.io/candylandia-store/`

> No hay que compilar nada: todo es HTML, CSS y JS puro, con rutas relativas.

## ✏️ Qué personalizar

| Qué | Dónde |
|---|---|
| Número de WhatsApp | `script.js` → `CONFIG.whatsapp` (formato `52` + 10 dígitos, sin `+` ni espacios) |
| Nombre del negocio en los mensajes | `script.js` → `CONFIG.negocio` |
| Productos (nombre, precio, país, descripción, emoji, colores) | **panel `admin.html`**, o a mano en `productos.js` → arreglo `PRODUCTOS_BASE` |
| Categorías de los filtros | `productos.js` → arreglo `CATEGORIAS` (los botones de filtro se generan solos) |
| Clave del panel de administración | `admin.js` → `ADMIN.clave` |
| Correo, dirección y horarios | sección `#contacto` en `index.html` |
| Redes sociales | bloque `.socials` en `index.html` (cambia los `href="#"`) |
| Precios de las cajas sorpresa | sección `#cajas` en `index.html` (hoy comentada) |
| Colores de la marca | `styles.css` → variables en `:root` |

## 🛠️ Panel de administración

Abre `admin.html` (también hay un enlace al final del footer de la tienda) para **agregar y quitar productos** sin tocar código. Usa exactamente el mismo diseño, colores y tarjetas que la tienda.

- **Clave de acceso:** se configura en `admin.js` → `ADMIN.clave` (por defecto `candylandia2021`).
- **Agregar:** llena el formulario (nombre, categoría, precio, país, emoji, descripción, etiqueta y colores) y verás una **vista previa en vivo** de la tarjeta antes de guardar. El producto queda al inicio del catálogo.
- **Quitar:** pulsa la **✕** de cualquier tarjeta y confirma.
- **Buscar:** filtra por nombre, país o categoría.
- **Restaurar:** vuelve al catálogo original de `productos.js`.

### 💾 Cómo se guardan los cambios

El sitio es estático (GitHub Pages no tiene base de datos), así que los cambios del panel se guardan en el **`localStorage` del navegador donde los hiciste**. Los ve quien usa ese navegador, no el resto de los visitantes.

Para publicarlos de verdad:

1. En el panel pulsa **Exportar catálogo** y copia el JSON.
2. Pégalo en `productos.js`, reemplazando el contenido del arreglo `PRODUCTOS_BASE`.
3. Haz commit y push; GitHub Pages se actualiza solo.

El botón **Importar** hace lo contrario: pega un JSON y reemplaza el catálogo de ese navegador (útil para pasar el catálogo de una computadora a otra).

> ⚠️ La clave es solo una traba para entradas casuales: al ser un sitio estático, viaja dentro del JavaScript y cualquiera que revise el código puede leerla. No es una medida de seguridad real, y tampoco hace falta que lo sea: nadie puede modificar el sitio publicado desde el panel.

## 🙈 Sección oculta: Cajas sorpresa

La sección **Cajas sorpresa / suscripción** sigue en el repo pero está **comentada**, así que no se ve en el sitio. Para reactivarla busca `CAJAS SORPRESA` en `index.html` y descomenta los 5 puntos:

1. El bloque grande `<section id="cajas">` (quita la línea de apertura del comentario y la de cierre `===== FIN CAJAS SORPRESA (OCULTA) ===== -->`).
2. El enlace del menú principal.
3. El enlace del footer.
4. El mensaje de la barra promocional (aparece 2 veces, por la animación en bucle).
5. La opción `Caja sorpresa / suscripción` del formulario de contacto.

También hay un testimonio cuyo texto original mencionaba la caja; quedó comentado justo arriba del texto actual por si quieres restaurarlo.

## 🧩 Secciones incluidas

- Barra promocional animada
- Menú fijo con navegación móvil (hamburguesa)
- Hero con la mascota y países de origen
- Beneficios / propuesta de valor
- **Nosotros** (historia, misión, visión, valores)
- **Productos** con filtros por país y botón directo a WhatsApp
- **Panel de administración** (`admin.html`) para dar de alta y baja productos
- ~~Cajas sorpresa / suscripción mensual (3 planes)~~ *(comentada, ver arriba)*
- Mayoreo para tiendas y revendedores
- Testimonios
- Preguntas frecuentes (acordeón)
- Newsletter
- **Contáctanos** con formulario que abre WhatsApp con el mensaje ya redactado
- Footer completo + botón flotante de WhatsApp y "volver arriba"

## 💬 Sobre el formulario

GitHub Pages es hosting estático (no ejecuta código de servidor), así que el formulario **arma el mensaje y lo abre en WhatsApp**: funciona desde el primer minuto y sin costo.

Si prefieres recibirlo por correo, crea una cuenta gratis en [Formspree](https://formspree.io) y en `index.html` cambia el formulario por:

```html
<form class="contact-form" action="https://formspree.io/f/TU-ID" method="POST">
```

(y quita el `id="contactForm"` para que `script.js` no intercepte el envío).

## 📱 Responsive

Probado en tres puntos de quiebre: escritorio (>1024px), tableta (900px) y móvil (<600px). Respeta `prefers-reduced-motion` para usuarios que desactivan animaciones.
