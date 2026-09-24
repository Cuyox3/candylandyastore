"""
Conexión a PostgreSQL.

`pool_pre_ping` no es decorativo: la base vive en el HOST y los contenedores
llegan por la red de Docker. Si Postgres se reinicia (o el firewall corta una
conexión ociosa), sin el ping la primera petición de la mañana revienta con
"server closed the connection unexpectedly" en vez de reconectar sola.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import ajustes

motor = create_engine(
    ajustes.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=ajustes.DEBUG,
)

SesionLocal = sessionmaker(bind=motor, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def obtener_db() -> Generator[Session, None, None]:
    """Dependencia de FastAPI: una sesión por petición, cerrada siempre."""
    db = SesionLocal()
    try:
        yield db
    finally:
        db.close()
