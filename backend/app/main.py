"""
Candylandia Store — API.

    /api/v1/…        el API (catálogo, acceso, formularios de la tienda)
    /media/…         las fotos subidas desde el panel
    /healthz         la sonda que usa deploy.sh para saber si esto vive
    /api/docs        la documentación interactiva (sólo con DEBUG=True)

La documentación se apaga en producción a propósito: publica el esquema
completo del API —incluidas las rutas del panel— y no aporta nada a quien
entra a comprar dulces.
"""

import logging
import time

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .config import ajustes
from .database import SesionLocal, motor
from .routers import auth, imagenes, productos, tienda

log = logging.getLogger("candylandia")
logging.basicConfig(
    level=logging.DEBUG if ajustes.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s · %(message)s",
)

app = FastAPI(
    title="Candylandia Store API",
    description="Catálogo de dulces de importación y panel de administración.",
    version="1.0.0",
    docs_url="/api/docs" if ajustes.DEBUG else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if ajustes.DEBUG else None,
)

# ── CORS ───────────────────────────────────────────────────────────────────
# En la VPS el front y el API comparten dominio y esto no llega a usarse.
# Hace falta en desarrollo, con Vite en :5173 hablando con uvicorn en :8000.
if ajustes.cors:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=ajustes.cors,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ── Errores de validación en castellano ────────────────────────────────────
# Sin esto, guardar un producto con el precio vacío devuelve el volcado de
# Pydantic —"body.precio · Input should be a valid number"— y el panel lo
# enseña tal cual a quien está subiendo un dulce.
#
# Sólo se traducen los mensajes que de verdad puede ver alguien usando el
# panel. Los raros pasan tal cual: un mensaje en inglés se entiende a medias,
# pero uno traducido a lo bruto puede decir algo que no es.
_TIPOS = {
    "missing": "es obligatorio",
    "string_too_short": "es demasiado corto",
    "string_too_long": "es demasiado largo",
    "greater_than": "tiene que ser mayor que {limite}",
    "less_than_equal": "no puede pasar de {limite}",
    "int_parsing": "tiene que ser un número entero",
    "float_parsing": "tiene que ser un número",
    "decimal_parsing": "tiene que ser un número",
    "value_error": "{msg}",
    "bool_parsing": "tiene que ser sí o no",
}

_CAMPOS = {
    "nombre": "El nombre",
    "cat": "La categoría",
    "precio": "El precio",
    "origen": "El país de origen",
    "emoji": "El emoji",
    "desc": "La descripción",
    "etiqueta": "La etiqueta",
    "c1": "El primer color",
    "c2": "El segundo color",
    "email": "El correo",
    "mensaje": "El mensaje",
    "password": "La contraseña",
    "password_nueva": "La contraseña nueva",
    "archivo": "El archivo",
}


def _en_castellano(error: dict) -> str:
    campo = next(
        (str(p) for p in reversed(error["loc"]) if p not in ("body", "query", "path")),
        "",
    )
    etiqueta = _CAMPOS.get(campo, f"«{campo}»" if campo else "El dato")

    plantilla = _TIPOS.get(error["type"])
    if plantilla is None:
        return f"{etiqueta}: {error['msg']}"

    ctx = error.get("ctx") or {}
    # value_error lleva el texto de nuestros propios validadores, que ya está
    # en castellano; Pydantic le antepone "Value error, " y sobra.
    msg = str(error["msg"]).replace("Value error, ", "")
    texto = plantilla.format(
        limite=ctx.get("gt", ctx.get("le", ctx.get("max_length", ctx.get("min_length", "")))),
        msg=msg,
    )
    return f"{etiqueta} {texto}" if error["type"] != "value_error" else msg


@app.exception_handler(RequestValidationError)
async def _validacion(request: Request, exc: RequestValidationError):
    problemas = [_en_castellano(e) for e in exc.errors()]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": " · ".join(problemas) or "Revisa los datos enviados."},
    )


# ── Rutas ──────────────────────────────────────────────────────────────────
PREFIJO = "/api/v1"
app.include_router(auth.router, prefix=PREFIJO)
app.include_router(productos.router, prefix=PREFIJO)
app.include_router(imagenes.router, prefix=PREFIJO)
app.include_router(tienda.router, prefix=PREFIJO)


@app.get("/healthz", tags=["salud"])
@app.get("/api/healthz", tags=["salud"])
def salud():
    """
    Sonda de vida. Toca la base a propósito: un proceso que responde pero no
    llega a Postgres está caído para todo lo que importa, y un 200 alegre en
    esa situación es peor que no tener sonda.
    """
    try:
        with SesionLocal() as db:
            db.execute(text("SELECT 1"))
        base = "ok"
    except Exception as err:  # noqa: BLE001 - se informa, no se propaga
        log.error("healthz: la base no responde · %s", err)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"estado": "sin base de datos", "detalle": str(err)[:200]},
        )
    return {"estado": "ok", "base": base, "sitio": ajustes.SITE_NAME}


@app.get("/api/v1/config", tags=["tienda"])
def configuracion():
    """Lo que el front necesita saber del servidor y no quiere llevar fijo."""
    return {
        "sitio": ajustes.SITE_NAME,
        "whatsapp": ajustes.WHATSAPP,
        "media_url": ajustes.MEDIA_URL,
    }


# ── Archivos subidos ───────────────────────────────────────────────────────
# En la VPS los sirve el nginx del host desde el disco y esta ruta no se usa;
# se monta igualmente para que en desarrollo (uvicorn a secas) las fotos se
# vean sin montar nginx.
_media = ajustes.MEDIA_ROOT
try:
    import os

    os.makedirs(_media, exist_ok=True)
    app.mount(ajustes.MEDIA_URL, StaticFiles(directory=_media), name="media")
except OSError as err:
    log.warning("No se pudo montar %s: %s", _media, err)


# ── Arranque ───────────────────────────────────────────────────────────────
@app.on_event("startup")
def al_arrancar():
    """
    Espera a Postgres y deja la base lista.

    El contenedor arranca a la vez que todo lo demás; si la base tarda un
    segundo más, sin esta espera el proceso muere y Docker lo reinicia en
    bucle sin decir por qué.
    """
    from .database import Base  # noqa: F401 - registra los modelos
    from . import models  # noqa: F401
    from .seed import sembrar
    from .models import Usuario
    from .security import cifrar

    ultimo = None
    for intento in range(1, 31):
        try:
            with motor.connect() as con:
                con.execute(text("SELECT 1"))
            break
        except Exception as err:  # noqa: BLE001
            ultimo = err
            log.info("Esperando a Postgres (%s/30)…", intento)
            time.sleep(2)
    else:
        log.error("Postgres no respondió: %s", ultimo)
        raise SystemExit(1)

    # `create_all` en vez de migraciones: el esquema son cinco tablas y no hay
    # histórico que conservar. Si el modelo crece, Alembic ya está instalado.
    Base.metadata.create_all(bind=motor)

    with SesionLocal() as db:
        cats, prods = sembrar(db)
        if cats or prods:
            log.info("Catálogo sembrado: %s categoría(s), %s producto(s).", cats, prods)

        # El administrador del panel. Sólo se crea si no hay ninguno: la
        # contraseña del .env NO pisa la de un usuario que ya existe, porque
        # entonces cambiarla desde el panel no serviría de nada.
        if db.query(Usuario).count() == 0:
            if not ajustes.ADMIN_PASSWORD:
                log.warning(
                    "No hay usuarios y ADMIN_PASSWORD está vacía: nadie puede "
                    "entrar al panel. Créalo con  ./deploy.sh --admin"
                )
            else:
                db.add(
                    Usuario(
                        usuario=ajustes.ADMIN_USUARIO.strip().lower(),
                        email=ajustes.ADMIN_EMAIL,
                        password_hash=cifrar(ajustes.ADMIN_PASSWORD),
                    )
                )
                db.commit()
                log.info("Usuario administrador «%s» creado.", ajustes.ADMIN_USUARIO)
