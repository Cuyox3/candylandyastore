"""
Las fotos de producto: de lo que llega a la fila de `fotos`.

Todo lo que entre pasa por `procesar`, venga del formulario del panel (una
subida con multipart) o de un `data:` dentro del JSON de importación. Así lo
guardado es siempre lo mismo: un WebP de como mucho IMAGEN_LADO_MAX píxeles,
en base64. Lo que el panel manda es indiferente —PNG de 4 MB incluido—, a la
tabla llega ya reducido.

La foto NO se toca en el endpoint de subida: ahí sólo se comprime y se
devuelve. Se guarda cuando se guarda el producto, y por eso no quedan fotos
sueltas de formularios que alguien empezó y no llegó a enviar.
"""

import base64
import binascii
import hashlib
import io

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import object_session

from .config import ajustes
from .models import Foto, Producto

# El prefijo de las URL que sirve routers/imagenes.py. Se guarda en
# Producto.img, así que cambiarlo deja apuntando a ninguna parte las fotos ya
# guardadas.
RUTA = "/api/v1/fotos"

TIPOS = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"}
MIME = "image/webp"


def procesar(crudo: bytes) -> Foto:
    """
    Comprime la imagen y devuelve la fila lista, todavía sin producto.

    Levanta HTTPException, no excepciones propias: lo llaman dos routers y en
    los dos casos el error acaba en el panel de quien está subiendo la foto.
    """
    if len(crudo) > ajustes.IMAGEN_PESO_MAX:
        limite = ajustes.IMAGEN_PESO_MAX // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen pesa más de {limite} MB. Usa una más ligera.",
        )

    try:
        imagen = Image.open(io.BytesIO(crudo))
        imagen.load()
    except (UnidentifiedImageError, OSError):
        # El Content-Type dice "imagen" pero el contenido no lo es. Pasa con
        # archivos renombrados, y a veces no es un descuido.
        raise HTTPException(status_code=400, detail="El archivo no es una imagen válida.")

    lado = ajustes.IMAGEN_LADO_MAX

    # Si ya es un WebP dentro de medidas, se guarda tal cual. Y lo es siempre
    # que venga del endpoint de subida, que acaba de generarlo: el panel sube
    # la foto, el servidor la comprime y le devuelve el base64, y ese mismo
    # base64 vuelve aquí al guardar el producto. Sin este atajo, toda foto
    # pasaría dos veces por el compresor —y una más por cada exportar e
    # importar—, perdiendo calidad en cada vuelta sin ganar un byte.
    if imagen.format == "WEBP" and imagen.mode == "RGB" and max(imagen.size) <= lado:
        return _fila(crudo, imagen.width, imagen.height)

    # RGBA → RGB: WebP admite alfa, pero una foto de producto con canal alfa
    # sobre el degradado de la tarjeta se ve como un recorte sucio.
    if imagen.mode in ("RGBA", "LA", "P"):
        fondo = Image.new("RGB", imagen.size, (255, 255, 255))
        imagen = imagen.convert("RGBA")
        fondo.paste(imagen, mask=imagen.split()[-1])
        imagen = fondo
    elif imagen.mode != "RGB":
        imagen = imagen.convert("RGB")

    if max(imagen.size) > lado:
        imagen.thumbnail((lado, lado), Image.LANCZOS)

    buffer = io.BytesIO()
    imagen.save(buffer, "WEBP", quality=ajustes.IMAGEN_CALIDAD, method=6)

    return _fila(buffer.getvalue(), imagen.width, imagen.height)


def _fila(comprimido: bytes, ancho: int, alto: int) -> Foto:
    return Foto(
        mime=MIME,
        datos=base64.b64encode(comprimido).decode("ascii"),
        peso=len(comprimido),
        ancho=ancho,
        alto=alto,
        # Ocho hex bastan: sólo tiene que distinguir la foto de un producto de
        # la SIGUIENTE foto de ese mismo producto, no de todas las del mundo.
        huella=hashlib.sha256(comprimido).hexdigest()[:8],
    )


def data_url(foto: Foto) -> str:
    """La foto como la quiere un <img src>, que es como la manda el panel."""
    return f"data:{foto.mime};base64,{foto.datos}"


def contenido(foto: Foto) -> bytes:
    return base64.b64decode(foto.datos)


def ruta(slug: str, foto: Foto) -> str:
    """
    '/api/v1/fotos/p-algo?v=1a2b3c4d'.

    La versión va en la dirección porque la dirección es la misma durante toda
    la vida del producto: sin ella, cambiar la foto desde el panel dejaría al
    navegador enseñando la anterior hasta que alguien vaciara su caché.
    """
    return f"{RUTA}/{slug}?v={foto.huella}"


def copia(foto: Foto) -> Foto:
    """La misma foto en una fila nueva, para reengancharla a otro producto."""
    return Foto(
        mime=foto.mime,
        datos=foto.datos,
        peso=foto.peso,
        ancho=foto.ancho,
        alto=foto.alto,
        huella=foto.huella,
    )


def _de_data_url(valor: str) -> bytes:
    cabecera, _, carga = valor.partition(",")
    if not carga or "base64" not in cabecera:
        raise HTTPException(status_code=400, detail="La foto tiene que venir en base64.")

    tipo = cabecera[len("data:"):].split(";")[0]
    if tipo and tipo not in TIPOS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Sube una imagen PNG, JPG, WebP, GIF o AVIF.",
        )

    try:
        return base64.b64decode(carga, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="La foto no se entiende: el base64 no es válido.")


def _soltar(producto: Producto) -> None:
    """
    Quita la foto que tuviera y manda el DELETE a la base en el momento.

    Dentro de un mismo flush, SQLAlchemy hace los INSERT antes que los DELETE.
    Cambiar la foto de un producto es las dos cosas a la vez, así que sin este
    flush la fila nueva entra mientras la vieja sigue ahí y Postgres la para
    con «duplicate key … ix_fotos_producto_id»: sólo cabe una foto por
    producto, que es justo lo que se quiere.
    """
    if producto.foto is None:
        return

    producto.foto = None
    sesion = object_session(producto)
    if sesion is not None:
        sesion.flush()


def aplicar(producto: Producto, valor: str | None) -> None:
    """
    Deja la foto del producto como diga `valor` y le ajusta `img`.

    Los cuatro casos que manda el panel:

      None    un PATCH que no habla de la foto: no se toca.
      ''      se quitó la foto; la tarjeta vuelve al emoji y la fila se borra.
      'data:' foto nueva: se comprime y se guarda colgada del producto.
      otra    una ruta. Si es la que ya tenía —el panel devuelve `img` tal
              cual cuando nadie tocó la foto— no pasa nada; si es otra, la
              foto guardada sobra y se va con ella.
    """
    if valor is None:
        return

    if not valor:
        _soltar(producto)
        producto.img = ""
        return

    if not valor.startswith("data:"):
        if valor != producto.img:
            _soltar(producto)
        producto.img = valor
        return

    foto = procesar(_de_data_url(valor))
    _soltar(producto)
    producto.foto = foto
    producto.img = ruta(producto.slug, foto)
