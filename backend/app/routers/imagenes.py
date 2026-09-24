"""
Fotos de producto: /api/v1/imagenes (subir) y /api/v1/fotos/{slug} (ver)

El panel estático tenía que pedirle al navegador que escribiera el archivo en
la carpeta del proyecto (File System Access API) y, cuando el navegador no
sabía, descargarlo para que lo movieras a mano. Con backend eso desaparece.

La subida NO guarda nada: comprime la imagen y devuelve el `data:` en base64
para que el panel enseñe la vista previa. La foto entra en la base cuando se
guarda el producto, colgada de él (`app/fotos.py`). Así una foto subida en un
formulario que luego nadie envía no deja rastro, y borrar un producto se lleva
su foto sin que nadie tenga que acordarse.

Verla es público —es lo que pinta la tienda— y se cachea para siempre: la URL
lleva la huella del archivo, así que una foto distinta es una URL distinta.
"""

from fastapi import APIRouter, Depends, File, Request, Response, UploadFile
from fastapi import HTTPException
from sqlalchemy.orm import Session

from .. import fotos as fotos_lib
from ..database import obtener_db
from ..models import Foto, Producto, Usuario
from ..schemas import SubidaImagen
from ..security import admin_actual

router = APIRouter(prefix="/imagenes", tags=["imágenes"])
publicas = APIRouter(prefix="/fotos", tags=["imágenes"])

# Un año. La dirección lleva ?v=<huella>, o sea que este caché no puede
# quedarse con una foto vieja: si la foto cambia, cambia la dirección.
CACHE = "public, max-age=31536000, immutable"


@router.post("", response_model=SubidaImagen, status_code=201)
async def subir(
    archivo: UploadFile = File(...),
    _: Usuario = Depends(admin_actual),
):
    if archivo.content_type not in fotos_lib.TIPOS:
        raise HTTPException(
            status_code=415,
            detail="Sube una imagen PNG, JPG, WebP, GIF o AVIF.",
        )

    foto = fotos_lib.procesar(await archivo.read())

    return SubidaImagen(
        img=fotos_lib.data_url(foto),
        peso=foto.peso,
        ancho=foto.ancho,
        alto=foto.alto,
    )


@publicas.get("/{slug}")
def ver(slug: str, request: Request, db: Session = Depends(obtener_db)):
    """La foto de un producto, decodificada. `slug` es el id del producto."""
    foto = (
        db.query(Foto)
        .join(Producto, Foto.producto_id == Producto.id)
        .filter(Producto.slug == slug)
        .first()
    )
    if foto is None:
        raise HTTPException(status_code=404, detail="Ese producto no tiene foto.")

    etiqueta = f'"{foto.huella}"'
    cabeceras = {"ETag": etiqueta, "Cache-Control": CACHE}

    # Por si alguien llega sin el ?v= (una URL guardada a mano, por ejemplo):
    # el ETag le ahorra volver a bajarse la foto entera.
    if request.headers.get("if-none-match") == etiqueta:
        return Response(status_code=304, headers=cabeceras)

    return Response(
        content=fotos_lib.contenido(foto),
        media_type=foto.mime,
        headers=cabeceras,
    )
