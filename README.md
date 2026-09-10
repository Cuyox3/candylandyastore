# 🍬 Candylandia Store — Landing Page

Landing page responsiva para una tienda de **dulces de importación**, lista para publicarse en **GitHub Pages** sin configuración adicional.

## 📁 Estructura

```
candylandia-store/
├── index.html      ← la página completa
├── styles.css      ← estilos y responsive
├── script.js       ← catálogo, filtros, menú y formularios
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
| Productos (nombre, precio, país, descripción, emoji, colores) | `script.js` → arreglo `PRODUCTOS` |
| Categorías de los filtros | botones `.filter` en `index.html` + campo `cat` de cada producto |
| Correo, dirección y horarios | sección `#contacto` en `index.html` |
| Redes sociales | bloque `.socials` en `index.html` (cambia los `href="#"`) |
| Precios de las cajas sorpresa | sección `#cajas` en `index.html` |
| Colores de la marca | `styles.css` → variables en `:root` |

## 🧩 Secciones incluidas

- Barra promocional animada
- Menú fijo con navegación móvil (hamburguesa)
- Hero con la mascota y países de origen
- Beneficios / propuesta de valor
- **Nosotros** (historia, misión, visión, valores)
- **Productos** con filtros por país y botón directo a WhatsApp
- Cajas sorpresa / suscripción mensual (3 planes)
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
