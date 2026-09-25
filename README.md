# Candylandia Store

Tienda de dulces importados, con catálogo administrable y pedidos por WhatsApp.

El repositorio tiene **tres carpetas** que conviene no confundir:

| Carpeta     | Qué es                                                       | ¿Se despliega? |
|-------------|--------------------------------------------------------------|----------------|
| `clasico/`  | El sitio original: HTML, CSS y JS a pelo, sin compilar nada.  | No             |
| `backend/`  | El API: FastAPI + PostgreSQL. Aquí vive el catálogo de verdad.| Sí             |
| `frontend/` | El mismo sitio, migrado a React. Es lo que ve el público.     | Sí             |

`clasico/` se conserva **tal cual estaba** como referencia del diseño: el front
de React es una copia exacta suya, hasta el `styles.css`, que está copiado byte
a byte. Si algo se ve distinto entre los dos, el que tiene razón es `clasico/`.

La diferencia de fondo no es el diseño sino dónde viven los datos. En el sitio
clásico el catálogo estaba escrito en `productos.js`, y el panel guardaba los
cambios en el `localStorage` **del navegador de quien administraba**: sólo los
veía esa persona, en ese equipo, y publicarlos de verdad era exportar un JSON y
pegarlo en el archivo a mano. Ahora el catálogo está en Postgres: lo que se
guarda desde el panel lo ve todo el mundo al instante.

---

## Desplegar

Todo el despliegue es un archivo: **`deploy.sh`**. En la VPS, con el código ya
copiado:

```bash
sudo ./deploy.sh
```

Eso instala lo que falte (Docker, Nginx, Certbot, el cliente de Postgres), crea
la base y el rol, genera el `.env` con contraseñas nuevas, levanta los
contenedores, configura el Nginx del host y emite el certificado. Al terminar
enseña **una vez** la contraseña del panel: apúntala.

Este sitio está configurado para **candylandiastore.mx** en la VPS
**217.77.8.70**. El DNS ya apunta ahí, tanto el dominio raíz como el `www`, así
que los dos entran en el certificado.

Antes de la primera vez hay que tener dos cosas:

1. Que el registro **A** siga apuntando a la VPS. El script lo comprueba solo y
   **no llama a Certbot si no cuadra**: cada intento fallido gasta uno de los 5
   que Let's Encrypt permite por dominio y hora, así que es mejor no gastarlo.
2. PostgreSQL corriendo en el host, aceptando conexiones desde la red de
   Docker. El script avisa con las líneas exactas si no es el caso.

El correo para los avisos de caducidad va en `LETSENCRYPT_EMAIL` del `.env`. Si
está vacío, el script lo pregunta en el primer despliegue y lo guarda ahí. No
está escrito en `deploy.sh` a propósito: ese archivo va a un repositorio
público, y una dirección en un repo público se recolecta sola.

Después, publicar cambios de código es:

```bash
sudo ./deploy.sh --update
```

que no toca ni apt, ni el Nginx del host, ni el certificado, y por eso tarda
segundos en vez de minutos.

`./deploy.sh --help` lista todo lo demás: `--estado`, `--ver-logs`, `--admin`,
`--respaldo`, `--rollback`, `--medios`, `--sembrar`, `--limpiar-docker`…

### Configuración

Las credenciales van **todas** en el `.env`, nunca en el código. Se parte de la
plantilla:

```bash
cp .env.example .env
chmod 600 .env
```

`deploy.sh` genera solo lo que puede (`SECRET_KEY`, la contraseña de Postgres,
la del panel) y rellena `DOMAIN`, `SITE_URL` y `APP_PORT`. Lo único que hay que
poner a mano es **`WHATSAPP`**: es el número al que van todos los botones «Lo
quiero», y con el de ejemplo los pedidos no le llegan a nadie. El script avisa
si se queda sin cambiar.

El `.env` está en `.gitignore` y no debe salir de ahí: lleva la clave que firma
las sesiones del panel, y con ella cualquiera puede fabricarse un token de
administrador.

---

## Cómo encaja todo

```
  internet
     │
     ▼  :80 / :443   (TLS de Let's Encrypt)
  nginx DEL HOST ──────────────────────── también sirve /media/ desde el disco
     │                                     (fotos de los productos)
     ▼  127.0.0.1:8520
  contenedor frontend  ·  nginx + el build de React
     │
     ▼  backend:8000   (red interna de Docker)
  contenedor backend   ·  FastAPI sobre gunicorn
     │
     ▼  host.docker.internal:5432
  PostgreSQL DEL HOST  ·  base «candylandia»
```

Tres decisiones que explican casi todo lo demás:

**El Nginx del host es dueño del 80 y el 443.** En esta VPS conviven varios
sitios y sólo puede haber un proceso escuchando en esos puertos. Cada proyecto
publica **un puerto alto en loopback** y el Nginx del host reparte por dominio.
Candylandia tiene el **8520**. Por eso el `docker-compose.yml` publica
`127.0.0.1:8520:1515` y nunca `80:…`: sin el `127.0.0.1` delante, Docker
abriría el puerto en todas las interfaces y cualquiera podría saltarse el
HTTPS entrando por `http://IP:8520`.

El puerto se elige **una sola vez**. En el primer despliegue el script recorre
el rango 8520–8540, enseña cuál está libre y cuál ocupa cada sitio, y escribe
el elegido en el `.env`. A partir de ahí **no se mueve**: una actualización
reutiliza ese mismo puerto y recarga ese mismo contenedor. Cambiarlo por
detrás dejaría el vhost del Nginx del host apuntando a un puerto vacío y la
tienda caída sin que ningún comando hubiera fallado. Para verlo en cualquier
momento:

```bash
./deploy.sh --puertos
```

**PostgreSQL corre en el host, no en Docker.** Una sola instancia para todos los
sitios, con una base y un rol por proyecto: nadie ve los datos de los demás, los
respaldos salen de un solo sitio y la RAM no se va en cinco Postgres. Los
contenedores llegan por `host.docker.internal`, que en Linux **no existe** de
serie: lo da el `extra_hosts: ["host.docker.internal:host-gateway"]` del
compose. Si falta esa línea, el backend arranca, no encuentra la base y muere
reintentando.

**Hay dos Nginx y no es un error.** El del host hace TLS y reparte por dominio;
el del contenedor sirve los archivos del build y sabe que `/admin` no es una
carpeta sino una ruta de react-router, que necesita devolver el `index.html`.

---

## Desarrollo local

Hacen falta Python 3.12 (la que usa la imagen), Node 20+ y un PostgreSQL al que conectarse.

**Backend** (en una terminal):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# En el .env, cambia host.docker.internal por localhost:
#   DATABASE_URL=postgresql+psycopg://candylandia:...@localhost:5432/candylandia
python -m app.cli migrar     # crea las tablas
python -m app.cli sembrar    # rellena el catálogo base
python -m app.cli admin admin micontraseña
uvicorn app.main:app --reload --port 8000
```

**Frontend** (en otra):

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

El `vite.config.js` hace de proxy de `/api`, `/media` y `/healthz` hacia el
`:8000`, así que en desarrollo el front ve el API en su mismo origen, igual que
en producción. El código no necesita saber en cuál de los dos mundos está.

La tienda queda en `/` y el panel en `/admin`.

Para ver el sitio clásico basta con abrir `clasico/index.html` en el navegador:
no necesita servidor ni compilación.

### Mantenimiento del backend

`python -m app.cli` es el equivalente del `manage.py` de Django, y es lo que
`deploy.sh` llama por dentro:

| Orden                        | Qué hace                                        |
|------------------------------|-------------------------------------------------|
| `migrar`                     | Crea las tablas que falten.                     |
| `sembrar [--forzar]`         | Rellena el catálogo base (no pisa lo existente).|
| `admin <usuario> <clave>`    | Crea el usuario del panel o le cambia la clave. |
| `listar-usuarios`            | Quién puede entrar al panel.                    |
| `estado`                     | Si la base responde y cuántas filas hay.        |

---

## Respaldos

```bash
./deploy.sh --respaldo
```

Deja en `backups/` un `pg_dump` comprimido de la base y un `tar.gz` de las
fotos, y conserva los 10 volcados y los 5 paquetes de fotos más recientes.
`--rollback` restaura el último volcado (y vuelca la base viva antes, por si
acaso).

Las fotos van aparte porque son lo único del sitio que **no se puede rehacer
desde el código**: el catálogo se vuelve a sembrar, pero una foto que subió
alguien hace seis meses no vuelve.

Y guárdalos fuera de la VPS. Un respaldo en el mismo disco no protege del fallo
que más probablemente vas a sufrir.

---

## Posicionamiento en buscadores

El sitio es **una sola página** servida por React. Eso tiene una consecuencia
que manda sobre todo lo demás: un robot que no ejecuta JavaScript —el de
WhatsApp, el de Facebook, la mayoría de los rastreadores de asistentes de IA—
no ve nada de lo que pinta el React. Sólo ve `frontend/index.html`.

Por eso el título, la descripción, la imagen para redes y los datos
estructurados del negocio están **escritos a mano en ese archivo** y no los
pone el React al arrancar. Lo que sí pone el React es lo que depende de los
datos: el catálogo y las preguntas frecuentes.

| Dónde | Qué hay | Quién lo ve |
|--------------------------------|-------------------------------------------------------|-------------------------|
| `frontend/index.html` | título, descripción, canónica, Open Graph, `Store` + `WebSite` + `WebPage` | todos |
| `src/hooks/useSeo.js` | cambia la cabecera al entrar a `/admin` y la devuelve al salir | quien ejecute el React |
| `src/paginas/Tienda.jsx` | `ItemList` con los productos y sus precios | Google (segunda pasada) |
| `src/secciones/Faq.jsx` | `FAQPage` con las seis preguntas | Google (segunda pasada) |
| `public/robots.txt` | permisos de rastreo y dirección del mapa | todos |
| `public/sitemap.xml` | la única dirección del sitio | todos |
| `frontend/nginx.conf` | `X-Robots-Tag: noindex` en `/admin` | todos |
| vhost del host (`deploy.sh`) | redirección de `www` al dominio raíz | todos |

### Lo que hay que saber antes de tocarlo

**El dominio está escrito completo en dos sitios**: en `index.html` y en la
constante `RAIZ` de `src/hooks/useSeo.js`. No se deduce de `window.location` a
propósito: si se dedujera, quien entrara por `www.candylandiastore.mx`
recibiría una canónica que apunta a `www`, y Google vería dos sitios iguales en
vez de uno. Si cambias `DOMAIN` en el `.env`, cambia también esos dos.

**El teléfono, la dirección y el correo del JSON-LD de `index.html` tienen que
ser los mismos que se ven en la sección de contacto.** Un buscador que
encuentra dos versiones del mismo dato no muestra ninguna. Ahora mismo son los
datos de ejemplo del diseño (`Av. Dulce 123`, `+52 55 1234 5678`,
`hola@candylandiastore.com`) — **cámbialos por los reales antes de dar de alta
la ficha de Google Business**, y cámbialos en los dos sitios a la vez.

**`/admin` va con `noindex` por partida doble**: la etiqueta `<meta>` que pone
`useSeo` y la cabecera `X-Robots-Tag` del nginx del contenedor. No es
redundancia inútil: `/admin` y `/` devuelven el MISMO `index.html` (así
funciona react-router), y la etiqueta sólo la ve quien ejecute el React.

**Las imágenes de marca van en WebP con el PNG de respaldo** (`<picture>`). El
logo pasó de 240 KB a 29 y la mascota de 251 a 39. Si sustituyes alguna, genera
las dos versiones o el navegador se quedará con la pesada.

### Comprobarlo después de desplegar

`./deploy.sh` ya lo hace al final: además del `/healthz` de siempre verifica que
`robots.txt` y `sitemap.xml` se sirven de verdad —y no el `index.html` del SPA,
que es lo que pasa cuando un archivo se pierde en el build— y que `/admin`
manda la cabecera `noindex`.

A mano, contra el sitio ya en producción:

```bash
curl -s https://candylandiastore.mx/robots.txt
curl -sI https://candylandiastore.mx/admin | grep -i x-robots-tag
curl -sI https://www.candylandiastore.mx/ | grep -i location   # debe ir al dominio raíz
```

Los datos estructurados sólo se pueden validar con algo que ejecute
JavaScript, porque el catálogo y las preguntas los añade el React:
<https://search.google.com/test/rich-results>.

### Lo que falta

- **Dar de alta el sitio en Google Search Console y en Bing Webmaster Tools**,
  y mandarles el `sitemap.xml`. Sin esto no hay forma de saber qué está
  indexado ni qué errores ve Google.
- **Enlaces reales a las redes sociales.** Los de la sección de contacto
  apuntan a `#`. Un perfil enlazado (y con el enlace de vuelta) es una de las
  señales más baratas de que el negocio existe.
- **Una página por producto.** Hoy el catálogo entero vive en `#productos`, así
  que el sitio compite por «dulces de importación» y por nada más. Una
  dirección por producto (`/producto/kit-kat-matcha`) es lo que permitiría
  aparecer en las búsquedas de cada dulce por su nombre, que son muchas más y
  mucho menos disputadas. Es un cambio de fondo: hace falta enrutado, el
  `sitemap.xml` generado desde la base y, para que valga la pena, que el HTML
  llegue ya pintado desde el servidor.
