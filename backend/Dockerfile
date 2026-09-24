# ─────────────────────────────────────────────────────────────────────────────
# Candylandia Store — backend (FastAPI + gunicorn/uvicorn)
#
# `slim` y no `alpine`: Pillow y psycopg traen ruedas precompiladas para glibc
# y en Alpine habría que compilarlas, lo que convierte un build de 40 segundos
# en uno de varios minutos sin ganar nada de tamaño real.
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# libpq5 para psycopg, el cliente de Postgres para los respaldos
# (`deploy.sh --respaldo` corre pg_dump DENTRO de este contenedor, que es
# quien tiene la DATABASE_URL), y curl para el HEALTHCHECK.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 postgresql-client curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Las dependencias en su propia capa: mientras requirements.txt no cambie,
# reconstruir tras tocar el código no vuelve a bajar nada.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Nada corre como root. El uid 1000 es el mismo que usa deploy.sh al hacer
# chown de la carpeta de medios en el host: si no coinciden, el contenedor no
# puede escribir las fotos que se suben desde el panel.
RUN useradd --uid 1000 --create-home candy \
    && mkdir -p /app/media/productos \
    && chown -R candy:candy /app
USER candy

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/healthz || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
