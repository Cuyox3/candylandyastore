"""
Órdenes de mantenimiento que corren DENTRO del contenedor.

Es lo que llama deploy.sh:

    python -m app.cli admin [usuario] [password]   crea o actualiza el admin
    python -m app.cli sembrar [--forzar]           rellena el catálogo base
    python -m app.cli migrar                       crea las tablas que falten
    python -m app.cli listar-usuarios
    python -m app.cli estado

La contraseña se puede pasar como argumento (deploy.sh la lee de la terminal
con `read -s` y no la deja en el historial) o por la variable de entorno
ADMIN_PASSWORD_NUEVA, que es lo que se usa cuando no hay terminal interactiva.
"""

import os
import sys

from sqlalchemy import text

from .database import Base, SesionLocal, motor
from .models import Mensaje, Producto, Suscriptor, Usuario
from .security import cifrar


def _crear_tablas() -> None:
    from . import models  # noqa: F401 - registra los modelos en el metadata

    Base.metadata.create_all(bind=motor)


def cmd_migrar() -> int:
    _crear_tablas()
    print("Tablas creadas/verificadas.")
    return 0


def cmd_sembrar(forzar: bool) -> int:
    from .seed import sembrar

    _crear_tablas()
    with SesionLocal() as db:
        cats, prods = sembrar(db, forzar=forzar)
    print(f"Sembrado: {cats} categoría(s) y {prods} producto(s) nuevos.")
    if forzar:
        print("(--forzar: los que ya existían se reescribieron con el catálogo base)")
    return 0


def cmd_admin(argv: list[str]) -> int:
    usuario = (argv[0] if argv else os.environ.get("ADMIN_USUARIO_NUEVO", "admin")).strip().lower()
    password = argv[1] if len(argv) > 1 else os.environ.get("ADMIN_PASSWORD_NUEVA", "")

    if not password:
        print("Falta la contraseña.", file=sys.stderr)
        print("Uso:  python -m app.cli admin <usuario> <contraseña>", file=sys.stderr)
        return 1
    if len(password) < 8:
        print("La contraseña debe tener al menos 8 caracteres.", file=sys.stderr)
        return 1

    _crear_tablas()
    with SesionLocal() as db:
        existente = db.query(Usuario).filter(Usuario.usuario == usuario).first()
        if existente:
            existente.password_hash = cifrar(password)
            existente.activo = True
            db.commit()
            print(f"Contraseña de «{usuario}» actualizada.")
        else:
            db.add(Usuario(usuario=usuario, password_hash=cifrar(password)))
            db.commit()
            print(f"Usuario «{usuario}» creado.")
    return 0


def cmd_listar_usuarios() -> int:
    with SesionLocal() as db:
        filas = db.query(Usuario).order_by(Usuario.id).all()
    if not filas:
        print("No hay ningún usuario: nadie puede entrar al panel.")
        print("Créalo con:  ./deploy.sh --admin")
        return 0
    for u in filas:
        print(f"  {u.id:>3}  {u.usuario:<20} {'activo' if u.activo else 'DESACTIVADO'}")
    return 0


def cmd_estado() -> int:
    try:
        with SesionLocal() as db:
            db.execute(text("SELECT 1"))
            print("Base de datos: accesible")
            print(f"  productos:    {db.query(Producto).count()}")
            print(f"  usuarios:     {db.query(Usuario).count()}")
            print(f"  suscriptores: {db.query(Suscriptor).count()}")
            print(f"  mensajes:     {db.query(Mensaje).count()}")
    except Exception as err:  # noqa: BLE001
        print(f"Base de datos: NO accesible · {err}", file=sys.stderr)
        return 1
    return 0


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 1

    orden, resto = argv[0], argv[1:]
    if orden == "admin":
        return cmd_admin(resto)
    if orden == "sembrar":
        return cmd_sembrar("--forzar" in resto)
    if orden == "migrar":
        return cmd_migrar()
    if orden == "listar-usuarios":
        return cmd_listar_usuarios()
    if orden == "estado":
        return cmd_estado()

    print(f"Orden desconocida: {orden}", file=sys.stderr)
    print(__doc__, file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
