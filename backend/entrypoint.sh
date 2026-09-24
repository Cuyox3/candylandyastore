#!/usr/bin/env sh
#
# Arranque del backend.
#
# La preparación de la base (esperar a Postgres, crear las tablas, sembrar el
# catálogo) NO se hace aquí sino en el `startup` de FastAPI: con varios workers
# de gunicorn, hacerlo en el entrypoint significaría que sólo uno lo hace y el
# resto arranca a ciegas, o que todos lo hacen a la vez y pelean por el mismo
# INSERT.
set -e

WORKERS="${GUNICORN_WORKERS:-3}"
PUERTO="${PUERTO_BACKEND:-8000}"

echo "[backend] arrancando gunicorn con ${WORKERS} worker(s) en :${PUERTO}"

# UvicornWorker porque la app es ASGI; gunicorn sólo aporta el maestro que
# reinicia workers muertos. --timeout 120: subir una foto de 8 MB y
# recomprimirla puede pasarse de los 30 segundos por defecto.
exec gunicorn app.main:app \
    --worker-class uvicorn.workers.UvicornWorker \
    --workers "$WORKERS" \
    --bind "0.0.0.0:${PUERTO}" \
    --timeout 120 \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --access-logfile - \
    --error-logfile - \
    --forwarded-allow-ips '*'
