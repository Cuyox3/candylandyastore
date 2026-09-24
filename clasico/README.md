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
├── admin.js        ← lógica del panel (alta, edición, baja, exportar/importar)
├── imagenes.js     ← fotos de productos (comprimir y guardar en assets/productos/)
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
| Productos (nombre, precio, país, descripción, emoji o foto, colores) | **panel `admin.html`**, o a mano en `productos.js` → arreglo `PRODUCTOS_BASE` |
| Categorías de los filtros | `productos.js` → arreglo `CATEGORIAS` (los botones de filtro se generan solos) |
| Usuario y clave del panel de administración | `admin.js` → `ADMIN.usuario` y `ADMIN.clave` |
| Correo, dirección y horarios | sección `#contacto` en `index.html` |
| Redes sociales | bloque `.socials` en `index.html` (cambia los `href="#"`) |
| Precios de las cajas sorpresa | sección `#cajas` en `index.html` (hoy comentada) |
| Colores de la marca | `styles.css` → variables en `:root` |

## 🛠️ Panel de administración

Abre `admin.html` (también hay un enlace al final del footer de la tienda) para **agregar, modificar y quitar productos** sin tocar código. Usa exactamente el mismo diseño, colores y tarjetas que la tienda.

- **Acceso:** usuario y clave se configuran en `admin.js` → `ADMIN.usuario` y `ADMIN.clave` (por defecto `admin` / `demo123`).
- **Agregar:** llena el formulario (nombre, categoría, precio, país, emoji, descripción, etiqueta y colores) y verás una **vista previa en vivo** de la tarjeta antes de guardar. El producto queda al inicio del catálogo.
- **Foto:** en el formulario puedes **subir una imagen** (o arrastrarla) en lugar del emoji. Se reduce a 560 px y se convierte a WebP automáticamente, y al guardar el producto el archivo se escribe en `assets/productos/`. Ver **🖼️ Fotos de productos** más abajo.
- **Modificar:** pulsa la **✎** de cualquier tarjeta. El producto se carga en el formulario, cambia lo que quieras y pulsa **Guardar cambios** (o **Cancelar edición** para dejarlo como estaba). El id del producto no cambia.
- **Quitar:** pulsa la **✕** de cualquier tarjeta y confirma.
- **Buscar:** filtra por nombre, país o categoría.
- **Restaurar:** vuelve al catálogo original de `productos.js`.

### 🖼️ Fotos de productos

Cada producto puede mostrarse con un **emoji** (lo de siempre) o con una **foto**. Si tiene foto, el producto guarda solo la ruta del archivo, por ejemplo `assets/productos/kit-kat-matcha-a1b2.webp`.

¿Cómo llega el archivo a esa carpeta? El navegador no puede escribir en tu disco por su cuenta, así que hay dos caminos:

| Navegador | Qué pasa al guardar el producto |
|---|---|
| **Chrome / Edge** | La primera vez te pide elegir la **carpeta del proyecto** (botón *Elegir carpeta del proyecto* en el panel). Das permiso una vez y desde entonces las fotos se escriben solas en `assets/productos/`. |
| **Firefox / Safari** | La foto se **descarga** y tú la mueves a `assets/productos/` dentro del proyecto. |

Detalles útiles:

- La imagen se comprime en el navegador (máximo 560 px de lado, WebP): una foto de 4 MB acaba pesando unos 40 KB.
- Se guarda además una **copia reducida en el navegador**, así que la tarjeta se ve bien aunque el archivo aún no esté en su carpeta. Esa copia se borra sola cuando ningún producto usa esa foto.
- Si un producto tiene foto pero el archivo no existe, la tarjeta cae en la copia de respaldo y, si tampoco la hay, **vuelve a mostrar el emoji**. Por eso el emoji sigue siendo obligatorio.
- Para publicar: exporta el catálogo (incluye las rutas `img`) y haz commit **también de los archivos de `assets/productos/`**.
- Para escribir en la carpeta hace falta abrir el sitio desde un servidor local (por ejemplo la extensión *Live Server* de VS Code). Con `file://` el navegador no lo permite y las fotos se descargarán.

### 💾 Cómo se guardan los cambios

El sitio es estático (GitHub Pages no tiene base de datos), así que los cambios del panel se guardan en el **`localStorage` del navegador donde los hiciste**. Los ve quien usa ese navegador, no el resto de los visitantes.

Para publicarlos de verdad:

1. En el panel pulsa **Exportar catálogo** y copia el JSON.
2. Pégalo en `productos.js`, reemplazando el contenido del arreglo `PRODUCTOS_BASE`.
3. Haz commit y push; GitHub Pages se actualiza solo.

El botón **Importar** hace lo contrario: pega un JSON y reemplaza el catálogo de ese navegador (útil para pasar el catálogo de una computadora a otra).

> ⚠️ El usuario y la clave son solo una traba para entradas casuales: al ser un sitio estático, viaja dentro del JavaScript y cualquiera que revise el código puede leerla. No es una medida de seguridad real, y tampoco hace falta que lo sea: nadie puede modificar el sitio publicado desde el panel.

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
- **Panel de administración** (`admin.html`) para dar de alta, editar y dar de baja productos
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
