"""
Acceso al panel: contraseñas con bcrypt y sesión con JWT.

Esto es lo que el sitio estático NO podía tener. Allí el usuario y la clave
viajaban dentro de admin.js: cualquiera que abriera el archivo los veía, y la
"protección" sólo servía para que nadie tocara el panel por accidente. Aquí la
contraseña se guarda cifrada en la base y el token lo firma el servidor.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from .config import ajustes
from .database import obtener_db
from .models import Usuario

esquema = HTTPBearer(auto_error=False)


def _bytes(password: str) -> bytes:
    """
    bcrypt sólo mira los primeros 72 BYTES —no caracteres— y con la versión 4
    lanza un error si le llegan más. Se corta aquí, sobre los bytes: una
    contraseña con acentos o emojis ocupa más de lo que parece y cortarla por
    caracteres seguiría pasándose del límite.
    """
    return password.encode("utf-8")[:72]


def cifrar(password: str) -> str:
    return bcrypt.hashpw(_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verificar(password: str, hash_guardado: str) -> bool:
    try:
        return bcrypt.checkpw(_bytes(password), hash_guardado.encode("utf-8"))
    except (ValueError, TypeError):
        # Hash corrupto o de otro algoritmo: no es válido, pero tampoco un 500.
        return False


def crear_token(usuario: str) -> tuple[str, int]:
    """Devuelve (token, segundos de validez)."""
    segundos = ajustes.JWT_MINUTOS * 60
    datos = {
        "sub": usuario,
        "exp": datetime.now(timezone.utc) + timedelta(seconds=segundos),
        "iat": datetime.now(timezone.utc),
    }
    token = jwt.encode(datos, ajustes.SECRET_KEY, algorithm=ajustes.JWT_ALGORITMO)
    return token, segundos


NO_AUTORIZADO = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Necesitas iniciar sesión en el panel.",
    headers={"WWW-Authenticate": "Bearer"},
)


def admin_actual(
    credenciales: Optional[HTTPAuthorizationCredentials] = Depends(esquema),
    db: Session = Depends(obtener_db),
) -> Usuario:
    """
    Dependencia de las rutas del panel. Todo lo que escriba en el catálogo
    tiene que pasar por aquí; la tienda pública no la usa.
    """
    if credenciales is None:
        raise NO_AUTORIZADO

    try:
        datos = jwt.decode(
            credenciales.credentials,
            ajustes.SECRET_KEY,
            algorithms=[ajustes.JWT_ALGORITMO],
        )
    except JWTError:
        raise NO_AUTORIZADO

    nombre = datos.get("sub")
    if not nombre:
        raise NO_AUTORIZADO

    usuario = db.query(Usuario).filter(Usuario.usuario == nombre).first()
    if usuario is None or not usuario.activo:
        # El token puede seguir siendo válido después de borrar la cuenta.
        raise NO_AUTORIZADO
    return usuario
