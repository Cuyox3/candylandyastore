"""
El catálogo: /api/v1/productos y /api/v1/categorias

Lectura pública (es lo que pinta la tienda) y escritura sólo con token del
panel. La separación es explícita ruta por ruta —`Depends(admin_actual)`—
porque un router entero protegido "por defecto" es justo donde se cuela una
ruta de escritura sin candado.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import obtener_db
from ..models import Categoria, Producto, Usuario
from ..schemas import (
    CatalogoImportar,
    CategoriaBase,
    CategoriaSalida,
    ProductoCrear,
    ProductoEditar,
    ProductoSalida,
    Respuesta,
)
from ..security import admin_actual
from ..seed import ETIQUETAS
from ..utils import slug_libre

router = APIRouter(tags=["catálogo"])


def _salida(p: Producto) -> ProductoSalida:
    """El producto tal y como lo espera la tarjeta del front (`id` = slug)."""
    return ProductoSalida.model_validate(p)


def _existe_categoria(db: Session, slug: str) -> bool:
    return (
        db.query(Categoria)
        .filter(Categoria.slug == slug, Categoria.activa.is_(True))
        .first()
        is not None
    )


# ── Categorías y etiquetas ─────────────────────────────────────────────────

@router.get("/categorias", response_model=list[CategoriaSalida])
def listar_categorias(db: Session = Depends(obtener_db)):
    return (
        db.query(Categoria)
        .filter(Categoria.activa.is_(True))
        .order_by(Categoria.orden, Categoria.id)
        .all()
    )


@router.get("/etiquetas")
def listar_etiquetas():
    """Las tres opciones de la esquina de la tarjeta (ninguna, Nuevo, Top)."""
    return ETIQUETAS


@router.post("/categorias", response_model=CategoriaSalida, status_code=201)
def crear_categoria(
    datos: CategoriaBase,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    if db.query(Categoria).filter(Categoria.slug == datos.slug).first():
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese identificador.")
    cat = Categoria(**datos.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/categorias/{slug}", response_model=Respuesta)
def quitar_categoria(
    slug: str,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    cat = db.query(Categoria).filter(Categoria.slug == slug).first()
    if cat is None:
        raise HTTPException(status_code=404, detail="Esa categoría no existe.")

    # Con productos dentro no se borra: dejarlos apuntando a una categoría
    # fantasma los saca de todos los filtros y parecen desaparecidos.
    cuantos = db.query(Producto).filter(Producto.cat == slug).count()
    if cuantos:
        raise HTTPException(
            status_code=409,
            detail=f"La categoría tiene {cuantos} producto(s). Muévelos o quítalos antes.",
        )

    db.delete(cat)
    db.commit()
    return Respuesta(detalle="Categoría eliminada.")


# ── Productos ──────────────────────────────────────────────────────────────

@router.get("/productos", response_model=list[ProductoSalida])
def listar_productos(
    cat: str = Query("todos", description="slug de categoría, o 'todos'"),
    buscar: str = Query("", max_length=80),
    incluir_inactivos: bool = False,
    db: Session = Depends(obtener_db),
):
    consulta = db.query(Producto)

    if not incluir_inactivos:
        consulta = consulta.filter(Producto.activo.is_(True))
    if cat and cat != "todos":
        consulta = consulta.filter(Producto.cat == cat)
    if buscar:
        patron = f"%{buscar.strip().lower()}%"
        consulta = consulta.filter(
            Producto.nombre.ilike(patron)
            | Producto.origen.ilike(patron)
            | Producto.cat.ilike(patron)
        )

    filas = consulta.order_by(Producto.orden, Producto.id).all()
    return [_salida(p) for p in filas]


@router.get("/productos/{slug}", response_model=ProductoSalida)
def obtener_producto(slug: str, db: Session = Depends(obtener_db)):
    p = db.query(Producto).filter(Producto.slug == slug).first()
    if p is None:
        raise HTTPException(status_code=404, detail="Ese producto no existe.")
    return _salida(p)


@router.post("/productos", response_model=ProductoSalida, status_code=201)
def crear_producto(
    datos: ProductoCrear,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    if not _existe_categoria(db, datos.cat):
        raise HTTPException(status_code=400, detail=f"La categoría «{datos.cat}» no existe.")

    # Arriba del todo, como hacía `lista.unshift()` en el panel estático.
    minimo = db.query(Producto.orden).order_by(Producto.orden).limit(1).scalar()
    orden = (minimo - 1) if minimo is not None else 0

    producto = Producto(
        slug=slug_libre(db, Producto, datos.nombre),
        orden=orden,
        **datos.model_dump(),
    )
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return _salida(producto)


@router.patch("/productos/{slug}", response_model=ProductoSalida)
def editar_producto(
    slug: str,
    datos: ProductoEditar,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    producto = db.query(Producto).filter(Producto.slug == slug).first()
    if producto is None:
        raise HTTPException(status_code=404, detail="Ese producto no existe.")

    cambios = datos.model_dump(exclude_unset=True)
    if "cat" in cambios and not _existe_categoria(db, cambios["cat"]):
        raise HTTPException(status_code=400, detail=f"La categoría «{cambios['cat']}» no existe.")

    for campo, valor in cambios.items():
        setattr(producto, campo, valor)

    # El slug NO cambia aunque cambie el nombre: es el id que la tienda ya
    # tiene en la mano, y renombrarlo rompería cualquier enlace guardado.
    db.commit()
    db.refresh(producto)
    return _salida(producto)


@router.delete("/productos/{slug}", response_model=Respuesta)
def quitar_producto(
    slug: str,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    producto = db.query(Producto).filter(Producto.slug == slug).first()
    if producto is None:
        raise HTTPException(status_code=404, detail="Ese producto no existe.")
    db.delete(producto)
    db.commit()
    return Respuesta(detalle=f"«{producto.nombre}» salió del catálogo.")


# ── Catálogo completo ──────────────────────────────────────────────────────

@router.get("/catalogo/exportar")
def exportar_catalogo(
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    """
    El catálogo entero en JSON. Es el respaldo que uno se lleva antes de
    tocar nada, y lo que come `/catalogo/importar`.
    """
    filas = db.query(Producto).order_by(Producto.orden, Producto.id).all()
    return [_salida(p).model_dump(exclude={"creado"}) for p in filas]


@router.post("/catalogo/importar", response_model=Respuesta)
def importar_catalogo(
    datos: CatalogoImportar,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    """
    Reemplaza el catálogo entero.

    ⚠️ Borra todos los productos actuales. La confirmación se pide en el panel;
    aquí se valida ANTES de borrar nada: si el JSON trae una categoría que no
    existe, la respuesta es un 400 y la base se queda como estaba.
    """
    if not datos.productos:
        raise HTTPException(status_code=400, detail="El catálogo llegó vacío.")

    faltan = {p.cat for p in datos.productos if not _existe_categoria(db, p.cat)}
    if faltan:
        raise HTTPException(
            status_code=400,
            detail="Categorías que no existen: " + ", ".join(sorted(faltan)),
        )

    db.query(Producto).delete()
    db.flush()  # que el DELETE corra antes que los INSERT, por el índice único

    for i, entrada in enumerate(datos.productos):
        db.add(
            Producto(
                slug=slug_libre(db, Producto, entrada.nombre),
                orden=i,
                **entrada.model_dump(),
            )
        )

    db.commit()
    return Respuesta(detalle=f"Catálogo reemplazado: {len(datos.productos)} producto(s).")


@router.post("/catalogo/restaurar", response_model=Respuesta)
def restaurar_catalogo(
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    """Vuelve al catálogo de fábrica (app/seed.py). Borra lo que haya."""
    from ..seed import sembrar

    db.query(Producto).delete()
    db.commit()
    _, nuevos = sembrar(db, forzar=True)
    return Respuesta(detalle=f"Catálogo de fábrica restaurado: {nuevos} producto(s).")
