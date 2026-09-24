"""
Fotos de producto: /api/v1/imagenes

El panel estático tenía que pedirle al navegador que escribiera el archivo en
la carpeta del proyecto (File System Access API) y, cuando el navegador no
sabía, descargarlo para que lo movieras a mano. Con backend eso desaparece:
la foto se sube, se comprime en el servidor y queda en disco.

El archivo se guarda en MEDIA_ROOT/productos/ y se sirve en MEDIA_URL. En la
VPS ese directorio lo lee el nginx del HOST —gunicorn no debería gastar un
worker en devolver un WebP— y va en el respaldo junto a la base.
"""

import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image, UnidentifiedImageError

from ..config import ajustes
from ..models import Usuario
from ..schemas import Respuesta, SubidaImagen
from ..security import admin_actual
from ..utils import slugificar

router = APIRouter(prefix="/imagenes", tags=["imágenes"])

SUBCARPETA = "productos"
TIPOS = {"image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"}


def carpeta_destino() -> Path:
    destino = Path(ajustes.MEDIA_ROOT) / SUBCARPETA
    destino.mkdir(parents=True, exist_ok=True)
    return destino


def _ruta_publica(nombre: str) -> str:
    return f"{ajustes.MEDIA_URL.rstrip('/')}/{SUBCARPETA}/{nombre}"


@router.post("", response_model=SubidaImagen, status_code=201)
async def subir(
    archivo: UploadFile = File(...),
    _: Usuario = Depends(admin_actual),
):
    if archivo.content_type not in TIPOS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Sube una imagen PNG, JPG, WebP, GIF o AVIF.",
        )

    datos = await archivo.read()
    if len(datos) > ajustes.IMAGEN_PESO_MAX:
        limite = ajustes.IMAGEN_PESO_MAX // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen pesa más de {limite} MB. Usa una más ligera.",
        )

    import io

    try:
        imagen = Image.open(io.BytesIO(datos))
        imagen.load()
    except (UnidentifiedImageError, OSError):
        # Content-Type dice "imagen" pero el contenido no lo es. Pasa con
        # archivos renombrados, y a veces no es un descuido.
        raise HTTPException(status_code=400, detail="El archivo no es una imagen válida.")

    # RGBA → RGB: WebP admite alfa, pero una foto de producto con canal alfa
    # sobre el degradado de la tarjeta se ve como un recorte sucio.
    if imagen.mode in ("RGBA", "LA", "P"):
        fondo = Image.new("RGB", imagen.size, (255, 255, 255))
        imagen = imagen.convert("RGBA")
        fondo.paste(imagen, mask=imagen.split()[-1])
        imagen = fondo
    elif imagen.mode != "RGB":
        imagen = imagen.convert("RGB")

    lado = ajustes.IMAGEN_LADO_MAX
    if max(imagen.size) > lado:
        imagen.thumbnail((lado, lado), Image.LANCZOS)

    base = slugificar(Path(archivo.filename or "foto").stem, largo=40)
    nombre = f"{base}-{secrets.token_hex(3)}.webp"
    destino = carpeta_destino() / nombre
    imagen.save(destino, "WEBP", quality=ajustes.IMAGEN_CALIDAD, method=6)

    return SubidaImagen(
        img=_ruta_publica(nombre),
        peso=destino.stat().st_size,
        ancho=imagen.width,
        alto=imagen.height,
    )


@router.delete("", response_model=Respuesta)
def borrar(ruta: str, _: Usuario = Depends(admin_actual)):
    """
    Borra una foto subida. `ruta` es la que guarda el producto
    ('/media/productos/xxx.webp').

    El nombre se toma SOLO por su última parte y se comprueba que el resultado
    caiga dentro de la carpeta de imágenes: sin eso, un '../../etc/passwd'
    convierte este endpoint en un borrador de archivos del servidor.
    """
    nombre = Path(ruta).name
    destino = (carpeta_destino() / nombre).resolve()

    if carpeta_destino().resolve() not in destino.parents:
        raise HTTPException(status_code=400, detail="Ruta de imagen no válida.")
    if not destino.is_file():
        return Respuesta(detalle="La imagen ya no estaba.")

    destino.unlink()
    return Respuesta(detalle="Imagen eliminada.")
