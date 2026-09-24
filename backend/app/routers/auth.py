"""
Acceso al panel: /api/v1/auth/…

  POST /login      usuario + contraseña → token
  GET  /yo         quién soy (sirve para saber si el token sigue vivo)
  POST /password   cambiar la propia contraseña
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import obtener_db
from ..models import Usuario
from ..schemas import (
    CambioPassword,
    Credenciales,
    Respuesta,
    Token,
    UsuarioSalida,
)
from ..security import admin_actual, cifrar, crear_token, verificar

router = APIRouter(prefix="/auth", tags=["acceso"])


@router.post("/login", response_model=Token)
def login(datos: Credenciales, db: Session = Depends(obtener_db)):
    usuario = (
        db.query(Usuario)
        .filter(Usuario.usuario == datos.usuario.strip().lower())
        .first()
    )

    # El mismo mensaje y el mismo tiempo para "no existe" y "clave mala": decir
    # cuál de los dos falló es regalar la mitad del trabajo a quien prueba.
    if usuario is None or not verificar(datos.password, usuario.password_hash):
        # verificar() sobre un hash de mentira para que el tiempo de respuesta
        # no delate si el usuario existe.
        if usuario is None:
            verificar(datos.password, cifrar("hash-de-relleno"))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o clave incorrectos. Inténtalo de nuevo.",
        )

    if not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta está desactivada.",
        )

    token, segundos = crear_token(usuario.usuario)
    return Token(access_token=token, expira_en=segundos, usuario=usuario.usuario)


@router.get("/yo", response_model=UsuarioSalida)
def yo(actual: Usuario = Depends(admin_actual)):
    return actual


@router.post("/password", response_model=Respuesta)
def cambiar_password(
    datos: CambioPassword,
    actual: Usuario = Depends(admin_actual),
    db: Session = Depends(obtener_db),
):
    if not verificar(datos.password_actual, actual.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La contraseña actual no es correcta.",
        )
    actual.password_hash = cifrar(datos.password_nueva)
    db.commit()
    return Respuesta(detalle="Contraseña cambiada.")
