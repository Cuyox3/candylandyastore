"""
Tablas de la base.

El modelo `Producto` es el mismo objeto que manejaba el sitio estático en
productos.js (mismos nombres de campo), para que la tarjeta de la tienda se
pinte exactamente igual sin traducir nada por el camino.
"""

from datetime import datetime, timezone

from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _ahora() -> datetime:
    return datetime.now(timezone.utc)


class Categoria(Base):
    """
    Las categorías que salen en los filtros de la tienda y en el desplegable
    del panel. Son tabla y no una constante del código porque el panel puede
    crearlas, y porque un producto no puede quedarse apuntando a una que ya no
    existe.
    """

    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(60))
    orden: Mapped[int] = mapped_column(Integer, default=0)
    activa: Mapped[bool] = mapped_column(Boolean, default=True)


class Producto(Base):
    __tablename__ = "productos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # El identificador que ve el front ('p-kitkat-matcha'). Se conserva del
    # catálogo estático: los enlaces y el JSON exportado lo siguen usando.
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)

    cat: Mapped[str] = mapped_column(String(40), index=True)
    emoji: Mapped[str] = mapped_column(String(8), default="🍬")
    # Dónde mira la tarjeta para pintar la foto: '/api/v1/fotos/<slug>?v=…',
    # que sirve la fila de `fotos`. Vacío = la tarjeta enseña el emoji.
    # Sigue aceptando una ruta suelta ('/media/productos/xxx.webp') para no
    # romper los productos que se guardaran antes de que las fotos pasaran a
    # la base.
    img: Mapped[str] = mapped_column(String(255), default="")
    nombre: Mapped[str] = mapped_column(String(120))
    origen: Mapped[str] = mapped_column(String(60), default="")
    desc: Mapped[str] = mapped_column(Text, default="")
    # Numeric, no Float: los precios en coma flotante acaban costando $88.99999.
    precio: Mapped[float] = mapped_column(Numeric(10, 2), default=0)
    etiqueta: Mapped[str] = mapped_column(String(40), default="")
    tipo: Mapped[str] = mapped_column(String(20), default="")
    c1: Mapped[str] = mapped_column(String(9), default="#F42A8F")
    c2: Mapped[str] = mapped_column(String(9), default="#FFB8DC")

    # Orden en el que se pintan. Los nuevos van arriba (orden negativo
    # descendente), igual que hacía `lista.unshift(producto)` en el panel viejo.
    orden: Mapped[int] = mapped_column(Integer, default=0, index=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_ahora)
    actualizado: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_ahora, onupdate=_ahora
    )

    # La foto vive aquí colgada, no en disco. `delete-orphan` para que
    # quitarla del producto (producto.foto = None) borre también la fila, y
    # `passive_deletes` para no estorbar al ON DELETE CASCADE cuando el borrado
    # lo hace Postgres —que es lo que pasa al importar un catálogo, donde los
    # productos se van con un DELETE de golpe y sin pasar por el ORM.
    foto: Mapped[Optional["Foto"]] = relationship(
        back_populates="producto",
        cascade="all, delete-orphan",
        passive_deletes=True,
        uselist=False,
    )


class Foto(Base):
    """
    La foto de un producto, guardada en la base y no en el disco.

    Antes el WebP se escribía en MEDIA_ROOT y el producto guardaba la ruta.
    Eso obliga a respaldar dos cosas —la base y una carpeta— y a no
    equivocarse: un pg_dump restaurado sin su carpeta deja el catálogo con las
    tarjetas rotas. Y al borrar un producto había que acordarse de borrar el
    archivo, cosa que no pasaba: quedaban huérfanos para siempre.

    En base64 y no en `bytea` a propósito: es lo que come la etiqueta <img>
    (`data:image/webp;base64,…`), es lo que sube el panel y es lo que
    sobrevive a cualquier volcado en texto sin pelearse con la codificación.
    Ocupa un tercio más; a 40 KB por foto ya reducida, da igual.
    """

    __tablename__ = "fotos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Único: una foto por producto, la de la tarjeta. El CASCADE es de la base
    # (no del ORM) para que la foto caiga también cuando el producto se borra
    # con un DELETE masivo.
    producto_id: Mapped[int] = mapped_column(
        ForeignKey("productos.id", ondelete="CASCADE"), unique=True, index=True
    )

    mime: Mapped[str] = mapped_column(String(40), default="image/webp")
    datos: Mapped[str] = mapped_column(Text)  # base64 pelado, sin el 'data:…,'
    peso: Mapped[int] = mapped_column(Integer, default=0)  # bytes ya comprimidos
    ancho: Mapped[int] = mapped_column(Integer, default=0)
    alto: Mapped[int] = mapped_column(Integer, default=0)
    # Ocho hex del sha256 del WebP. Va en la URL (?v=) y en el ETag: la
    # dirección de la foto no cambia en toda la vida del producto, así que sin
    # esto el navegador se quedaría con la foto vieja para siempre.
    huella: Mapped[str] = mapped_column(String(16), default="")

    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_ahora)

    producto: Mapped["Producto"] = relationship(back_populates="foto")


class Usuario(Base):
    """Quien puede entrar al panel. La contraseña se guarda con bcrypt."""

    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    usuario: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_ahora)


class Suscriptor(Base):
    """Los correos del newsletter. Antes vivían en el localStorage de quien
    se suscribía, que es tanto como no guardarlos."""

    __tablename__ = "suscriptores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_ahora)


class Mensaje(Base):
    """
    El formulario de contacto. Sigue abriendo WhatsApp como siempre, pero
    además queda registrado: un WhatsApp que no se manda no deja rastro de que
    alguien quiso escribir.
    """

    __tablename__ = "mensajes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160))
    tel: Mapped[str] = mapped_column(String(40), default="")
    motivo: Mapped[str] = mapped_column(String(80), default="")
    mensaje: Mapped[str] = mapped_column(Text)
    leido: Mapped[bool] = mapped_column(Boolean, default=False)
    creado: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
