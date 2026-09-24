"""
Configuración del backend. TODO lo que cambia entre tu máquina y la VPS se
lee del .env; nada de credenciales escritas en el código.

Las variables se leen una sola vez al arrancar (`ajustes` es un singleton
cacheado), así que un cambio en el .env necesita reiniciar el contenedor:
    ./deploy.sh --reiniciar
"""

from functools import lru_cache
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Ajustes(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",          # el .env es común al back y al front
        case_sensitive=False,
    )

    # ── Identidad ──────────────────────────────────────────────────────────
    SITE_NAME: str = "Candylandia Store"
    SITE_URL: str = "http://localhost:8520"
    DEBUG: bool = False

    # ── Base de datos ──────────────────────────────────────────────────────
    # Una URL de SQLAlchemy. En la VPS apunta al Postgres del host:
    #   postgresql+psycopg://candylandia:...@host.docker.internal:5432/candylandia
    DATABASE_URL: str = "postgresql+psycopg://candylandia:candylandia@localhost:5432/candylandia"

    # ── Seguridad ──────────────────────────────────────────────────────────
    SECRET_KEY: str = "cambiame-en-el-env"
    JWT_ALGORITMO: str = "HS256"
    # Minutos que dura la sesión del panel. 12 h: una jornada de trabajo sin
    # tener que volver a escribir la clave.
    JWT_MINUTOS: int = 720

    # Usuario administrador que se crea en el primer arranque. Si ya existe,
    # NO se toca la contraseña: cambiarla es `./deploy.sh --admin`.
    ADMIN_USUARIO: str = "admin"
    ADMIN_PASSWORD: str = ""
    ADMIN_EMAIL: str = ""

    # ── CORS ───────────────────────────────────────────────────────────────
    # En producción el front y el API salen por el MISMO dominio (nginx hace
    # de proxy), así que esta lista puede quedarse vacía. Sirve para el
    # desarrollo, donde Vite corre en :5173 y el API en :8000.
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ── Archivos subidos ───────────────────────────────────────────────────
    MEDIA_ROOT: str = "/app/media"
    MEDIA_URL: str = "/media"
    # Lado más largo al que se reduce cada foto, igual que hacía el panel
    # estático en el navegador (imagenes.js).
    IMAGEN_LADO_MAX: int = 560
    IMAGEN_CALIDAD: int = 82
    IMAGEN_PESO_MAX: int = 8 * 1024 * 1024  # 8 MB del archivo original

    # ── Contacto ───────────────────────────────────────────────────────────
    WHATSAPP: str = "5215512345678"

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalizar_url(cls, valor: str) -> str:
        """
        `postgres://` y `postgresql://` son lo que escribe todo el mundo (y lo
        que genera deploy.sh), pero SQLAlchemy necesita saber QUÉ driver usar.
        Sin esto intenta cargar psycopg2, que no está instalado, y el arranque
        muere con un ModuleNotFoundError que no menciona la URL para nada.
        """
        if valor.startswith("postgres://"):
            valor = valor.replace("postgres://", "postgresql+psycopg://", 1)
        elif valor.startswith("postgresql://"):
            valor = valor.replace("postgresql://", "postgresql+psycopg://", 1)
        return valor

    @property
    def cors(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def obtener_ajustes() -> Ajustes:
    return Ajustes()


ajustes = obtener_ajustes()
