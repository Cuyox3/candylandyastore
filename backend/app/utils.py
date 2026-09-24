"""Piezas sueltas que usan varios routers."""

import re
import unicodedata
from datetime import datetime, timezone


def slugificar(texto: str, largo: int = 60) -> str:
    """
    'Kit Kat Matcha' → 'kit-kat-matcha'.

    Es la misma transformación que hacía `nuevoId()` en productos.js
    (NFD + quitar diacríticos), para que un catálogo exportado del sitio
    estático se pueda importar aquí y los ids sigan pareciéndose.
    """
    base = unicodedata.normalize("NFD", str(texto or "producto"))
    base = "".join(c for c in base if unicodedata.category(c) != "Mn")
    base = base.lower()
    base = re.sub(r"[^a-z0-9]+", "-", base).strip("-")
    return (base[:largo] or "producto")


def slug_libre(db, modelo, texto: str) -> str:
    """
    Un slug que no choque con ninguno existente.

    El panel viejo colgaba `Date.now()` al final y confiaba en que no se
    repitiera. Aquí se comprueba de verdad contra la base: dos productos con
    el mismo slug harían que el segundo reventara el INSERT por el índice
    único, y el mensaje que ve quien lo guarda no diría nada útil.
    """
    base = slugificar(texto)
    candidato = base
    n = 2
    while db.query(modelo).filter(modelo.slug == candidato).first() is not None:
        candidato = f"{base}-{n}"
        n += 1
    return candidato


def slug_en_lote(deseado: str, nombre: str, usados: set[str]) -> str:
    """
    El slug de un producto dentro de una importación, sin tocar la base.

    Conserva el id que traía el respaldo —el panel estático volcaba el JSON
    tal cual, y así un enlace guardado a un producto sigue valiendo después
    de restaurar—, pasado por `slugificar` porque ese JSON lo ha podido tocar
    cualquiera a mano. Si falta o ya está cogido, se saca del nombre.

    Lo reservado se lleva en `usados` y NO se consulta a la base a propósito:
    la sesión es `autoflush=False`, o sea que las filas que se van añadiendo
    no existen para Postgres hasta el commit. Preguntándole a él, dos
    productos del mismo JSON que se llamen igual (o que repitan id) se
    llevarían los dos el mismo slug y el INSERT final moriría con
    «duplicate key value violates unique constraint "ix_productos_slug"».
    """
    candidato = slugificar(deseado) if deseado else ""
    if candidato and candidato not in usados:
        return candidato

    base = slugificar(nombre)
    candidato = base
    n = 2
    while candidato in usados:
        candidato = f"{base}-{n}"
        n += 1
    return candidato


def ahora() -> datetime:
    return datetime.now(timezone.utc)
