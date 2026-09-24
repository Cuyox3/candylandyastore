#!/usr/bin/env bash
#
# deploy.sh — Despliegue de Candylandia Store en una VPS.
#
# ARCHIVO AUTÓNOMO: no depende de nada más del repositorio. Cópialo a una
# máquina limpia junto al proyecto y despliega. Es lo que permite levantar otra
# instancia o migrar de servidor sin buscar bibliotecas sueltas.
#
# ARQUITECTURA (la misma que el resto de proyectos de esta VPS):
#   El Nginx del HOST es dueño de los puertos 80 y 443 y hace de proxy inverso
#   para todos los sitios. Este stack publica UN puerto alto en loopback y el
#   host le reenvía el tráfico de su dominio. El TLS lo emite y renueva Certbot
#   en el host (plugin nginx).
#
#     internet → nginx del host :443 → 127.0.0.1:8520 → frontend (nginx+React)
#                                                       └→ backend:8000 (gunicorn)
#                                                             └→ Postgres del HOST
#
#   La base de datos NO va en Docker: es el PostgreSQL que ya corre en la VPS,
#   con una base y un rol por proyecto. Los contenedores llegan por
#   `host.docker.internal` (extra_hosts: host-gateway en el compose).
#
# Uso (en la VPS, como root o con sudo):
#     sudo ./deploy.sh              despliegue completo (primera vez)
#     sudo ./deploy.sh --update     publicar cambios de código
#     ./deploy.sh --estado          cómo está todo
#     ./deploy.sh --help            todas las opciones
#
# Idempotente: se puede volver a correr para actualizar el stack.
#
# Requisitos: Ubuntu/Debian con acceso a internet. El script instala Docker,
# Nginx, Certbot y el cliente de Postgres si hacen falta. El registro DNS del
# dominio debe apuntar a la IP de la VPS.
#
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ═══════════════════════════════════════════════════════════════════════════
# LO PROPIO DE ESTE PROYECTO
#
# Es lo ÚNICO que cambia entre los deploy.sh de la VPS. Si tienes que tocar
# algo de este proyecto —el dominio, el puerto, un servicio nuevo, una
# comprobación suya— es aquí. De la marca «FIN DE LO PROPIO» hacia abajo, el
# cuerpo es el común.
# ═══════════════════════════════════════════════════════════════════════════

# ── Identidad ──────────────────────────────────────────────────────────────
PROYECTO="candylandia"               # prefija contenedores, red y stack de compose
NOMBRE="Candylandia Store"
APP_DIR="$RAIZ"

# El mismo dominio que el CNAME del repositorio, para que la tienda no cambie
# de dirección al pasar de GitHub Pages a la VPS.
DOMINIO_DEFECTO="candylandiastore.mx"
# Puerto loopback asignado a este proyecto en la VPS. El mapa completo está en
# `mapa_de_puertos` (más abajo) y en ARQUITECTURA.md. NO reutilices otro.
APP_PORT_DEFECTO=8520

# ── Base de datos ──────────────────────────────────────────────────────────
# Base y rol propios en el PostgreSQL del host. Cada proyecto tiene los suyos y
# no ve los de los demás.
DB_NOMBRE="candylandia"
DB_USUARIO="candylandia"

# ── Servicios del compose ──────────────────────────────────────────────────
SERVICIO_WEB="backend"
SERVICIO_FRONTEND="frontend"
SERVICIOS_SECUNDARIOS=""

# ── Rutas ──────────────────────────────────────────────────────────────────
ENV_FILE="$APP_DIR/.env"
ENV_EJEMPLO="$APP_DIR/.env.example"
COMPOSE_ARCHIVO="$APP_DIR/docker-compose.yml"

# ⚠️ Aquí NO hay `staticfiles`. En los proyectos de Django el nginx del host
# sirve del disco los estáticos que recopila `collectstatic`; aquí el front es
# un build de Vite que va DENTRO de la imagen del contenedor `frontend`, con su
# propio nginx. No hay nada que recopilar ni permisos que arreglar, y por eso
# no existe `--estaticos`: en su lugar está `--medios`.
DIR_MEDIOS="$APP_DIR/datos/media"
BACKUP_DIR="$APP_DIR/backups"

# Sin barra final: FastAPI la publica así, y pedir `/healthz/` daría un 307 que
# `curl -f` trata como fallo.
RUTA_SALUD="/healthz"
# Tamaño máximo de subida. Va por encima del IMAGEN_PESO_MAX del backend (8 MB)
# a propósito: así, cuando alguien sube una foto enorme, el que contesta es el
# backend con un mensaje en castellano y no nginx con un 413 pelado.
#
# Es también el techo de «Importar catálogo», que ahora lleva las fotos dentro
# del JSON en base64: a unos 40 KB por foto, con 12M caben del orden de
# doscientas. Un catálogo más grande que eso pide subir este número.
SUBIDA_MAXIMA="12M"
# Puerto interno del contenedor frontend. No se publica: Docker lo mapea a
# 127.0.0.1:APP_PORT.
PUERTO_FRONTEND_INTERNO=1515

# ── Base heredada ──────────────────────────────────────────────────────────
# No hay ninguna. El catálogo del sitio clásico vivía en `clasico/productos.js`
# y en el localStorage del navegador de quien administraba; está traducido a
# `backend/app/seed.py` y se siembra solo al arrancar. No hay SQLite ni volumen
# de Postgres que retirar.
SQLITE_ORIGEN=""

# ── Claves del .env ────────────────────────────────────────────────────────
# Las que un .env viejo puede no tener todavía. `--update` las añade desde el
# .env.example sin regenerar nada ni perder lo ya configurado.
VARS_BACKFILL="SITE_NAME SITE_URL DEBUG DATABASE_URL POSTGRES_PASSWORD \
  SECRET_KEY JWT_ALGORITMO JWT_MINUTOS \
  ADMIN_USUARIO ADMIN_PASSWORD ADMIN_EMAIL \
  CORS_ORIGINS MEDIA_ROOT MEDIA_URL \
  IMAGEN_LADO_MAX IMAGEN_CALIDAD IMAGEN_PESO_MAX \
  WHATSAPP DOMAIN DOMAIN_ALIASES LETSENCRYPT_EMAIL APP_PORT GUNICORN_WORKERS"

# ── Ganchos ────────────────────────────────────────────────────────────────

hook_validar() {
  local fallos=0

  # El backend NO debe publicar puertos. Sólo se llega a él desde el
  # contenedor del front; abrirlo al exterior dejaría el API del panel colgando
  # de internet sin el nginx del host delante — y con él, sin HTTPS.
  # El rango de awk se lleva a mano y no con `/inicio/,/fin/`: la línea
  # `  backend:` casa también con el patrón de fin, así que el rango se cerraría
  # en la misma línea en que abre y la comprobación no miraría nada.
  if awk '/^  [a-z]/{dentro = ($0 ~ /^  backend:/)} dentro' "$COMPOSE_ARCHIVO" \
     | grep -qE '^[[:space:]]+ports:'; then
    err "El servicio 'backend' publica puertos en el compose."
    err "  Debe usar 'expose', no 'ports': al API se llega por el front."
    fallos=$((fallos + 1))
  fi

  # El número de WhatsApp es LO que convierte la tienda en una tienda: cada
  # botón «Lo quiero» abre un chat con él. Vacío o con el de ejemplo, todos los
  # pedidos se van a un número que no es de nadie.
  if [ -z "${WHATSAPP:-}" ]; then
    err "WHATSAPP vacío en $ENV_FILE: los botones «Lo quiero» no llevarían a ningún sitio."
    fallos=$((fallos + 1))
  elif [ "${WHATSAPP}" = "5215512345678" ]; then
    warn "WHATSAPP sigue siendo el número de ejemplo (5215512345678)."
    warn "  Los pedidos de los clientes no le van a llegar a nadie. Cámbialo."
  elif ! printf '%s' "$WHATSAPP" | grep -qE '^[0-9]{10,15}$'; then
    err "WHATSAPP debe ser sólo dígitos, con código de país y sin signos: ${WHATSAPP}"
    fallos=$((fallos + 1))
  fi

  # El tope de nginx tiene que quedar POR ENCIMA del que aplica el backend; si
  # no, la subida muere antes de llegar y el mensaje que se ve no explica nada.
  local tope_backend_mb tope_nginx_mb
  tope_backend_mb=$(( ${IMAGEN_PESO_MAX:-8388608} / 1048576 ))
  tope_nginx_mb="${SUBIDA_MAXIMA%M}"
  if [ "$tope_nginx_mb" -le "$tope_backend_mb" ]; then
    warn "SUBIDA_MAXIMA (${SUBIDA_MAXIMA}) no supera a IMAGEN_PESO_MAX (${tope_backend_mb}M)."
    warn "  Las fotos grandes darán un 413 de nginx en vez del aviso del panel."
  fi

  # La carpeta de medios se monta desde el host. Si alguien cambia MEDIA_ROOT a
  # una ruta que no es la que monta el compose, las fotos se escriben dentro
  # del contenedor y desaparecen en el siguiente despliegue — sin ningún error.
  if [ -n "${MEDIA_ROOT:-}" ] && [ "${MEDIA_ROOT}" != "/app/media" ]; then
    err "MEDIA_ROOT=${MEDIA_ROOT}, pero el compose monta el volumen en /app/media."
    err "  Las fotos que suba la gente se perderían al recrear el contenedor."
    fallos=$((fallos + 1))
  fi

  # La contraseña inicial del admin sólo sirve la primera vez. Dejarla escrita
  # después no es peligroso (se ignora), pero sí es una contraseña en claro en
  # un archivo que se lee en cada despliegue.
  if [ -n "${ADMIN_PASSWORD:-}" ]; then
    warn "ADMIN_PASSWORD tiene valor en el .env."
    warn "  Sólo se usa si la tabla de usuarios está vacía; después se ignora."
    warn "  Cuando el panel ya funcione, déjala vacía y usa:  ./deploy.sh --admin"
  fi

  return $fallos
}

# Cuenta los productos publicados preguntando al propio API. Se hace por HTTP y
# no por la base porque es el camino que recorre un cliente: si esto contesta,
# contesta la tienda entera.
contar_productos() {
  curl -fsS --max-time 10 "http://127.0.0.1:${APP_PORT}/api/v1/productos" 2>/dev/null \
    | tr ',' '\n' | grep -c '"id"' || true
}

# ⚠️ Una tienda sin productos no da ningún error: carga, se ve bien y está
# vacía. Es el fallo más fácil de no ver en un despliegue, así que se comprueba
# aquí en vez de esperar a que lo note un cliente.
hook_post_levantar() {
  log "Comprobando que el catálogo llegó a la tienda…"
  local cuantos
  cuantos="$(contar_productos)"
  if [ "${cuantos:-0}" -gt 0 ]; then
    ok "Catálogo publicado: ${cuantos} producto(s)."
  else
    warn "La tienda no devuelve ningún producto."
    warn "  El arranque siembra el catálogo base; si no lo hizo, fuérzalo con:"
    warn "    ./deploy.sh --sembrar"
    warn "  Y si tampoco, mira qué dijo el backend:  ./deploy.sh --ver-logs"
  fi

  # Sin usuario no se puede entrar al panel. No es un fallo del despliegue —la
  # tienda funciona igual— pero hay que decirlo antes de que alguien se plante
  # delante del formulario de acceso sin nada que escribir.
  local usuarios
  usuarios="$(cli listar-usuarios 2>/dev/null | grep -cE '^[[:space:]]+[0-9]+[[:space:]]' || true)"
  if [ "${usuarios:-0}" -eq 0 ]; then
    warn "No hay ningún usuario del panel: nadie puede administrar el catálogo."
    warn "  Créalo con:  ./deploy.sh --admin"
  else
    ok "Usuarios del panel: ${usuarios}."
  fi
  return 0
}

hook_estado() {
  log "Catálogo:"
  local cuantos
  cuantos="$(contar_productos)"
  if [ "${cuantos:-0}" -gt 0 ]; then
    ok "  ${cuantos} producto(s) publicados."
  else
    warn "  la tienda no devuelve productos. Siembra con:  ./deploy.sh --sembrar"
  fi

  log "Panel de administración:"
  cli listar-usuarios 2>/dev/null | sed 's/^/  /' \
    || warn "  no se pudo consultar (¿está el backend abajo?)."

  log "Fotos de los productos:"
  log "  Están en la base, en la tabla «fotos», una por producto y en base64."
  log "  Van dentro del volcado (db-*.sql.gz), así que restaurarlo las devuelve"
  log "    todas. No hay carpeta que copiar aparte."
  if [ -d "$DIR_MEDIOS" ] && [ -n "$(ls -A "$DIR_MEDIOS" 2>/dev/null)" ]; then
    log "  Quedan además $(find "$DIR_MEDIOS" -type f 2>/dev/null | wc -l | tr -d ' ') archivo(s) sueltos en $DIR_MEDIOS"
    log "    ($(du -sh "$DIR_MEDIOS" 2>/dev/null | cut -f1)): fotos de antes del cambio. Se siguen sirviendo y se"
    log "    siguen respaldando (media-*.tar.gz)."
  fi
}

hook_resumen() {
  warn " El catálogo vive en Postgres, NO en el navegador. Lo que se guarda"
  warn "   desde el panel lo ve todo el mundo al instante: ya no hay que"
  warn "   exportar nada ni pegarlo en productos.js."
  warn " El sitio clásico sigue en clasico/, tal cual estaba, por si hay que"
  warn "   comparar el diseño. No se despliega: no forma parte del stack."
}

# ═══════════════════════════════════════════════════════════════════════════
# FIN DE LO PROPIO DE ESTE PROYECTO
#
# De aquí abajo va el cuerpo común de los deploy.sh de la VPS, con lo que
# cambia por ser FastAPI y no Django ya adaptado: no hay `manage.py`, no hay
# `collectstatic` y las órdenes de mantenimiento son `python -m app.cli`.
# ═══════════════════════════════════════════════════════════════════════════

# ---------------------------------------------------------------------------
# 0. Valores por defecto y utilidades
# ---------------------------------------------------------------------------
# Todo lo de arriba lo declara el bloque propio del proyecto. Aquí sólo se
# rellena lo que pueda faltar, para que el script no reviente con una variable
# sin definir si alguien recorta el bloque.
: "${PROYECTO:?El bloque del proyecto debe definir PROYECTO}"
: "${NOMBRE:=$PROYECTO}"
: "${APP_DIR:?El bloque del proyecto debe definir APP_DIR}"
: "${DOMINIO_DEFECTO:=localhost}"
: "${APP_PORT_DEFECTO:=8520}"
: "${DB_NOMBRE:=$PROYECTO}"
: "${DB_USUARIO:=$DB_NOMBRE}"
: "${ENV_FILE:=$APP_DIR/.env}"
: "${ENV_EJEMPLO:=$APP_DIR/.env.example}"
: "${COMPOSE_ARCHIVO:=$APP_DIR/docker-compose.yml}"
: "${SERVICIO_WEB:=backend}"
: "${SERVICIO_FRONTEND:=frontend}"
: "${SERVICIOS_SECUNDARIOS:=}"
: "${SQLITE_ORIGEN:=}"
: "${RUTA_SALUD:=/healthz}"
: "${DIR_MEDIOS:=$APP_DIR/datos/media}"
: "${BACKUP_DIR:=$APP_DIR/backups}"
: "${VARS_BACKFILL:=}"
: "${SUBIDA_MAXIMA:=12M}"
: "${PUERTO_FRONTEND_INTERNO:=1515}"

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy][aviso]\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m[deploy][error]\033[0m %s\n' "$*" >&2; }
ok()   { printf '\033[1;32m[deploy]\033[0m %s\n' "$*"; }

# ── Que ninguna muerte sea silenciosa ───────────────────────────────────────
# Este script corre con `set -euo pipefail`, así que cualquier orden que
# devuelva no-cero y no esté guardada lo termina AL INSTANTE y SIN DECIR NADA:
# no hay error, no hay diagnóstico, la terminal simplemente vuelve al prompt.
# El caso clásico es un `grep` sin coincidencias dentro de una tubería: devuelve
# 1, y con `pipefail` tumba la asignación entera.
#
# La trampa no evita el fallo: lo hace VISIBLE, con la línea y el código. Sin
# ella, el único camino era volver a correrlo con `bash -x` y leer mil líneas.
#
# `$BASH_COMMAND` es la orden que estaba corriendo. Se recorta a 120 caracteres
# porque algunas son un `docker run` de quince líneas y lo que importa es
# reconocerla, no reproducirla.
al_fallar() {
  local codigo=$? linea=$1 orden=$2
  err "El despliegue se cortó en la línea ${linea} (código ${codigo})."
  err "  Orden: ${orden:0:120}"
  err "  Si no dice nada más, suele ser una orden que devuelve no-cero sin ser"
  err "  un error (un 'grep' que no encuentra nada, un 'docker' que no tiene"
  err "  ese contenedor). Ponle un '|| true' a esa línea."
  exit "$codigo"
}
trap 'al_fallar "$LINENO" "$BASH_COMMAND"' ERR

# El mapa de puertos de la VPS. Vive aquí y en ARQUITECTURA.md, en ningún sitio
# más: los mensajes de «puerto ocupado» lo imprimen para que nadie tenga que
# buscarlo. Un proyecto nuevo toma el siguiente libre y se añade a los dos.
mapa_de_puertos() {
  cat <<'MAPA'
    8515  consultorio    dental.cuyox3.com
    8516  inmobiliaria   inversioninmobiliaria.casa
    8517  marketing      makerthing.cuyox3.com
    8518  panel_bot      bots.cuyox3.com
    8519  seguros        ase-guradora.cuyox3.com
    8520  candylandia    candylandia.cuyox3.com
    8521+ libres para proyectos nuevos
MAPA
}

# ---------------------------------------------------------------------------
# 1. Lectura del .env
# ---------------------------------------------------------------------------
# NO se usa `source`. Un .env puede tener valores con espacios y sin comillas
# —SITE_NAME es literalmente "Candylandia Store"— y `source` los interpreta como
# comandos y muere. Docker Compose lee su env_file de forma literal, así que el
# script hace lo mismo: una sola verdad sobre qué valor recibe la aplicación.
cargar_env() {
  local archivo="$1" linea nombre valor
  local dentro_multilinea=0 comilla='' acumulado='' nombre_multilinea=''
  [ -f "$archivo" ] || return 0

  while IFS= read -r linea || [ -n "$linea" ]; do

    # ── Continuación de un valor multilínea ─────────────────────────────────
    if [ "$dentro_multilinea" -eq 1 ]; then
      if [[ "$linea" == *"$comilla" ]]; then
        acumulado="$acumulado"$'\n'"${linea%"$comilla"}"
        printf -v "$nombre_multilinea" '%s' "$acumulado"
        export "${nombre_multilinea?}"
        dentro_multilinea=0
      else
        acumulado="$acumulado"$'\n'"$linea"
      fi
      continue
    fi

    case "$linea" in \#*|"") continue ;; esac
    [ -z "${linea//[[:space:]]/}" ] && continue

    if [[ "$linea" =~ ^[[:space:]]*([A-Za-z_][A-Za-z_0-9]*)=(.*)$ ]]; then
      nombre="${BASH_REMATCH[1]}"
      valor="${BASH_REMATCH[2]}"

      # ¿Abre comillas y no las cierra en esta línea? Entonces sigue abajo.
      if [[ "$valor" == \"* && "$valor" != \"*\" ]]; then
        dentro_multilinea=1; comilla='"'
        nombre_multilinea="$nombre"; acumulado="${valor:1}"
        continue
      fi
      if [[ "$valor" == \'* && "$valor" != \'*\' ]]; then
        dentro_multilinea=1; comilla="'"
        nombre_multilinea="$nombre"; acumulado="${valor:1}"
        continue
      fi

      # Comillas envolventes: se quitan, como hace Compose. Sin comillas, el
      # valor entra tal cual (espacios incluidos).
      if   [[ "$valor" == \"*\" && ${#valor} -ge 2 ]]; then valor="${valor:1:${#valor}-2}"
      elif [[ "$valor" == \'*\' && ${#valor} -ge 2 ]]; then valor="${valor:1:${#valor}-2}"
      fi
      printf -v "$nombre" '%s' "$valor"
      export "${nombre?}"
    else
      warn "Línea ignorada en $(basename "$archivo"): ${linea%%=*}…"
    fi
  done < "$archivo"

  if [ "$dentro_multilinea" -eq 1 ]; then
    warn "En $(basename "$archivo"), ${nombre_multilinea} abre comillas y no las cierra."
    warn "  El valor se ignora. Revisa el archivo."
  fi
}

# Escribe (o reemplaza) una clave del .env sin duplicarla.
fijar_env() {
  local clave="$1" valor="$2"
  if grep -q "^${clave}=" "$ENV_FILE" 2>/dev/null; then
    # `|` como separador: los valores traen `/` (URLs, claves) y romperían.
    sed -i "s|^${clave}=.*|${clave}=${valor}|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$clave" "$valor" >> "$ENV_FILE"
  fi
}

secreto() {   # secreto [bytes]
  python3 -c "import secrets; print(secrets.token_urlsafe(${1:-32}))" 2>/dev/null \
    || head -c "${1:-32}" /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c "${1:-32}"
}

# ---------------------------------------------------------------------------
# 2. Ayuda y opciones
# ---------------------------------------------------------------------------
uso() {
  cat <<AYUDA
Uso: sudo ./deploy.sh [opciones]

Despliegue de ${NOMBRE} en la VPS. Sin opciones hace el despliegue COMPLETO:
instala dependencias, prepara la base en el Postgres del host, configura el
Nginx del host, emite el certificado y levanta el stack.

Opciones:
  --update, -u        Modo actualización: reconstruye las imágenes y reinicia.
                      NO toca apt, ni el Nginx del host, ni el certificado.
                      Es lo del día a día para publicar cambios de código.
  --sin-cache         Reconstruye ignorando la caché de Docker.
  --logs              Al terminar, se queda mostrando los logs.
  --sin-ssl           No emite ni renueva certificados en este despliegue.

Operación (no necesitan el despliegue completo):
  --estado            Qué corre, en qué puerto, base, catálogo y certificado.
  --ver-logs          Sigue los logs y sale con Ctrl-C.
  --reiniciar         Reinicia los contenedores sin reconstruir.
  --abajo             Detiene la aplicación (los demás sitios siguen).
  --admin             Crea o cambia la contraseña del usuario del panel.
  --shell             Abre una consola de Python dentro del backend.
  --migrar            Crea las tablas que falten.
  --sembrar           Rellena el catálogo base (no pisa lo que ya existe).
  --medios            Rehace los permisos de la carpeta de fotos.
  --respaldo          pg_dump de la base + tar de las fotos a backups/.
  --rollback          Restaura el último respaldo de la base.
  --limpiar-docker    Borra los residuos de Docker DE ESTE PROYECTO: imágenes
                      sin etiqueta, contenedores parados, redes y volúmenes
                      anónimos. Las fotos de los productos NO se tocan.
                      Con --con-cache vacía además la caché de compilación,
                      que es común a todos los sitios de la VPS.
  --base              Crea/verifica la base y el rol en el Postgres del host.
  --ssl               Vuelve a pedir/renovar el certificado.
  --check             Sólo valida la configuración; no toca nada.
  --cron              Muestra las tareas periódicas para el crontab.
  -h, --help          Esta ayuda.

Las opciones se aceptan también sin guiones (\`./deploy.sh estado\`).

Puertos de la VPS (uno por proyecto, todos en loopback):
$(mapa_de_puertos)

Ejemplos:
  sudo ./deploy.sh                     # primera vez
  sudo ./deploy.sh --update            # publicar cambios de código
  ./deploy.sh --estado                 # ver cómo está todo
  ./deploy.sh --admin                  # cambiar la clave del panel
AYUDA
}

parsear_opciones() {
  MODO="completo"; SIN_CACHE=0; SEGUIR_LOGS=0; SIN_SSL=0; ACCION=""; CON_CACHE=0
  while [ $# -gt 0 ]; do
    # Se aceptan las dos formas: `--estado` y `estado`.
    local arg="${1#--}"; arg="${arg#-}"
    case "$arg" in
      u|update|actualizar)  MODO="actualizar" ;;
      sin-cache|no-cache)   SIN_CACHE=1 ;;
      logs)                 SEGUIR_LOGS=1 ;;
      sin-ssl)              SIN_SSL=1 ;;
      full|completo)        MODO="completo" ;;
      estado|status)        ACCION="estado" ;;
      ver-logs)             ACCION="ver-logs" ;;
      reiniciar|restart)    ACCION="reiniciar" ;;
      abajo|down)           ACCION="abajo" ;;
      admin)                ACCION="admin" ;;
      shell)                ACCION="shell" ;;
      migrar)               ACCION="migrar" ;;
      sembrar|seed)         ACCION="sembrar" ;;
      medios|media)         ACCION="medios" ;;
      respaldo|backup)      ACCION="respaldo" ;;
      rollback)             ACCION="rollback" ;;
      base|db)              ACCION="base" ;;
      ssl)                  ACCION="ssl" ;;
      check)                ACCION="check" ;;
      cron)                 ACCION="cron" ;;
      limpiar-docker)       ACCION="limpiar-docker" ;;
      con-cache)            CON_CACHE=1 ;;
      h|help)               uso; exit 0 ;;
      *) err "Opción desconocida: $1"; echo; uso; exit 1 ;;
    esac
    shift
  done
}

# ---------------------------------------------------------------------------
# 3. Docker y compose
# ---------------------------------------------------------------------------
# El `-f` explícito es a propósito: sin él, un COMPOSE_FILE heredado del entorno
# o del .env haría que Compose buscara otro archivo. `--project-name` fija el
# nombre del stack para que los volúmenes sigan siendo los mismos entre
# ejecuciones aunque cambie el nombre del directorio.
detectar_compose() {
  if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose -f $COMPOSE_ARCHIVO --project-directory $APP_DIR -p $PROYECTO"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose -f $COMPOSE_ARCHIVO --project-directory $APP_DIR -p $PROYECTO"
  else
    return 1
  fi
}

# El equivalente de `manage.py` de los proyectos de Django: las órdenes de
# mantenimiento del backend. Viven en backend/app/cli.py.
cli() { $COMPOSE exec -T "$SERVICIO_WEB" python -m app.cli "$@"; }

APT_ACTUALIZADO=0
apt_instalar() {
  command -v apt-get >/dev/null 2>&1 || return 0
  if [ "$APT_ACTUALIZADO" -eq 0 ]; then apt-get update -y; APT_ACTUALIZADO=1; fi
  apt-get install -y "$@"
}

# Nombre del proceso que escucha en un puerto (vacío si está libre).
# `grep -oP` sería más corto pero es de GNU: con sed esto funciona también al
# correr --estado desde un Mac, donde `ss` ni existe.
proceso_en_puerto() {
  command -v ss >/dev/null 2>&1 || return 0
  ss -ltnpH 2>/dev/null \
    | awk -v patron=":$1\$" '$4 ~ patron' \
    | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -n1
}

# ¿Es este contenedor de NUESTRO stack?
#
# Por la etiqueta que pone Compose (`-p $PROYECTO`), no por el prefijo del
# nombre: el nombre lo decide `container_name:` en el compose y no tiene por qué
# empezar igual. Con la comparación por prefijo, el propio frontend del proyecto
# puede salir como «ajeno» y `--update` abortaría diciendo que el puerto está
# ocupado por un contenedor de otro — cuando es justo el que se va a reemplazar.
#
# El respaldo por prefijo se conserva para contenedores levantados a mano o por
# una versión anterior, que no llevan la etiqueta.
es_nuestro_contenedor() {
  local proyecto
  proyecto="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$1" 2>/dev/null)"
  [ "$proyecto" = "$PROYECTO" ] && return 0
  case "$1" in "${PROYECTO}"*) return 0 ;; esac
  case "$1" in "${PROYECTO//_/}"*) return 0 ;; esac
  return 1
}

#: Los contenedores que publican ese puerto, uno por línea.
contenedores_en_puerto() {
  docker ps --format '{{.Names}}\t{{.Ports}}' 2>/dev/null \
    | grep -E ":$1->" | cut -f1
}

#: El primero que NO es de este proyecto (vacío si todos son nuestros).
contenedor_en_puerto() {
  local nombre
  while IFS= read -r nombre; do
    [ -n "$nombre" ] || continue
    es_nuestro_contenedor "$nombre" || { echo "$nombre"; return 0; }
  done <<EOF
$(contenedores_en_puerto "$1")
EOF
  return 0
}

#: El primero que SÍ es de este proyecto.
contenedor_propio_en_puerto() {
  local nombre
  while IFS= read -r nombre; do
    [ -n "$nombre" ] || continue
    es_nuestro_contenedor "$nombre" && { echo "$nombre"; return 0; }
  done <<EOF
$(contenedores_en_puerto "$1")
EOF
  return 0
}

# ---------------------------------------------------------------------------
# 4. Base de datos: el Postgres del HOST
# ---------------------------------------------------------------------------
# Hay un único PostgreSQL corriendo en la VPS y cada proyecto tiene ahí SU base
# y SU rol: nadie ve los datos de los demás, los respaldos salen de un solo
# sitio y la RAM no se va en cinco Postgres.
#
# Los contenedores llegan al host por `host.docker.internal`, que el compose
# resuelve con `extra_hosts: ["host.docker.internal:host-gateway"]`.

# Ejecuta SQL como el superusuario del Postgres del host. Devuelve 1 si no se
# puede (no hay psql local, o no hay permiso): el llamador lo trata como aviso,
# nunca como error fatal — la base puede estar en otra máquina.
psql_admin() {
  command -v psql >/dev/null 2>&1 || return 1
  if [ "$(id -u)" -eq 0 ] && id postgres >/dev/null 2>&1; then
    su - postgres -c "psql -v ON_ERROR_STOP=1 -tAc \"$1\"" 2>/dev/null
  else
    return 1
  fi
}

# La subred desde la que van a llegar los contenedores. Postgres tiene que
# escuchar en esa interfaz y permitirla en pg_hba.
puente_docker() {
  ip -4 addr show docker0 2>/dev/null | awk '/inet /{print $2}' | head -n1
}

asegurar_base() {
  local pass="${POSTGRES_PASSWORD:-}"

  if ! command -v psql >/dev/null 2>&1; then
    warn "No hay cliente psql en el host: no puedo crear la base yo mismo."
    instrucciones_base
    return 0
  fi

  if [ "$(id -u)" -ne 0 ]; then
    warn "Sin root no puedo hablar con el Postgres del host."
    instrucciones_base
    return 0
  fi

  # Contraseña: la del .env manda. Si no hay, se genera y se guarda.
  if [ -z "$pass" ] || [ "$pass" = "CAMBIA_ESTA_CLAVE" ]; then
    pass="$(secreto 24)"
    fijar_env POSTGRES_PASSWORD "$pass"
    fijar_env DATABASE_URL "postgresql+psycopg://${DB_USUARIO}:${pass}@host.docker.internal:5432/${DB_NOMBRE}"
    POSTGRES_PASSWORD="$pass"
    DATABASE_URL="postgresql+psycopg://${DB_USUARIO}:${pass}@host.docker.internal:5432/${DB_NOMBRE}"
    log "Contraseña de Postgres generada y guardada en el .env."
  fi

  local existe_rol existe_base
  existe_rol="$(psql_admin "SELECT 1 FROM pg_roles WHERE rolname='${DB_USUARIO}'" || true)"
  existe_base="$(psql_admin "SELECT 1 FROM pg_database WHERE datname='${DB_NOMBRE}'" || true)"

  if [ -z "$existe_rol$existe_base" ] && ! psql_admin "SELECT 1" >/dev/null 2>&1; then
    warn "No pude conectar al Postgres del host como superusuario."
    instrucciones_base
    return 0
  fi

  if [ "$existe_rol" = "1" ]; then
    # La contraseña se re-aplica siempre: si el .env cambió, el rol tiene que
    # seguirlo, o el contenedor arranca y falla al conectar sin decir por qué.
    psql_admin "ALTER ROLE ${DB_USUARIO} WITH LOGIN PASSWORD '${pass}'" >/dev/null || true
    ok "Rol ${DB_USUARIO}: ya existía (contraseña sincronizada con el .env)."
  else
    psql_admin "CREATE ROLE ${DB_USUARIO} WITH LOGIN PASSWORD '${pass}'" >/dev/null \
      && ok "Rol ${DB_USUARIO} creado." \
      || { warn "No se pudo crear el rol ${DB_USUARIO}."; instrucciones_base; return 0; }
  fi

  if [ "$existe_base" = "1" ]; then
    ok "Base ${DB_NOMBRE}: ya existe."
  else
    # OWNER desde el principio: así el rol puede crear tablas sin más GRANTs.
    psql_admin "CREATE DATABASE ${DB_NOMBRE} OWNER ${DB_USUARIO} ENCODING 'UTF8'" >/dev/null \
      && ok "Base ${DB_NOMBRE} creada (dueño: ${DB_USUARIO})." \
      || { warn "No se pudo crear la base ${DB_NOMBRE}."; instrucciones_base; return 0; }
  fi

  # En Postgres 15+ el rol público ya no puede crear en el esquema `public`:
  # sin esto, `create_all` falla con "permission denied for schema public".
  psql_admin "GRANT ALL ON DATABASE ${DB_NOMBRE} TO ${DB_USUARIO}" >/dev/null || true
  su - postgres -c "psql -v ON_ERROR_STOP=1 -d ${DB_NOMBRE} -tAc \
    \"GRANT ALL ON SCHEMA public TO ${DB_USUARIO}; ALTER SCHEMA public OWNER TO ${DB_USUARIO};\"" \
    >/dev/null 2>&1 || true

  comprobar_acceso_postgres
}

# Postgres en el host tiene que aceptar conexiones desde la red de Docker. Es
# el fallo más común de esta arquitectura y el más opaco: el contenedor arranca,
# reintenta 30 veces y muere con "connection refused" sin más pista.
comprobar_acceso_postgres() {
  local subred conf hba
  subred="$(puente_docker)"
  [ -n "$subred" ] || return 0

  conf="$(psql_admin 'SHOW config_file' || true)"
  [ -n "$conf" ] || return 0
  hba="$(dirname "$conf")/pg_hba.conf"

  local escucha
  escucha="$(psql_admin 'SHOW listen_addresses' || true)"
  case "$escucha" in
    *'*'*|*"$(echo "$subred" | cut -d/ -f1)"*) ;;
    *)
      warn "Postgres escucha en '${escucha}': los contenedores no van a llegar."
      warn "En ${conf} pon:   listen_addresses = '*'"
      warn "y reinicia:       systemctl restart postgresql"
      ;;
  esac

  if [ -f "$hba" ] && ! grep -qF "${subred%%/*}" "$hba" && ! grep -q '172\.' "$hba"; then
    warn "pg_hba.conf no permite la red de Docker (${subred})."
    warn "Añade a ${hba}:"
    warn "    host    all    all    ${subred}    scram-sha-256"
    warn "y recarga:  systemctl reload postgresql"
  fi

  comprobar_cliente_postgres
}

# pg_dump se niega a volcar un servidor MÁS NUEVO que él. Eso no se nota al
# desplegar: se nota el día del `--respaldo`, que es el día que menos apetece
# descubrirlo. Así que se avisa aquí, con el arreglo escrito.
comprobar_cliente_postgres() {
  local servidor cliente
  servidor="$(psql_admin 'SHOW server_version' | cut -d. -f1 | tr -dc '0-9')"
  cliente="$(pg_dump --version 2>/dev/null | awk '{print $NF}' | cut -d. -f1 | tr -dc '0-9')"
  [ -n "$servidor" ] && [ -n "$cliente" ] || return 0

  if [ "$cliente" -lt "$servidor" ]; then
    warn "El pg_dump del host es la versión ${cliente} y Postgres la ${servidor}:"
    warn "los respaldos fallarían con «aborting because of server version mismatch»."
    warn "Instala el cliente que toca:  apt install postgresql-client-${servidor}"
  else
    ok "Cliente de Postgres ${cliente} para un servidor ${servidor}: sirve para respaldar."
  fi
}

instrucciones_base() {
  local pass="${POSTGRES_PASSWORD:-<pon-una-contraseña>}"
  warn "Créala a mano en la VPS y vuelve a lanzar el despliegue:"
  echo
  echo "    sudo -u postgres psql <<SQL"
  echo "      CREATE ROLE ${DB_USUARIO} WITH LOGIN PASSWORD '${pass}';"
  echo "      CREATE DATABASE ${DB_NOMBRE} OWNER ${DB_USUARIO} ENCODING 'UTF8';"
  echo "      GRANT ALL ON DATABASE ${DB_NOMBRE} TO ${DB_USUARIO};"
  echo "    SQL"
  echo "    sudo -u postgres psql -d ${DB_NOMBRE} -c \\"
  echo "      'GRANT ALL ON SCHEMA public TO ${DB_USUARIO}; ALTER SCHEMA public OWNER TO ${DB_USUARIO};'"
  echo
}

# ── Respaldo y restauración ─────────────────────────────────────────────────
# El volcado se intenta primero con el pg_dump DEL HOST y, si no lo hay, con el
# del contenedor del backend.
#
# El orden importa: el cliente de la imagen viene de Debian y se queda atrás
# (hoy, 17), mientras que en el host manda la versión del servidor. Contra un
# Postgres 18 el cliente viejo no avisa, aborta:
#     pg_dump: error: aborting because of server version mismatch
# y el respaldo se queda sin hacer justo antes de una actualización. El pg_dump
# del host sale de la misma instalación que sirve la base, así que siempre
# cuadra.
#
# ⚠️ pg_dump NO entiende el prefijo `postgresql+psycopg://` que necesita
# SQLAlchemy: hay que quitarle el `+psycopg` antes de pasárselo. Y desde el host
# tampoco vale `host.docker.internal`, que sólo resuelve dentro del contenedor.
# --clean --if-exists: sin ellas, restaurar encima de una base que YA tiene el
#   esquema (que es justo lo que hace `--rollback`) suelta 27 errores de
#   "relation ... already exists" y deja los COPY a medias. Con ellas, el mismo
#   volcado se restaura sin un solo error.
# --no-owner --no-privileges: el volcado no arrastra al rol que lo creó, así
#   que se puede restaurar en otra VPS donde el dueño se llame distinto.
PGDUMP_OPCIONES="--clean --if-exists --no-owner --no-privileges"

url_base_host() {
  printf "%s" "${DATABASE_URL:-}" \
    | sed -e "s|+psycopg||" -e "s|@host.docker.internal:|@127.0.0.1:|"
}
respaldar_db() {
  mkdir -p "$BACKUP_DIR"
  local sello destino
  sello="$(date +%Y%m%d-%H%M%S)"
  destino="$BACKUP_DIR/db-$sello.sql.gz"

  if ! $COMPOSE ps --status running 2>/dev/null | grep -q "$SERVICIO_WEB"; then
    warn "El contenedor ${SERVICIO_WEB} no está corriendo: no hay nada que volcar."
    return 0
  fi

  local volcado=0
  if command -v pg_dump >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
    pg_dump $PGDUMP_OPCIONES "$(url_base_host)" 2>/dev/null | gzip > "$destino" && volcado=1
  fi

  if [ "$volcado" -eq 0 ]; then
    $COMPOSE exec -T -e "PGDUMP_OPCIONES=$PGDUMP_OPCIONES" "$SERVICIO_WEB" sh -lc \
      'pg_dump $PGDUMP_OPCIONES "$(printf "%s" "$DATABASE_URL" | sed "s|+psycopg||")"' 2>/dev/null \
      | gzip > "$destino" && volcado=1
  fi

  if [ "$volcado" -eq 1 ]; then
    ok "Base respaldada: $(basename "$destino") ($(du -h "$destino" | cut -f1))"
  else
    rm -f "$destino"
    err "pg_dump falló en el host y en el contenedor. Revisa DATABASE_URL en el"
    err "  .env y que el cliente no sea MÁS VIEJO que el servidor:"
    err "      pg_dump --version"
    err "      sudo -u postgres psql -tAc 'show server_version'"
    return 1
  fi

  # Las fotos de ahora viajan dentro del volcado de arriba, en la tabla
  # «fotos». Esto es sólo para las que quedaran en disco de antes del cambio:
  # mientras haya productos apuntando a /media, siguen siendo lo único del
  # sitio que no se puede rehacer desde el código.
  if [ -d "$DIR_MEDIOS" ] && [ -n "$(ls -A "$DIR_MEDIOS" 2>/dev/null)" ]; then
    local medios="$BACKUP_DIR/media-$sello.tar.gz"
    tar czf "$medios" -C "$(dirname "$DIR_MEDIOS")" "$(basename "$DIR_MEDIOS")" 2>/dev/null \
      && ok "Fotos respaldadas: $(basename "$medios") ($(du -h "$medios" | cut -f1))" \
      || warn "No se pudieron empaquetar las fotos."
  fi

  # Se conservan los 10 volcados y los 5 paquetes de fotos más recientes.
  # El `|| true` no es decorativo: con `set -o pipefail`, un `ls` sin
  # coincidencias (el primer respaldo) haría fallar la tubería entera y `set -e`
  # mataría el script justo después de haber volcado la base.
  ls -1t "$BACKUP_DIR"/db-*.sql.gz    2>/dev/null | tail -n +11 | xargs -r rm -- || true
  ls -1t "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | tail -n +6  | xargs -r rm -- || true

  warn "Guárdalos FUERA de esta VPS: un respaldo en el mismo disco no protege"
  warn "del fallo que más probablemente vas a sufrir."
}

rollback_db() {
  local ultimo
  ultimo="$(ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | head -1 || true)"
  [ -n "$ultimo" ] || { err "No hay respaldos en $BACKUP_DIR"; exit 1; }
  warn "Se restaurará: $ultimo"
  warn "Esto DESTRUYE los datos actuales. Se vuelca la base viva antes, por si acaso."
  printf 'Escribe SI para continuar: '
  read -r respuesta
  [ "$respuesta" = "SI" ] || { log "Cancelado."; exit 0; }

  respaldar_db || warn "No se pudo respaldar la base actual; se continúa."

  log "Restaurando…"
  # Mismo criterio que el volcado: el psql del host primero.
  if command -v psql >/dev/null 2>&1 && [ -n "${DATABASE_URL:-}" ]; then
    gunzip -c "$ultimo" | psql "$(url_base_host)" >/dev/null
  else
    gunzip -c "$ultimo" | $COMPOSE exec -T "$SERVICIO_WEB" sh -lc \
      'psql "$(printf "%s" "$DATABASE_URL" | sed "s|+psycopg||")"' >/dev/null
  fi

  $COMPOSE restart "$SERVICIO_WEB" >/dev/null 2>&1 || true
  ok "Base restaurada desde $(basename "$ultimo")."
}

# ---------------------------------------------------------------------------
# 5. Fotos de los productos
# ---------------------------------------------------------------------------
# Aquí no hay `collectstatic`: el CSS y el JS del front van dentro de la imagen
# del contenedor `frontend`. Lo único que vive en el disco del host son las
# fotos que sube la gente desde el panel, y tienen que satisfacer dos permisos
# que tiran en direcciones opuestas:
#   * el contenedor (uid 1000) tiene que poder ESCRIBIR, porque la subida corre
#     dentro;
#   * el usuario de nginx tiene que poder LEER, y para llegar al archivo
#     necesita permiso de paso en TODOS los directorios del camino.
usuario_nginx() {
  local u
  # El `|| true` importa: un nginx sin directiva `user` —o sin instalar
  # todavía— hace que el grep devuelva 1, y el script moriría en esta línea en
  # vez de caer en el `www-data` de la siguiente.
  u="$(nginx -T 2>/dev/null | grep -m1 -E '^[[:space:]]*user[[:space:]]+' | awk '{print $2}' | tr -d ';' || true)"
  [ -n "$u" ] || u="www-data"
  echo "$u"
}

preparar_medios() {
  mkdir -p "$DIR_MEDIOS/productos"
  if [ "$(id -u)" -eq 0 ]; then
    # 1000 es el uid del usuario `candy` del Dockerfile del backend. Si los dos
    # números dejan de coincidir, el panel deja de poder subir fotos.
    chown -R 1000:1000 "$DIR_MEDIOS"
  fi
  # La X mayúscula pone el bit de paso sólo en los directorios, no en cada archivo.
  chmod -R a+rX "$DIR_MEDIOS" 2>/dev/null || true
}

# Devuelve el directorio MÁS EXTERNO del camino que no deja pasar a «otros».
# Es lo que hay que enseñar: de nada sirve abrir datos/media/ si el bloqueo está
# tres niveles más arriba.
camino_bloqueado() {
  local ruta="$1" modo bloqueo=""
  command -v stat >/dev/null 2>&1 || return 0
  while [ -n "$ruta" ] && [ "$ruta" != "/" ] && [ "$ruta" != "." ]; do
    modo="$(stat -c '%a' "$ruta" 2>/dev/null || echo 755)"
    [ $(( ${modo: -1} & 1 )) -eq 0 ] && bloqueo="$ruta"
    ruta="$(dirname "$ruta")"
  done
  [ -n "$bloqueo" ] && echo "$bloqueo"
  return 0
}

# El contenedor ESCRIBE en las fotos. Es el permiso que más silenciosamente
# falla: la tienda arranca, las páginas cargan, y sólo revienta al subir la
# primera foto desde el panel.
verificar_medios() {
  local usuario bloqueo muestra
  [ -d "$DIR_MEDIOS" ] || { warn "No existe $DIR_MEDIOS."; return 1; }

  # Se miran los bits, no se intenta un `su`: el uid 1000 es el del usuario de
  # DENTRO del contenedor y en el host normalmente no le corresponde ninguna
  # cuenta, así que no hay a quién suplantar para probarlo de verdad.
  local escribe=0 duid dgid dmodo
  duid="$(stat -c '%u' "$DIR_MEDIOS" 2>/dev/null || echo '?')"
  dgid="$(stat -c '%g' "$DIR_MEDIOS" 2>/dev/null || echo '?')"
  dmodo="$(stat -c '%a' "$DIR_MEDIOS" 2>/dev/null || echo 000)"
  dmodo="$(printf '%03d' "$((10#$dmodo % 1000))")"
  local bits_duenyo=${dmodo:0:1} bits_grupo=${dmodo:1:1} bits_otros=${dmodo:2:1}

  if [ "$duid" = "1000" ] && [ $(( bits_duenyo & 2 )) -ne 0 ]; then
    ok "Las fotos son del uid 1000 (el del contenedor), que puede escribirlas."
    escribe=1
  elif [ "$dgid" = "1000" ] && [ $(( bits_grupo & 2 )) -ne 0 ]; then
    ok "El gid 1000 (el del contenedor) puede escribir las fotos."
    escribe=1
  elif [ $(( bits_otros & 2 )) -ne 0 ]; then
    warn "$DIR_MEDIOS deja escribir a CUALQUIER usuario de la máquina (permisos ${dmodo})."
    warn "  El contenedor podrá subir fotos, pero esto es más de lo necesario:"
    warn "  arréglalo con  sudo ./deploy.sh --medios"
    escribe=1
  fi

  # Y si el stack está levantado, se comprueba de verdad: escribir desde el
  # propio contenedor es la única prueba que no deja lugar a dudas.
  if [ -n "${COMPOSE:-}" ] \
     && $COMPOSE exec -T "$SERVICIO_WEB" sh -c 'touch /app/media/.escritura && rm -f /app/media/.escritura' 2>/dev/null; then
    ok "Comprobado desde el contenedor: la subida de fotos puede escribir."
    escribe=1
  fi

  if [ "$escribe" -eq 0 ]; then
    err "El contenedor (uid 1000) NO puede escribir en $DIR_MEDIOS."
    err "  dueño: $(stat -c '%U:%G (uid %u, gid %g)' "$DIR_MEDIOS" 2>/dev/null), permisos ${dmodo}"
    err "Arréglalo con:  sudo ./deploy.sh --medios"
    return 1
  fi

  # Y el lado contrario: nginx las sirve leyendo del disco.
  muestra="$(find "$DIR_MEDIOS" -type f 2>/dev/null | head -1 || true)"
  [ -n "$muestra" ] || return 0   # nadie ha subido nada todavía

  usuario="$(usuario_nginx)"
  if [ "$(id -u)" -eq 0 ] && id "$usuario" >/dev/null 2>&1; then
    if su -s /bin/sh -c "test -r '$muestra'" "$usuario" 2>/dev/null; then
      ok "El usuario de nginx ($usuario) puede leerlas."
    else
      err "El usuario de nginx ($usuario) NO puede leer las fotos."
      err "  Las tarjetas saldrán con el emoji en vez de la foto."
      bloqueo="$(camino_bloqueado "$DIR_MEDIOS")"
      if [ -n "$bloqueo" ]; then
        err "Lo impide este directorio, que no deja pasar a «otros»:"
        err "    $bloqueo   (permisos $(stat -c '%a' "$bloqueo" 2>/dev/null))"
        case "$bloqueo" in
          /root|/root/*)
            # A propósito NO se sugiere `chmod o+x /root`: abriría el home de
            # root a cualquier usuario de la máquina para ahorrarse un problema
            # que tiene mejor solución.
            err "Es el home de root, y nginx no entra ahí por diseño."
            err "Mueve el proyecto a /opt/${PROYECTO} en vez de abrir /root." ;;
          *) err "Ábrelo con:   chmod o+x $bloqueo" ;;
        esac
      fi
      return 1
    fi
  fi
  return 0
}

# ---------------------------------------------------------------------------
# 6. Certbot
# ---------------------------------------------------------------------------
# El plugin va en un paquete APARTE del binario. Comprobar sólo `command -v
# certbot` no basta: con el binario instalado y el plugin no, certbot aborta con
# "The requested nginx plugin does not appear to be installed" y el sitio se
# queda en HTTP. Lo que hay que comprobar es el plugin.
tiene_plugin_nginx() { certbot plugins --non-interactive 2>/dev/null | grep -qi nginx; }

asegurar_certbot_nginx() {
  command -v certbot >/dev/null 2>&1 || {
    log "Instalando certbot y el plugin de nginx…"
    apt_instalar certbot python3-certbot-nginx
  }
  tiene_plugin_nginx && return 0

  local ruta pipdir
  ruta="$(readlink -f "$(command -v certbot 2>/dev/null)" 2>/dev/null || true)"
  pipdir="${ruta%/certbot}"
  log "Certbot está en ${ruta:-?} pero sin el plugin de nginx; instalándolo…"

  case "$ruta" in
    /snap/*)
      snap install certbot --classic >/dev/null 2>&1 || true
      snap set certbot trust-plugin-with-root=ok >/dev/null 2>&1 || true ;;
    *)
      apt_instalar python3-certbot-nginx || true
      [ -x "$pipdir/pip" ] && { "$pipdir/pip" install --quiet --upgrade certbot-nginx || true; } ;;
  esac

  tiene_plugin_nginx && { log "Plugin de nginx instalado."; return 0; }

  err "Certbot no encuentra el plugin de nginx y no se pudo instalar solo."
  err "  apt:   sudo apt install -y python3-certbot-nginx"
  err "  snap:  sudo snap install certbot --classic"
  err "  pip:   sudo ${pipdir:-<ruta-del-venv>}/pip install certbot-nginx"
  err "Compruébalo con:  sudo certbot plugins"
  return 1
}

emitir_certificado() {
  local staging="" extra="" alias
  if [ "${CERTBOT_STAGING:-0}" = "1" ]; then
    staging="--staging"
    warn "Modo STAGING: el certificado NO será de confianza (sólo pruebas)."
  fi
  # Alias opcionales (www…). Cada uno necesita su propio registro DNS: si falta,
  # Certbot falla y el dominio principal se queda sin certificado también.
  if [ -n "${DOMAIN_ALIASES:-}" ]; then
    for alias in ${DOMAIN_ALIASES//,/ }; do
      [ -n "$alias" ] && extra="$extra -d $alias"
    done
    log "Alias incluidos en el certificado:${extra}"
  fi

  log "Emitiendo/renovando el certificado de ${DOMAIN}…"
  # --keep-until-expiring no gasta el cupo (5 emisiones por dominio y semana)
  # si el certificado sigue vigente. --redirect deja el 80 redirigiendo al 443.
  # shellcheck disable=SC2086 - $extra y $staging deben separarse en palabras.
  if certbot --nginx -d "${DOMAIN}" ${extra} \
       --email "${CERTBOT_EMAIL}" --agree-tos --no-eff-email --non-interactive \
       --keep-until-expiring --redirect ${staging}; then
    ok "Certificado en regla. HTTPS activo para ${DOMAIN}."
  else
    warn "Certbot falló. La tienda queda accesible por HTTP en http://${DOMAIN}"
    warn "Causas típicas: DNS que aún no apunta a esta VPS, el puerto 80"
    warn "bloqueado por el firewall, o el límite de 5 emisiones por semana."
    warn "Corrige y reintenta con:  sudo ./deploy.sh --ssl"
  fi

  if systemctl list-timers 2>/dev/null | grep -q certbot; then
    ok "Renovación automática: activa (timer de systemd 'certbot')."
  else
    warn "No se detectó el timer de renovación; actívalo con:"
    warn "  systemctl enable --now certbot.timer"
  fi
}

# ---------------------------------------------------------------------------
# 7. Sitio en el Nginx del host
# ---------------------------------------------------------------------------
diagnosticar_nginx() {
  err "El Nginx del host no pudo arrancar. Causa probable:"
  echo
  if ! nginx -t 2>&1 | sed 's/^/    /'; then
    err "Hay un error de configuración (ver arriba). Corrígelo y reintenta."
    return
  fi
  local p ocupante
  for p in 80 443; do
    ocupante="$(proceso_en_puerto "$p")" || true
    if [ -n "$ocupante" ]; then
      err "El puerto ${p} está ocupado por '${ocupante}':"
      ss -ltnp 2>/dev/null | grep ":${p} " | sed 's/^/    /' || true
      [ "$ocupante" = "docker-proxy" ] && \
        err "Es un contenedor. Identifícalo con:  docker ps | grep ':${p}->'"
    fi
  done
  err "Últimas líneas del journal de nginx:"
  journalctl -xeu nginx.service --no-pager -n 15 2>/dev/null | sed 's/^/    /' || true
}

# Escribe el vhost del sitio. La plantilla va DENTRO del script a propósito:
# este archivo tiene que poder copiarse solo a otra máquina y desplegar sin
# depender de ningún otro archivo del repositorio.
#
# Sólo bloque :80. Certbot con el plugin de nginx añade el TLS encima; escribir
# nosotros un bloque 443 con rutas a certificados que aún no existen impediría
# que nginx arrancara la primera vez.
escribir_vhost() {
  local RAIZ_MEDIOS
  RAIZ_MEDIOS="$(dirname "$DIR_MEDIOS")"
  cat <<VHOST
# ─────────────────────────────────────────────────────────────────────────────
# ${DOMAIN} — generado por deploy.sh de ${NOMBRE}. NO editar a mano: el
# despliegue lo reescribe. Lo que añada Certbot SÍ se conserva (el script
# detecta la marca «managed by Certbot» y entonces ya no regenera el archivo).
#
#   internet → aquí :80/:443 → 127.0.0.1:${APP_PORT} (contenedor frontend,
#                                nginx con el build de Vite)
#                                  └→ backend:8000 (gunicorn) para /api/
#
# Las fotos de los productos NO pasan por los contenedores: las sirve este
# nginx desde el disco. Gunicorn no debería gastar un worker en devolver un
# WebP de 40 KB.
#
# Todo lo demás —la tienda y el panel— va al contenedor: el panel vive en
# /admin, que no es una carpeta sino una ruta de react-router, y el que sabe
# devolver el index.html para ella es el nginx de dentro.
# ─────────────────────────────────────────────────────────────────────────────

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN}${SERVER_NAME_EXTRA};

    client_max_body_size ${SUBIDA_MAXIMA};
    client_body_timeout 300s;

    access_log /var/log/nginx/${DOMAIN}.access.log;
    error_log  /var/log/nginx/${DOMAIN}.error.log;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;

    # Reto ACME de Certbot. Va antes que nada para que la emisión funcione
    # incluso mientras la aplicación está caída.
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # `root` y no `alias` a propósito. Con `alias`, nginx concatena la ruta con
    # el URI COMPLETO en lugar de con el resto, y el try_files de abajo busca
    # el archivo donde no está; es un fallo conocido de nginx que nunca se
    # arregló. Con `root`, /media/foo.webp se resuelve a ${DIR_MEDIOS}/foo.webp
    # —por eso la carpeta tiene que llamarse «media»— y try_files funciona.
    location /media/ {
        root ${RAIZ_MEDIOS};
        # Las fotos llevan un sufijo aleatorio en el nombre: cambiar la foto de
        # un producto cambia su URL, así que la caché nunca sirve una vieja.
        expires 7d;
        access_log off;
        add_header Cache-Control "public";
        # Si el archivo no está en el disco, que lo intente el backend: es lo
        # que salva el caso de haber restaurado la base sin las fotos.
        try_files \$uri @contenedor;
    }

    location @contenedor {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_set_header Host              \$host;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;

        # Subir una foto de 8 MB con una conexión mala tarda.
        proxy_connect_timeout 60s;
        proxy_send_timeout    300s;
        proxy_read_timeout    300s;

        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        # Sin esta cabecera, el backend cree que la petición llegó por HTTP y
        # las direcciones que construye salen en http:// dentro de una página
        # servida por https://, que el navegador bloquea.
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Connection        "";
        proxy_redirect off;
    }
}
VHOST
}

instalar_sitio_nginx() {
  if [ -d /etc/nginx/sites-available ] && [ -d /etc/nginx/sites-enabled ]; then
    SITIO="/etc/nginx/sites-available/${DOMAIN}.conf"
    ENLACE="/etc/nginx/sites-enabled/${DOMAIN}.conf"
  else
    # Distros sin el esquema sites-available (nginx compilado, RHEL…).
    SITIO="/etc/nginx/conf.d/${DOMAIN}.conf"
    ENLACE=""
  fi

  SERVER_NAME_EXTRA=""
  [ -n "${DOMAIN_ALIASES:-}" ] && SERVER_NAME_EXTRA=" ${DOMAIN_ALIASES//,/ }"

  # Certbot edita este archivo para insertar el bloque TLS. Si ya lo tocó, no lo
  # regeneramos: sobrescribirlo dejaría el sitio sin certificado. Pero sí se
  # ponen al día las rutas que dependen del despliegue — si no, un cambio de
  # puerto deja el sitio apuntando a donde ya no hay nada.
  if [ -f "$SITIO" ] && grep -q "managed by Certbot" "$SITIO"; then
    log "El sitio ${SITIO} ya lo gestiona Certbot; se conserva tal cual."
    sed -i -E "s|proxy_pass http://127\.0\.0\.1:[0-9]+;|proxy_pass http://127.0.0.1:${APP_PORT};|g" "$SITIO"
    # Sin grupos de captura a propósito: la indentación se reescribe fija (a
    # nginx le da igual) y así no hay retrocesos que se puedan corromper.
    # Se cubren las dos formas porque un vhost escrito por una versión anterior
    # de este script todavía tiene `alias`.
    sed -i -E "s|^[[:space:]]*(root\|alias)[[:space:]]+.*/media/?;|        root $(dirname "$DIR_MEDIOS");|" "$SITIO"
  else
    log "Instalando el sitio de ${DOMAIN} en el Nginx del host…"
    escribir_vhost > "$SITIO"
  fi

  if [ -n "$ENLACE" ] && [ ! -e "$ENLACE" ]; then
    ln -s "$SITIO" "$ENLACE"
    ok "Sitio habilitado: ${ENLACE}"
  fi

  log "Validando la configuración de Nginx del host…"
  nginx -t || { err "Configuración inválida; no se recarga. Corrige ${SITIO}."; exit 1; }
  systemctl reload nginx
  ok "Nginx del host recargado (los demás sitios siguen intactos)."
}

# ---------------------------------------------------------------------------
# 8. Modos de operación (salen sin desplegar)
# ---------------------------------------------------------------------------
accion_estado() {
  echo
  log "Contenedores:"
  $COMPOSE ps
  echo
  log "Puerto local: 127.0.0.1:${APP_PORT}"
  local codigo
  # Sin `|| echo`: curl ya imprime 000 al fallar, y el echo se concatenaría.
  codigo="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 \
            "http://127.0.0.1:${APP_PORT}${RUTA_SALUD}" 2>/dev/null)" || true
  [ -n "$codigo" ] || codigo="---"
  [ "$codigo" = "200" ] && ok "  ${RUTA_SALUD} responde 200." \
                        || warn "  ${RUTA_SALUD} devolvió ${codigo}. Revisa: ./deploy.sh --ver-logs"

  echo
  log "Base de datos (Postgres del host):"
  # `--estado` de app.cli abre la conexión con SQLAlchemy, que es exactamente
  # la que usa la aplicación: si esto va, la tienda va.
  if cli estado 2>/dev/null | sed 's/^/  /'; then
    :
  else
    warn "  el contenedor no llega a ${DB_NOMBRE}. Revisa DATABASE_URL, listen_addresses"
    warn "  y pg_hba.conf del Postgres del host:  sudo ./deploy.sh --base"
  fi

  echo; log "Fotos (las ESCRIBE el contenedor, las SIRVE nginx):"
  verificar_medios || true

  echo; log "Nginx del host:"
  systemctl is-active nginx >/dev/null 2>&1 && ok "  activo." \
    || warn "  inactivo. Los sitios de la VPS no se están sirviendo."
  local dueno; dueno="$(proceso_en_puerto 80)" || true
  log "  el puerto 80 lo tiene: ${dueno:-nadie}"

  echo; log "Dominio: ${DOMAIN}"
  if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    ok "  certificado presente:"
    openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" 2>/dev/null \
      | sed 's/^/    /' || true
  else
    warn "  sin certificado (o sin permiso para leerlo). Emítelo:  sudo ./deploy.sh --ssl"
  fi

  declare -F hook_estado >/dev/null && { echo; hook_estado; }
  exit 0
}

accion_cron() {
  echo
  log "Tareas periódicas — con 'sudo crontab -e':"
  echo
  echo "  # La renovación del certificado la lleva el timer de systemd de certbot."
  echo "  # Respaldo diario de la base y las fotos"
  echo "  0 2 * * *   cd $APP_DIR && ./deploy.sh --respaldo >> /var/log/${PROYECTO}-respaldo.log 2>&1"
  echo
  exit 0
}

# La contraseña se pide con `read -s`: no se ve al escribirla y no queda en el
# historial de la terminal, que es donde acabaría si fuera un argumento.
accion_admin() {
  local usuario clave clave2
  printf 'Usuario del panel [%s]: ' "${ADMIN_USUARIO:-admin}"
  read -r usuario
  usuario="${usuario:-${ADMIN_USUARIO:-admin}}"

  printf 'Contraseña (mínimo 8, no se ve al escribir): '
  read -rs clave; echo
  printf 'Repítela: '
  read -rs clave2; echo

  [ "$clave" = "$clave2" ] || { err "Las dos contraseñas no coinciden."; exit 1; }
  [ "${#clave}" -ge 8 ]    || { err "Demasiado corta: mínimo 8 caracteres."; exit 1; }

  # Por variable de entorno y no como argumento: los argumentos de `docker exec`
  # se ven enteros en `ps` mientras la orden corre, y ahí estaría la contraseña.
  $COMPOSE exec -T -e ADMIN_PASSWORD_NUEVA="$clave" "$SERVICIO_WEB" \
    python -m app.cli admin "$usuario"
  ok "Listo. Entra en el panel: /admin"
  exit 0
}

ejecutar_accion() {
  case "$ACCION" in
    ver-logs)  exec $COMPOSE logs -f --tail=100 ;;
    reiniciar) log "Reiniciando…"; $COMPOSE restart; $COMPOSE ps; exit 0 ;;
    abajo)
      log "Deteniendo ${NOMBRE} (los demás sitios de la VPS no se tocan)…"
      $COMPOSE down
      log "Detenido. Para volver:  sudo ./deploy.sh --update"; exit 0 ;;
    admin)   accion_admin ;;
    shell)   exec $COMPOSE exec "$SERVICIO_WEB" python ;;
    migrar)  log "Creando las tablas que falten…"; cli migrar; ok "Hecho."; exit 0 ;;
    sembrar) log "Sembrando el catálogo base…"; cli sembrar; exit 0 ;;
    medios)
      log "Rehaciendo los permisos de las fotos…"
      preparar_medios
      verificar_medios || exit 1
      ok "Listo. Recarga con Ctrl-Shift-R para saltarte la caché."; exit 0 ;;
    respaldo) respaldar_db; exit 0 ;;
    limpiar-docker) limpiar_residuos_docker; exit 0 ;;
    rollback) rollback_db; exit 0 ;;
    base)     asegurar_base; exit 0 ;;
    estado)   accion_estado ;;
    cron)     accion_cron ;;
  esac
}

# ---------------------------------------------------------------------------
# 9. Generación y validación del .env
# ---------------------------------------------------------------------------
generar_env() {
  [ -f "$ENV_EJEMPLO" ] || { err "No se encontró $ENV_EJEMPLO."; exit 1; }
  log "Generando .env a partir de $(basename "$ENV_EJEMPLO")…"
  cp "$ENV_EJEMPLO" "$ENV_FILE"
  chmod 600 "$ENV_FILE"

  local pgpass admpass
  pgpass="$(secreto 24)"
  # La contraseña inicial del panel también se genera: es mejor enseñarla una
  # vez al final del despliegue que dejar un `admin/demo123` escrito, que es lo
  # que tenía el sitio clásico y cualquiera podía leer en admin.js.
  admpass="$(secreto 12)"

  fijar_env SECRET_KEY        "$(secreto 50)"
  fijar_env DEBUG             "False"
  fijar_env POSTGRES_PASSWORD "$pgpass"
  # host.docker.internal, no `db`: la base no es un contenedor de este stack.
  fijar_env DATABASE_URL      "postgresql+psycopg://${DB_USUARIO}:${pgpass}@host.docker.internal:5432/${DB_NOMBRE}"
  fijar_env SITE_URL          "https://${DOMAIN}"
  fijar_env CORS_ORIGINS      "https://${DOMAIN}"
  fijar_env ADMIN_PASSWORD    "$admpass"
  fijar_env DOMAIN            "${DOMAIN}"
  fijar_env APP_PORT          "${APP_PORT}"

  ADMIN_PASSWORD_GENERADA="$admpass"
  ok "SECRET_KEY, contraseña de Postgres y clave del panel generadas."
  warn "Revisa el .env: el número de WHATSAPP sigue siendo el de ejemplo."
}

# Backfill: si una clave existe en la plantilla y falta en el .env de
# producción, se añade. Así un `git pull && ./deploy.sh --update` trae las
# variables nuevas sin regenerar el .env ni perder lo ya configurado.
backfill_env() {
  log ".env ya existe; se conserva la configuración actual."
  local var linea
  if [ -f "$ENV_EJEMPLO" ]; then
    for var in $VARS_BACKFILL; do
      grep -q "^${var}=" "$ENV_FILE" && continue
      linea="$(grep "^${var}=" "$ENV_EJEMPLO" || true)"
      [ -n "$linea" ] && { warn "Añadiendo ${var} al .env desde la plantilla."; printf '%s\n' "$linea" >> "$ENV_FILE"; }
    done
  fi
  grep -q '^APP_PORT=' "$ENV_FILE" || { warn "Añadiendo APP_PORT=${APP_PORT}."; printf 'APP_PORT=%s\n' "$APP_PORT" >> "$ENV_FILE"; }
  grep -q '^DOMAIN='   "$ENV_FILE" || { warn "Añadiendo DOMAIN=${DOMAIN}.";     printf 'DOMAIN=%s\n'   "$DOMAIN"   >> "$ENV_FILE"; }

  # La señal de un .env de la arquitectura vieja: la base apuntaba a un
  # contenedor llamado `db` que en esta VPS no existe.
  if grep -q '^DATABASE_URL=.*@db:5432' "$ENV_FILE"; then
    warn "DATABASE_URL apunta a '@db:5432', un contenedor de Postgres que no existe."
    warn "Se reescribe a host.docker.internal (el Postgres del host)."
    sed -i "s|@db:5432|@host.docker.internal:5432|" "$ENV_FILE"
  fi
  # SQLAlchemy necesita el driver en la URL. Un `postgresql://` a secas hace que
  # intente psycopg2, que no está instalado, y el backend muere al arrancar con
  # un ModuleNotFoundError que no parece un problema de configuración.
  if grep -qE '^DATABASE_URL=postgres(ql)?://' "$ENV_FILE"; then
    warn "DATABASE_URL sin el driver. Se reescribe a postgresql+psycopg://"
    sed -i -E 's|^DATABASE_URL=postgres(ql)?://|DATABASE_URL=postgresql+psycopg://|' "$ENV_FILE"
  fi
}

validar_env() {
  local fallos=0

  if [ -z "${SECRET_KEY:-}" ] || echo "${SECRET_KEY:-}" | grep -qiE "RELLENAR|dev-inseguro|cambiame"; then
    err "SECRET_KEY inválida o de ejemplo"; fallos=$((fallos + 1))
  elif [ "${#SECRET_KEY}" -lt 40 ]; then
    err "SECRET_KEY demasiado corta (${#SECRET_KEY}, mínimo 40)"; fallos=$((fallos + 1))
  else
    ok "SECRET_KEY válida"
  fi

  local debug_lower
  debug_lower="$(printf '%s' "${DEBUG:-False}" | tr '[:upper:]' '[:lower:]')"
  if [[ "$debug_lower" =~ ^(1|true|yes|on)$ ]]; then
    err "DEBUG=${DEBUG} — nunca en producción: publica /docs sin clave y escribe"
    err "  cada consulta SQL en los logs"; fallos=$((fallos + 1))
  else
    ok "DEBUG=False"
  fi

  if [ -z "${DATABASE_URL:-}" ]; then
    err "DATABASE_URL sin definir — la app no sabe a qué base conectarse"; fallos=$((fallos + 1))
  elif [[ "${DATABASE_URL}" == *"@db:"* ]]; then
    err "DATABASE_URL apunta a '@db:', un contenedor de Postgres que no existe."
    err "  Debe ser host.docker.internal (el Postgres del host)."; fallos=$((fallos + 1))
  elif [[ "${DATABASE_URL}" != *"+psycopg"* ]]; then
    err "DATABASE_URL sin driver: debe empezar por postgresql+psycopg://"
    err "  Sin él, SQLAlchemy busca psycopg2, que no está instalado."; fallos=$((fallos + 1))
  elif [ -n "${POSTGRES_PASSWORD:-}" ] && [[ "${DATABASE_URL}" != *"${POSTGRES_PASSWORD}"* ]]; then
    err "DATABASE_URL no lleva la misma contraseña que POSTGRES_PASSWORD"; fallos=$((fallos + 1))
  else
    ok "Base de datos: ${DB_NOMBRE} en el Postgres del host"
  fi

  # SITE_URL sale en los enlaces que se mandan por fuera del navegador. Con el
  # valor de ejemplo, un enlace compartido lleva a localhost.
  if [ -z "${SITE_URL:-}" ] || [[ "${SITE_URL}" == *localhost* ]]; then
    warn "SITE_URL=${SITE_URL:-<vacío>} — debería ser https://${DOMAIN}"
  else
    ok "SITE_URL: ${SITE_URL}"
  fi

  # Que nadie vuelva a publicar el 80/443: es lo que tumbaría al host entero.
  if grep -qE '^\s*-\s*"?(0\.0\.0\.0:)?(80|443):' "$COMPOSE_ARCHIVO"; then
    err "${COMPOSE_ARCHIVO##*/} publica 80/443 — son del Nginx del host"; fallos=$((fallos + 1))
  else
    ok "No se publican 80/443 (correcto)"
  fi

  if grep -qE '^\s*-\s*"?127\.0\.0\.1:' "$COMPOSE_ARCHIVO"; then
    ok "El contenedor publica sólo en 127.0.0.1"
  else
    warn "${COMPOSE_ARCHIVO##*/} no publica en 127.0.0.1 — revisa la sección ports:"
  fi

  # Un `db:` con imagen de postgres en el compose significa que este proyecto
  # levanta su propia base: justo lo que se unificó en el host.
  if grep -qE '^\s+image:\s*postgres' "$COMPOSE_ARCHIVO"; then
    err "${COMPOSE_ARCHIVO##*/} levanta un contenedor de Postgres."
    err "  La base es única y vive en el host. Quita ese servicio."; fallos=$((fallos + 1))
  fi

  # El contenedor tiene que poder resolver host.docker.internal, y en Linux eso
  # NO viene de serie: lo da el extra_hosts. Sin él, el backend arranca, no
  # encuentra la base, reintenta treinta veces y muere.
  if [[ "${DATABASE_URL:-}" == *host.docker.internal* ]] \
     && ! grep -q 'host.docker.internal:host-gateway' "$COMPOSE_ARCHIVO"; then
    err "DATABASE_URL usa host.docker.internal pero el compose no tiene"
    err "  extra_hosts: [\"host.docker.internal:host-gateway\"]"
    err "  En Linux ese nombre no existe sin esa línea."; fallos=$((fallos + 1))
  fi

  # El vhost del host sirve las fotos con `root`, que resuelve /media/foo como
  # <padre>/media/foo: si la carpeta se llamara de otra forma, nginx buscaría en
  # una ruta que no existe y todas las fotos darían 404 sin más explicación.
  if [ "$(basename "$DIR_MEDIOS")" != "media" ]; then
    err "DIR_MEDIOS debe terminar en /media (ahora: ${DIR_MEDIOS})."
    err "  El bloque /media/ del vhost usa 'root' y depende de ese nombre."
    fallos=$((fallos + 1))
  fi

  declare -F hook_validar >/dev/null && { hook_validar || fallos=$((fallos + $?)); }

  [ "$fallos" -eq 0 ] || { echo; err "$fallos problema(s) de configuración"; exit 1; }
}

# ---------------------------------------------------------------------------
# 10. Sondas de verificación
# ---------------------------------------------------------------------------
probe() {   # probe <ruta> <esperado> <descripción>
  local code
  code="$(curl -sk --max-time 30 -o /dev/null -w '%{http_code}' \
          --resolve "$DOMAIN:443:127.0.0.1" --resolve "$DOMAIN:80:127.0.0.1" \
          "$ESQUEMA://$DOMAIN$1" 2>/dev/null)" || true
  [ -n "$code" ] || code="sin-respuesta"
  [ "$code" = "$2" ] && ok "$3 → $code" || warn "$3 → $code (esperado $2)"
}

# ---------------------------------------------------------------------------
# 10 bis. Limpieza de residuos de Docker
# ---------------------------------------------------------------------------
# Docker no borra casi nada por su cuenta. Tras unas cuantas reconstrucciones
# quedan, por cada sitio: la imagen anterior de cada servicio sin etiqueta
# (`<none>`), los contenedores de los que ya no arranca nadie, las redes de
# despliegues viejos y la caché del `buildx`, que es la que de verdad crece —en
# una VPS pequeña son varios gigas y el disco se llena sin que nadie sepa de
# qué.
#
# TODO lo de aquí está ACOTADO A ESTE PROYECTO. Nunca un `docker system prune`
# a secas: en esta VPS conviven varios sitios y ese comando se llevaría por
# delante las imágenes de los otros, que tendrían que reconstruirse enteras en
# su siguiente despliegue —y con mala suerte, mientras alguien las está usando—.
# La única excepción es la caché de compilación, que es común y se puede rehacer
# sin consecuencias; por eso va detrás de --con-cache.
#
#   ./deploy.sh --limpiar-docker              lo de este proyecto
#   ./deploy.sh --limpiar-docker --con-cache  además vacía la caché de build
limpiar_residuos_docker() {
  local antes despues
  antes="$(docker system df --format '{{.Type}} {{.Reclaimable}}' 2>/dev/null || true)"

  log "Limpiando los residuos de Docker de ${NOMBRE}…"
  [ -n "$antes" ] && printf '%s\n' "$antes" | sed 's/^/    /'

  # 1. Contenedores parados del proyecto. Los que están corriendo no se tocan.
  local parados
  parados="$($COMPOSE ps -aq --status=exited --status=dead 2>/dev/null || true)"
  if [ -n "$parados" ]; then
    log "  Contenedores parados…"
    printf '%s\n' "$parados" | xargs -r docker rm -f >/dev/null 2>&1 || true
  fi

  # 2. Imágenes huérfanas del proyecto: las que dejó atrás cada reconstrucción.
  #    El filtro por etiqueta es lo que las distingue de las de los otros
  #    sitios; sin él esto sería un `image prune -a` disfrazado.
  local huerfanas
  huerfanas="$(docker image ls -q --filter 'dangling=true' \
                 --filter "label=com.docker.compose.project=${PROYECTO}" 2>/dev/null || true)"
  if [ -n "$huerfanas" ]; then
    log "  Imágenes sin etiqueta…"
    printf '%s\n' "$huerfanas" | xargs -r docker image rm >/dev/null 2>&1 || true
  fi

  # 3. Redes del proyecto que ya no usa ningún contenedor.
  docker network ls -q --filter "name=^${PROYECTO}_" 2>/dev/null | while read -r red; do
    docker network rm "$red" >/dev/null 2>&1 || true
  done

  # 4. Volúmenes ANÓNIMOS del proyecto. Las fotos NO viven en un volumen sino en
  #    datos/media del host, así que esto no las puede tocar ni por accidente.
  local anonimos
  anonimos="$(docker volume ls -q --filter 'dangling=true' \
                --filter "label=com.docker.compose.project=${PROYECTO}" 2>/dev/null \
              | grep -E '^[0-9a-f]{64}$' || true)"
  if [ -n "$anonimos" ]; then
    log "  Volúmenes anónimos…"
    printf '%s\n' "$anonimos" | xargs -r docker volume rm >/dev/null 2>&1 || true
  fi

  # 5. La caché de compilación. Es común a todos los sitios de la VPS y es la
  #    que más ocupa, pero vaciarla hace que el siguiente despliegue de CADA
  #    sitio compile desde cero. Por eso hay que pedirla.
  if [ "${CON_CACHE:-0}" -eq 1 ]; then
    log "  Caché de compilación (común a todos los sitios)…"
    docker builder prune -af >/dev/null 2>&1 || true
  else
    log "  Caché de compilación: intacta (--con-cache la vacía)."
  fi

  despues="$(docker system df --format '{{.Type}} {{.Reclaimable}}' 2>/dev/null || true)"
  [ -n "$despues" ] && { log "  Después:"; printf '%s\n' "$despues" | sed 's/^/    /'; }
  ok "Residuos retirados."
}

# ---------------------------------------------------------------------------
# 11. main
# ---------------------------------------------------------------------------
ADMIN_PASSWORD_GENERADA=""

comun_main() {
  cd "$APP_DIR"
  parsear_opciones "$@"

  DOMAIN="${DOMAIN:-$DOMINIO_DEFECTO}"
  APP_PORT="${APP_PORT:-$APP_PORT_DEFECTO}"
  CERTBOT_EMAIL="${CERTBOT_EMAIL:-${LETSENCRYPT_EMAIL:-artuciiz@gmail.com}}"
  CERTBOT_STAGING="${CERTBOT_STAGING:-0}"
  DOMAIN_ALIASES="${DOMAIN_ALIASES:-}"

  [ "$MODO" = "actualizar" ] && log "Modo ACTUALIZACIÓN: sólo se reconstruye y reinicia."

  # ── Root ──────────────────────────────────────────────────────────────────
  # Sólo el despliegue completo, --ssl, --base y --medios tocan el host (apt,
  # nginx, certbot, postgres, chown); el resto se queda en Docker.
  local necesita_root=1
  case "$ACCION" in
    estado|ver-logs|reiniciar|abajo|admin|shell|migrar|sembrar|respaldo|rollback|check|cron|limpiar-docker)
      necesita_root=0 ;;
  esac
  [ "$MODO" = "actualizar" ] && [ -z "$ACCION" ] && necesita_root=0
  if [ "$necesita_root" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
    err "Ejecuta como root o con sudo (hace falta para Docker, Nginx, Certbot y Postgres)."
    exit 1
  fi

  # --cron no necesita ni Docker.
  [ "$ACCION" = "cron" ] && accion_cron

  # ── Docker ────────────────────────────────────────────────────────────────
  if [ "$MODO" = "completo" ] && [ -z "$ACCION" ]; then
    command -v curl >/dev/null 2>&1 || { log "Instalando curl…"; apt_instalar curl; }
    if ! command -v docker >/dev/null 2>&1; then
      log "Docker no encontrado. Instalando Docker Engine…"
      curl -fsSL https://get.docker.com | sh
      systemctl enable --now docker
    else
      log "Docker ya está instalado: $(docker --version)"
    fi
  elif ! command -v docker >/dev/null 2>&1; then
    err "Docker no está instalado. Corre primero el despliegue completo: sudo ./deploy.sh"
    exit 1
  fi

  detectar_compose || {
    log "Instalando el plugin docker compose…"
    apt_instalar docker-compose-plugin
    detectar_compose || { err "No se pudo instalar docker compose."; exit 1; }
  }
  log "Usando: $COMPOSE"

  # ── Modos de operación ────────────────────────────────────────────────────
  if [ -n "$ACCION" ] && [ "$ACCION" != "check" ] && [ "$ACCION" != "ssl" ]; then
    cargar_env "$ENV_FILE"
    DOMAIN="${DOMAIN:-$DOMINIO_DEFECTO}"; APP_PORT="${APP_PORT:-$APP_PORT_DEFECTO}"
    unset COMPOSE_FILE
    ejecutar_accion
  fi

  # ── Dependencias del host ─────────────────────────────────────────────────
  if command -v apt-get >/dev/null 2>&1; then
    command -v ss   >/dev/null 2>&1 || { log "Instalando iproute2…";          apt_instalar iproute2; }
    command -v psql >/dev/null 2>&1 || { log "Instalando postgresql-client…"; apt_instalar postgresql-client; }
  fi
  if [ "$MODO" = "completo" ] && [ "$ACCION" != "check" ]; then
    command -v nginx >/dev/null 2>&1 || { log "Instalando nginx…"; apt_instalar nginx; }
    [ "$SIN_SSL" -eq 0 ] && { asegurar_certbot_nginx || warn "Se seguirá sin poder emitir el certificado."; }
  fi

  # ── El puerto 80 tiene que ser del nginx del host ─────────────────────────
  if [ "$MODO" = "completo" ] && [ -z "$ACCION" ]; then
    local ajeno80; ajeno80="$(contenedor_en_puerto 80)" || true
    if [ -n "$ajeno80" ]; then
      err "El contenedor '${ajeno80}' tiene el puerto 80; el Nginx del host no arrancará."
      err "No lo toco: no es de este proyecto. Migra ese proyecto primero."
      exit 1
    fi
    local propio80; propio80="$(contenedor_propio_en_puerto 80)" || true
    if [ -n "$propio80" ]; then
      warn "El contenedor '${propio80}' de este proyecto aún ocupa el 80. Bajando el stack…"
      $COMPOSE down --remove-orphans || true
      sleep 2
    fi
  fi

  # ── Nginx del host activo ─────────────────────────────────────────────────
  if [ "$MODO" = "completo" ] && [ -z "$ACCION" ]; then
    systemctl is-enabled nginx >/dev/null 2>&1 || {
      warn "El servicio nginx estaba deshabilitado; se vuelve a habilitar."
      systemctl enable nginx >/dev/null 2>&1 || true
    }
    if ! systemctl is-active nginx >/dev/null 2>&1; then
      log "Arrancando el servicio nginx del host…"
      systemctl start nginx || { diagnosticar_nginx; exit 1; }
      ok "Nginx del host: arrancado."
    else
      ok "Nginx del host: activo."
    fi
    mkdir -p /var/www/html   # directorio del reto ACME
  fi

  # ── .env ──────────────────────────────────────────────────────────────────
  if [ ! -f "$ENV_FILE" ] && { [ "$MODO" = "actualizar" ] || [ -n "$ACCION" ]; }; then
    err "No existe $ENV_FILE: nunca se ha desplegado en esta máquina."
    err "Corre primero el despliegue completo:  sudo ./deploy.sh"
    exit 1
  fi
  # --check promete no tocar nada, y un backfill silencioso durante un --ssl
  # sería una sorpresa desagradable a las tres de la mañana.
  if [ -n "$ACCION" ]; then :
  elif [ ! -f "$ENV_FILE" ]; then generar_env
  else backfill_env
  fi

  cargar_env "$ENV_FILE"
  unset COMPOSE_FILE
  DOMAIN="${DOMAIN:-$DOMINIO_DEFECTO}"
  APP_PORT="${APP_PORT:-$APP_PORT_DEFECTO}"
  CERTBOT_EMAIL="${LETSENCRYPT_EMAIL:-${CERTBOT_EMAIL:-admin@$DOMAIN}}"
  chmod 600 "$ENV_FILE" 2>/dev/null || true

  [ -z "$ACCION" ] && { mkdir -p "$BACKUP_DIR"; preparar_medios; }

  # ── --check ───────────────────────────────────────────────────────────────
  if [ "$ACCION" = "check" ]; then
    echo; log "Validando la configuración…"
    validar_env
    command -v nginx >/dev/null 2>&1 && ok "nginx del host instalado" || warn "nginx no instalado"
    if command -v certbot >/dev/null 2>&1; then
      tiene_plugin_nginx && ok "certbot con plugin de nginx" || warn "certbot SIN el plugin de nginx"
    else
      warn "certbot no está instalado en el host"
    fi
    ok "Configuración lista."; exit 0
  fi

  validar_env

  # ── --ssl ─────────────────────────────────────────────────────────────────
  if [ "$ACCION" = "ssl" ]; then
    asegurar_certbot_nginx || exit 1
    emitir_certificado
    exit 0
  fi

  # ── Base de datos ─────────────────────────────────────────────────────────
  # Antes de levantar nada: el arranque del backend crea las tablas y siembra el
  # catálogo, y sin base ni rol eso muere reintentando sin decir por qué.
  log "Preparando la base en el Postgres del host…"
  asegurar_base

  # ── Puerto libre ──────────────────────────────────────────────────────────
  log "Comprobando el puerto local ${APP_PORT}…"
  # El `|| true` es necesario: con `set -e` + pipefail, un grep sin
  # coincidencias (puerto libre, el caso normal) haría fallar la asignación.
  local ocupa ajeno
  ocupa="$(proceso_en_puerto "$APP_PORT")" || true
  if [ -n "$ocupa" ]; then
    ajeno="$(contenedor_en_puerto "$APP_PORT")" || true
    if [ "$ocupa" = "docker-proxy" ] && [ -z "$ajeno" ]; then
      local propio; propio="$(contenedor_propio_en_puerto "$APP_PORT")" || true
      ok "Puerto ${APP_PORT}: lo usa este mismo stack${propio:+ (${propio})}; Compose lo reemplazará."
    else
      err "El puerto ${APP_PORT} está ocupado por '${ocupa}'${ajeno:+ (contenedor ${ajeno})}."
      err "Mapa de puertos de la VPS:"
      mapa_de_puertos >&2
      err "Elige otro libre:  APP_PORT=8521 sudo ./deploy.sh   (o edítalo en el .env)"
      exit 1
    fi
  else
    ok "Puerto ${APP_PORT}: libre."
  fi

  # ── DNS (aviso, no bloqueante) ────────────────────────────────────────────
  if [ "$MODO" = "completo" ] && [ "$DOMAIN" != "localhost" ]; then
    log "Verificando a dónde resuelve ${DOMAIN}…"
    local resuelve ip_publica
    resuelve="$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | head -n1 || true)"
    ip_publica="${SERVER_IP:-$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)}"
    if [ -z "$resuelve" ]; then
      warn "${DOMAIN} no resuelve todavía. Si el certificado falla, revisa el registro A."
    elif [ -n "$ip_publica" ] && [ "$resuelve" != "$ip_publica" ]; then
      warn "DNS: ${DOMAIN} resuelve a ${resuelve}, pero esta máquina es ${ip_publica}."
    else
      ok "DNS correcto: ${DOMAIN} -> ${resuelve}"
    fi
  fi

  # ── Levantar ──────────────────────────────────────────────────────────────
  # Respaldo antes de tocar nada: el arranque crea tablas, y una base a medias
  # sin volcar no tiene vuelta atrás.
  if $COMPOSE ps --status running 2>/dev/null | grep -q "$SERVICIO_WEB"; then
    log "Respaldando la base antes de desplegar…"
    respaldar_db || warn "El respaldo falló; se continúa igualmente."
  fi

  local opciones_build=""
  [ "$SIN_CACHE" -eq 1 ] && opciones_build="--no-cache"
  log "Construyendo las imágenes…"
  # shellcheck disable=SC2086 - queremos que las opciones se separen en palabras.
  $COMPOSE build $opciones_build

  log "Levantando el stack…"
  export APP_PORT   # lo lee el compose en la sección ports:
  $COMPOSE up -d --remove-orphans

  log "Esperando a que la tienda responda en 127.0.0.1:${APP_PORT}…"
  local lista=0
  for _ in $(seq 1 45); do
    if curl -fsS -o /dev/null "http://127.0.0.1:${APP_PORT}${RUTA_SALUD}" 2>/dev/null; then lista=1; break; fi
    sleep 2
  done
  [ "$lista" -eq 1 ] && ok "La tienda responde correctamente." \
    || warn "Aún no responde. Revisa después:  ./deploy.sh --ver-logs"

  # ── Tablas y catálogo ─────────────────────────────────────────────────────
  # El arranque del backend ya hace las dos cosas, pero eso NO basta: si un
  # --update no cambia la imagen del backend, Compose no recrea el contenedor,
  # el arranque no se vuelve a ejecutar y una tabla nueva jamás se crea.
  #
  # Las dos órdenes son idempotentes: `migrar` sólo crea lo que falta y
  # `sembrar` no pisa un producto que ya existe (se identifican por su slug).
  log "Creando las tablas que falten…"
  cli migrar >/dev/null 2>&1 \
    && ok "Esquema al día." \
    || warn "No se pudieron crear las tablas. Revísalo:  ./deploy.sh --ver-logs"

  log "Sembrando el catálogo base…"
  cli sembrar >/dev/null 2>&1 \
    && ok "Catálogo al día." \
    || warn "No se pudo sembrar el catálogo. Revísalo:  ./deploy.sh --ver-logs"

  # Los permisos se rehacen DESPUÉS: los archivos que escribe el contenedor
  # salen con su propio umask y nginx tiene que poder leerlos.
  preparar_medios
  verificar_medios || warn "Hasta arreglar lo anterior, las fotos no se verán."

  declare -F hook_post_levantar >/dev/null && hook_post_levantar

  # ── Nginx del host y certificado ──────────────────────────────────────────
  SITIO=""
  if [ "$MODO" = "completo" ]; then
    instalar_sitio_nginx
    if [ "$SIN_SSL" -eq 1 ]; then
      warn "--sin-ssl: no se toca el certificado."
    elif [ "$DOMAIN" = "localhost" ]; then
      warn "DOMAIN=localhost: no se emite certificado. Pon tu dominio real en el .env."
    else
      emitir_certificado
    fi
  fi

  # ── Verificación desde fuera del contenedor ───────────────────────────────
  local hay_cert=0
  [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && hay_cert=1
  ESQUEMA="https"; [ "$hay_cert" -eq 1 ] || ESQUEMA="http"

  echo; log "Verificación:"
  # La ruta de salud está exenta de la redirección a HTTPS: responde 200 haya
  # certificado o no, y por eso es la única sonda fiable en ambos casos.
  probe "$RUTA_SALUD" "200" "salud"
  probe "/" "200" "la tienda carga"
  probe "/admin" "200" "el panel carga"
  probe "/api/v1/productos" "200" "el catálogo responde"

  # ── Resumen ───────────────────────────────────────────────────────────────
  echo
  log "==================================================================="
  if [ "$MODO" = "actualizar" ]; then
    log " ${NOMBRE}: actualización completada."
    log "   Tienda:      ${ESQUEMA}://${DOMAIN}"
    log "   Sin tocar:   nginx del host, certificado ni los demás sitios."
  else
    log " ${NOMBRE}: despliegue completado."
    log "   Tienda:      ${ESQUEMA}://${DOMAIN}"
    log "   Panel:       ${ESQUEMA}://${DOMAIN}/admin"
    log " Arquitectura:  nginx del host :80/:443 → 127.0.0.1:${APP_PORT} (frontend React)"
    log "                → ${SERVICIO_WEB}:8000 (gunicorn) → Postgres del host: ${DB_NOMBRE}"
    log " Sitio nginx:   ${SITIO:-(no configurado)}"
    log " Siguiente vez: sudo ./deploy.sh --update   (mucho más rápido)"
    echo
    if [ -n "$ADMIN_PASSWORD_GENERADA" ]; then
      # Se enseña UNA vez, aquí. Después sólo queda en el .env (chmod 600) y en
      # la base, cifrada; recuperarla es imposible, cambiarla es `--admin`.
      log " Panel — usuario: ${ADMIN_USUARIO:-admin}"
      log "         clave:   ${ADMIN_PASSWORD_GENERADA}"
      warn " Apúntala AHORA: no se vuelve a mostrar. Para cambiarla: ./deploy.sh --admin"
    else
      log " Usuario del panel:  ./deploy.sh --admin   (crea o cambia la clave)"
    fi
  fi
  declare -F hook_resumen >/dev/null && hook_resumen
  log " Estado:        ./deploy.sh --estado"
  log " Logs:          ./deploy.sh --ver-logs"
  log " Respaldo:      ./deploy.sh --respaldo"
  log " Ayuda:         ./deploy.sh --help"
  log "==================================================================="

  if [ "$SEGUIR_LOGS" -eq 1 ]; then
    echo; log "Mostrando logs (Ctrl-C para salir)…"
    $COMPOSE logs -f
  fi
}

# ---------------------------------------------------------------------------
comun_main "$@"
