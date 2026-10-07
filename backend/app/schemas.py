"""
Esquemas de entrada y salida (Pydantic).

Los nombres de campo son los mismos que usaba productos.js, así el React
recibe el objeto listo para pintar la tarjeta.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from .config import ajustes


# ── Productos ──────────────────────────────────────────────────────────────

def _color_hex(v: str) -> str:
    """
    Sólo #rgb / #rrggbb. El color entra tal cual en el `style` de la tarjeta;
    aceptar cualquier cadena sería dejar escribir CSS a quien pueda llamar al
    API. Se usa desde los dos esquemas, así que vive fuera de ellos: en
    Pydantic v2 un validador declarado en la clase padre no se puede
    "reutilizar" desde otra que no herede de ella.
    """
    if v is None:
        return v
    v = v.strip()
    if not v.startswith("#") or len(v) not in (4, 7):
        raise ValueError("El color debe ser hexadecimal, por ejemplo #F42A8F")
    int(v[1:], 16)  # lanza ValueError si no es hexadecimal
    return v.upper()


# Lo que puede ocupar un `data:` en el campo `img`: el tope de subida más el
# tercio que engorda al pasar a base64, y algo de holgura para la cabecera.
# Es el mismo límite que aplica el endpoint de subida, para que una foto que
# el panel acepta no la rechace después el guardado del producto.
_DATA_URL_MAX = ajustes.IMAGEN_PESO_MAX * 4 // 3 + 128


def _img_valida(v: str) -> str:
    """
    `img` admite dos formas y cada una tiene su tope.

    Una ruta ('/api/v1/fotos/p-algo?v=1a2b3c4d') cabe en la columna, que es de
    255. Una foto recién subida llega entera en base64 y ocupa lo que ocupe:
    el servidor la convierte en fila de `fotos` antes de guardar el producto,
    y lo que acaba en la columna vuelve a ser una ruta. Sin esta distinción,
    un `max_length=255` a secas rechaza cualquier foto.
    """
    if v.startswith("data:"):
        if len(v) > _DATA_URL_MAX:
            raise ValueError("La foto es demasiado grande. Usa una más ligera.")
        return v
    if len(v) > 255:
        raise ValueError("La dirección de la foto es demasiado larga.")
    return v.strip()


class ProductoBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    cat: str = Field(min_length=1, max_length=40)
    precio: float = Field(gt=0, le=999_999)
    origen: str = Field(default="", max_length=60)
    emoji: str = Field(default="🍬", max_length=8)
    desc: str = Field(default="", max_length=400)
    etiqueta: str = Field(default="", max_length=40)
    tipo: str = Field(default="", max_length=20)
    c1: str = Field(default="#F42A8F", max_length=9)
    c2: str = Field(default="#FFB8DC", max_length=9)
    img: str = Field(default="")
    activo: bool = True

    @field_validator("nombre", "origen", "desc", "etiqueta")
    @classmethod
    def _sin_espacios_sobrantes(cls, v: str) -> str:
        return v.strip()

    @field_validator("c1", "c2")
    @classmethod
    def _color_valido(cls, v: str) -> str:
        return _color_hex(v)

    @field_validator("img")
    @classmethod
    def _img_razonable(cls, v: str) -> str:
        return _img_valida(v)


class ProductoCrear(ProductoBase):
    pass


class ProductoEditar(BaseModel):
    """Todo opcional: el panel manda sólo lo que cambió."""

    nombre: Optional[str] = Field(default=None, min_length=1, max_length=120)
    cat: Optional[str] = Field(default=None, max_length=40)
    precio: Optional[float] = Field(default=None, gt=0, le=999_999)
    origen: Optional[str] = Field(default=None, max_length=60)
    emoji: Optional[str] = Field(default=None, max_length=8)
    desc: Optional[str] = Field(default=None, max_length=400)
    etiqueta: Optional[str] = Field(default=None, max_length=40)
    tipo: Optional[str] = Field(default=None, max_length=20)
    c1: Optional[str] = Field(default=None, max_length=9)
    c2: Optional[str] = Field(default=None, max_length=9)
    img: Optional[str] = Field(default=None)
    activo: Optional[bool] = None
    orden: Optional[int] = None

    @field_validator("c1", "c2")
    @classmethod
    def _color_valido(cls, v):
        return _color_hex(v)

    @field_validator("img")
    @classmethod
    def _img_razonable(cls, v):
        return v if v is None else _img_valida(v)


class ProductoSalida(ProductoBase):
    # `id` se lee del SLUG, no de la clave primaria. El front heredó del sitio
    # estático la idea de que el id de un producto es 'p-kitkat-matcha', y sin
    # el alias Pydantic toma el entero de la tabla y la validación revienta.
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str = Field(default="", validation_alias="slug")
    orden: int = 0
    creado: Optional[datetime] = None

    @field_validator("precio", mode="before")
    @classmethod
    def _a_numero(cls, v):
        # Numeric de SQLAlchemy llega como Decimal y JSON no sabe serializarlo.
        return float(v) if v is not None else 0.0


class ProductoImportar(ProductoCrear):
    """
    Un producto tal y como sale de `/catalogo/exportar`.

    El `id` (que es el slug) viaja de vuelta para poder conservarlo al
    restaurar. Es opcional: un JSON escrito a mano puede no traerlo, y
    entonces el slug se saca del nombre como al crear desde el panel.
    """

    id: str = Field(default="", max_length=60)


class CatalogoImportar(BaseModel):
    """Reemplaza el catálogo entero con el JSON que exporta el panel."""

    productos: list[ProductoImportar]


# ── Categorías ─────────────────────────────────────────────────────────────

class CategoriaBase(BaseModel):
    slug: str = Field(min_length=1, max_length=40, pattern=r"^[a-z0-9-]+$")
    label: str = Field(min_length=1, max_length=60)
    orden: int = 0
    activa: bool = True


class CategoriaSalida(CategoriaBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CategoriaEditar(BaseModel):
    """
    Cambios sueltos sobre una categoría: lo que no venga, no se toca.

    El `slug` NO está aquí a propósito, no se puede cambiar. Es lo que cada
    producto guarda en su campo `cat`, así que renombrarlo dejaría a todos los
    productos de esa categoría apuntando a una que ya no existe: fuera de los
    filtros de la tienda y, a ojos del dueño, desaparecidos. Para cambiar el
    nombre que se ve está `label`, que es justo para eso.
    """

    label: Optional[str] = Field(default=None, min_length=1, max_length=60)
    orden: Optional[int] = None
    activa: Optional[bool] = None


# ── Etiquetas ──────────────────────────────────────────────────────────────
# Los colores que sabe pintar styles.css. Esta lista y el CSS van a la par:
# meter aquí un color que el CSS no conoce deja la pastilla en el rosa de
# `.tag` sin que nada avise.
COLORES = {
    "": "Rosa",
    "nuevo": "Cian",
    "top": "Amarillo",
    "verde": "Verde",
    "morado": "Morado",
}


def _texto_plano(v: str) -> str:
    """Un salto de línea dentro de la pastilla sólo sirve para descuadrarla."""
    return " ".join(str(v).split())


class EtiquetaBase(BaseModel):
    etiqueta: str = Field(min_length=1, max_length=40)
    tipo: str = Field(default="", max_length=20)
    orden: int = 0
    activa: bool = True

    @field_validator("etiqueta")
    @classmethod
    def _limpia(cls, v: str) -> str:
        return _texto_plano(v)

    @field_validator("tipo")
    @classmethod
    def _color_conocido(cls, v: str) -> str:
        if v not in COLORES:
            nombres = ", ".join(c or "(vacío, rosa)" for c in COLORES)
            raise ValueError(f"Ese color no existe. Los que hay son: {nombres}.")
        return v


class EtiquetaEditar(BaseModel):
    etiqueta: Optional[str] = Field(default=None, min_length=1, max_length=40)
    tipo: Optional[str] = Field(default=None, max_length=20)
    orden: Optional[int] = None
    activa: Optional[bool] = None

    @field_validator("etiqueta")
    @classmethod
    def _limpia(cls, v: Optional[str]) -> Optional[str]:
        return v if v is None else _texto_plano(v)

    @field_validator("tipo")
    @classmethod
    def _color_conocido(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in COLORES:
            raise ValueError("Ese color no existe.")
        return v


class EtiquetaSalida(BaseModel):
    """
    Lo que consume el desplegable del panel.

    `label` no está en la tabla: se arma con el texto y el nombre del color
    («Top ventas (Amarillo)»). El formulario lo usa de `key` en React, y sale
    único porque `etiqueta` lo es.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int = 0
    etiqueta: str = ""
    tipo: str = ""
    orden: int = 0
    activa: bool = True
    label: str = ""


# ── Acceso ─────────────────────────────────────────────────────────────────

class Credenciales(BaseModel):
    usuario: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expira_en: int          # segundos
    usuario: str


class CambioPassword(BaseModel):
    password_actual: str
    password_nueva: str = Field(min_length=8, max_length=128)


class UsuarioSalida(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario: str
    email: str = ""


# ── Tienda ─────────────────────────────────────────────────────────────────

class SuscriptorCrear(BaseModel):
    email: EmailStr


class MensajeCrear(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    email: EmailStr
    tel: str = Field(default="", max_length=40)
    motivo: str = Field(default="", max_length=80)
    mensaje: str = Field(min_length=1, max_length=2000)


class MensajeSalida(MensajeCrear):
    model_config = ConfigDict(from_attributes=True)

    id: int
    leido: bool = False
    creado: Optional[datetime] = None


class Respuesta(BaseModel):
    """Respuesta simple para las acciones que no devuelven un objeto."""

    ok: bool = True
    detalle: str = ""


class SubidaImagen(BaseModel):
    img: str          # 'data:image/webp;base64,…', listo para el <img> y para guardar
    peso: int         # bytes del WebP comprimido (el base64 abulta un tercio más)
    ancho: int
    alto: int
