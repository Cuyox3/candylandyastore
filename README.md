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

Antes de la primera vez hay que tener dos cosas:

1. El registro DNS **A** del dominio apuntando ya a la IP de la VPS — si no,
   Certbot no puede emitir el certificado.
2. PostgreSQL corriendo en el host, aceptando conexiones desde la red de
   Docker. El script avisa con las líneas exactas si no es el caso.

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
Candylandia tiene el **8520** (el mapa completo está en `deploy.sh --help`). Por
eso el `docker-compose.yml` publica `127.0.0.1:8520:1515` y nunca `80:…`: sin
el `127.0.0.1` delante, Docker abriría el puerto en todas las interfaces y
cualquiera podría saltarse el HTTPS entrando por `http://IP:8520`.

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
