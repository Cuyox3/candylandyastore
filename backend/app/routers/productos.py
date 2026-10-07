"""
El catálogo: /api/v1/productos y /api/v1/categorias

Lectura pública (es lo que pinta la tienda) y escritura sólo con token del
panel. La separación es explícita ruta por ruta —`Depends(admin_actual)`—
porque un router entero protegido "por defecto" es justo donde se cuela una
ruta de escritura sin candado.
"""

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from .. import catalogo as catalogo_archivos
from .. import fotos as fotos_lib
from ..config import ajustes
from ..database import obtener_db
from ..models import Categoria, Etiqueta, Foto, Producto, Usuario
from ..schemas import (
    COLORES,
    CatalogoImportar,
    CategoriaBase,
    CategoriaEditar,
    CategoriaSalida,
    EtiquetaBase,
    EtiquetaEditar,
    EtiquetaSalida,
    ProductoCrear,
    ProductoEditar,
    ProductoImportar,
    ProductoSalida,
    Respuesta,
)
from ..security import admin_actual
from ..utils import ahora, slug_en_lote, slug_libre

router = APIRouter(tags=["catálogo"])


def _salida(p: Producto) -> ProductoSalida:
    """El producto tal y como lo espera la tarjeta del front (`id` = slug)."""
    return ProductoSalida.model_validate(p)


def _etiqueta_salida(e: Etiqueta) -> EtiquetaSalida:
    """La fila más el `label` que lee el desplegable: «Nuevo (Cian)»."""
    return EtiquetaSalida(
        id=e.id,
        etiqueta=e.etiqueta,
        tipo=e.tipo,
        orden=e.orden,
        activa=e.activa,
        label=f"{e.etiqueta} ({COLORES.get(e.tipo, 'Rosa')})",
    )


def _existe_categoria(db: Session, slug: str) -> bool:
    return (
        db.query(Categoria)
        .filter(Categoria.slug == slug, Categoria.activa.is_(True))
        .first()
        is not None
    )


# ── Categorías y etiquetas ─────────────────────────────────────────────────

@router.get("/categorias", response_model=list[CategoriaSalida])
def listar_categorias(
    incluir_inactivas: bool = False,
    db: Session = Depends(obtener_db),
):
    """
    Las categorías. Por defecto sólo las visibles, que es lo que pinta la
    tienda; el panel pide también las apagadas, porque si no, esconder una la
    haría desaparecer del panel y no habría manera de volver a encenderla.
    """
    consulta = db.query(Categoria)
    if not incluir_inactivas:
        consulta = consulta.filter(Categoria.activa.is_(True))
    return consulta.order_by(Categoria.orden, Categoria.id).all()


@router.get("/etiquetas", response_model=list[EtiquetaSalida])
def listar_etiquetas(
    incluir_inactivas: bool = False,
    db: Session = Depends(obtener_db),
):
    """
    Las opciones de la esquina de la tarjeta.

    La primera SIEMPRE es «Sin etiqueta», y no sale de la tabla: es la opción
    de no poner ninguna. Va aquí y no en la base para que nadie pueda borrarla
    y dejar al panel sin manera de quitarle la pastilla a un producto.
    """
    consulta = db.query(Etiqueta)
    if not incluir_inactivas:
        consulta = consulta.filter(Etiqueta.activa.is_(True))
    filas = consulta.order_by(Etiqueta.orden, Etiqueta.id).all()

    ninguna = EtiquetaSalida(id=0, etiqueta="", tipo="", orden=-1, label="Sin etiqueta")
    return [ninguna] + [_etiqueta_salida(e) for e in filas]


@router.get("/colores-etiqueta")
def listar_colores():
    """Los colores que el CSS sabe pintar, para el desplegable del panel."""
    return [{"tipo": tipo, "nombre": nombre} for tipo, nombre in COLORES.items()]


@router.post("/etiquetas", response_model=EtiquetaSalida, status_code=201)
def crear_etiqueta(
    datos: EtiquetaBase,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    if db.query(Etiqueta).filter(Etiqueta.etiqueta == datos.etiqueta).first():
        raise HTTPException(status_code=409, detail="Ya existe una etiqueta con ese texto.")
    eti = Etiqueta(**datos.model_dump())
    db.add(eti)
    db.commit()
    db.refresh(eti)
    return _etiqueta_salida(eti)


@router.patch("/etiquetas/{etiqueta_id}", response_model=EtiquetaSalida)
def editar_etiqueta(
    etiqueta_id: int,
    cambios: EtiquetaEditar,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    eti = db.query(Etiqueta).filter(Etiqueta.id == etiqueta_id).first()
    if eti is None:
        raise HTTPException(status_code=404, detail="Esa etiqueta no existe.")

    campos = cambios.model_dump(exclude_unset=True)

    nuevo_texto = campos.get("etiqueta")
    if nuevo_texto and nuevo_texto != eti.etiqueta:
        if db.query(Etiqueta).filter(Etiqueta.etiqueta == nuevo_texto).first():
            raise HTTPException(status_code=409, detail="Ya existe una etiqueta con ese texto.")

    # Los productos llevan el texto y el color COPIADOS encima (así la tienda
    # pinta la tarjeta sin consultar esta tabla). Si cambian aquí, hay que
    # arrastrarlos: si no, el producto se queda con la etiqueta vieja y el
    # panel enseña una cosa y la tienda otra.
    antes_texto, antes_tipo = eti.etiqueta, eti.tipo
    for campo, valor in campos.items():
        setattr(eti, campo, valor)

    if eti.etiqueta != antes_texto or eti.tipo != antes_tipo:
        (
            db.query(Producto)
            .filter(Producto.etiqueta == antes_texto, Producto.tipo == antes_tipo)
            .update({"etiqueta": eti.etiqueta, "tipo": eti.tipo}, synchronize_session=False)
        )

    db.commit()
    db.refresh(eti)
    return _etiqueta_salida(eti)


@router.delete("/etiquetas/{etiqueta_id}", response_model=Respuesta)
def quitar_etiqueta(
    etiqueta_id: int,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    eti = db.query(Etiqueta).filter(Etiqueta.id == etiqueta_id).first()
    if eti is None:
        raise HTTPException(status_code=404, detail="Esa etiqueta no existe.")

    # A diferencia de las categorías, aquí SÍ se puede borrar con productos
    # dentro: quedarse sin etiqueta no esconde el producto de ningún filtro,
    # sólo le quita la pastilla. Se les limpia de paso para que no arrastren
    # el texto de una etiqueta que ya no existe.
    afectados = (
        db.query(Producto)
        .filter(Producto.etiqueta == eti.etiqueta, Producto.tipo == eti.tipo)
        .update({"etiqueta": "", "tipo": ""}, synchronize_session=False)
    )
    db.delete(eti)
    db.commit()

    if afectados:
        return Respuesta(detalle=f"Etiqueta eliminada. Se la quité a {afectados} producto(s).")
    return Respuesta(detalle="Etiqueta eliminada.")


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


@router.patch("/categorias/{slug}", response_model=CategoriaSalida)
def editar_categoria(
    slug: str,
    cambios: CategoriaEditar,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    cat = db.query(Categoria).filter(Categoria.slug == slug).first()
    if cat is None:
        raise HTTPException(status_code=404, detail="Esa categoría no existe.")

    # Apagar una categoría la saca de los filtros de la tienda y con ella se
    # van de la vista sus productos. No se bloquea aquí: avisar de eso es cosa
    # del panel, que pregunta antes con el número de productos delante. Una
    # API sin estado no puede distinguir «insiste» de «primer intento», y
    # devolver 409 dejaría la categoría imposible de apagar.
    campos = cambios.model_dump(exclude_unset=True)
    for campo, valor in campos.items():
        setattr(cat, campo, valor)
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

    campos = datos.model_dump()
    # La foto llega entera («data:image/webp;base64,…») y no cabe en la
    # columna: `aplicar` la guarda en `fotos` y deja en `img` su dirección.
    img = campos.pop("img", "")

    producto = Producto(
        slug=slug_libre(db, Producto, datos.nombre),
        orden=orden,
        **campos,
    )
    fotos_lib.aplicar(producto, img)
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

    # Fuera del bucle: `img` no se copia al producto, se interpreta. Puede ser
    # una foto nueva, la misma de antes o el vacío de quien le dio a «Quitar
    # foto», y cada caso toca la tabla `fotos` de una manera.
    foto = cambios.pop("img", None)

    for campo, valor in cambios.items():
        setattr(producto, campo, valor)

    fotos_lib.aplicar(producto, foto)

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
    fotos: bool = Query(True, description="incrustar las fotos en base64"),
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    """
    El catálogo entero en JSON. Es el respaldo que uno se lleva antes de
    tocar nada, y lo que come `/catalogo/importar`.

    Las fotos van dentro, en base64. Abultan —es el archivo entero y no una
    dirección—, pero un respaldo que al restaurarse deja todas las tarjetas
    con el emoji no es un respaldo, y con `?fotos=0` el JSON sólo vale para
    reimportarlo en ESTE servidor, donde las fotos siguen en la base y se
    reconocen por el id del producto.
    """
    consulta = db.query(Producto)
    if fotos:
        # Sin esto, una consulta por producto para traerse su foto.
        consulta = consulta.options(joinedload(Producto.foto))

    salida = []
    for p in consulta.order_by(Producto.orden, Producto.id).all():
        fila = _salida(p).model_dump(exclude={"creado"})
        if fotos and p.foto is not None:
            fila["img"] = fotos_lib.data_url(p.foto)
        salida.append(fila)
    return salida


def _filas_planas(db: Session) -> list[dict]:
    """El catálogo sin fotos, que es lo que entra en una hoja o en un PDF."""
    return [
        _salida(p).model_dump(exclude={"creado"})
        for p in db.query(Producto).order_by(Producto.orden, Producto.id).all()
    ]


def _descarga(contenido: bytes, nombre: str, tipo: str) -> Response:
    # `attachment` para que el navegador lo baje en vez de intentar enseñarlo,
    # y no-store porque el catálogo cambia y un PDF cacheado del de ayer es
    # justo lo que no quiere nadie que acaba de corregir un precio.
    return Response(
        content=contenido,
        media_type=tipo,
        headers={
            "Content-Disposition": f'attachment; filename="{nombre}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/catalogo/exportar.xlsx")
def exportar_excel(
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    """
    El catálogo en hoja de cálculo, para cambiar precios en masa y volver a
    subirlo. Las fotos no van dentro (ver catalogo.py), pero sobreviven: al
    reimportar se reconocen por el identificador del producto.
    """
    hoy = ahora().strftime("%Y-%m-%d")
    return _descarga(
        catalogo_archivos.a_excel(_filas_planas(db)),
        f"catalogo-candylandia-{hoy}.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.get("/catalogo/exportar.pdf")
def exportar_pdf(
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    """El catálogo impreso: para mirarlo, mandarlo o llevárselo al mostrador."""
    hoy = ahora().strftime("%Y-%m-%d")
    return _descarga(
        catalogo_archivos.a_pdf(_filas_planas(db), f"Catálogo Candylandia · {hoy}"),
        f"catalogo-candylandia-{hoy}.pdf",
        "application/pdf",
    )


@router.post("/catalogo/importar-excel", response_model=Respuesta)
async def importar_excel(
    archivo: UploadFile = File(...),
    db: Session = Depends(obtener_db),
    usuario: Usuario = Depends(admin_actual),
):
    """
    Reemplaza el catálogo con lo que venga en un .xlsx.

    Pasa por el MISMO importador que el JSON: se lee la hoja, se convierte a
    la lista de siempre y se entrega. Así las dos puertas se comportan igual
    —mismas validaciones, mismo rescate de fotos por identificador— en vez de
    tener cada una su copia de las reglas, que es como acaban divergiendo.
    """
    crudo = await archivo.read()
    if not crudo:
        raise HTTPException(status_code=400, detail="El archivo llegó vacío.")
    if len(crudo) > ajustes.IMAGEN_PESO_MAX:
        raise HTTPException(status_code=413, detail="Ese archivo es demasiado grande.")

    filas = catalogo_archivos.de_excel(crudo)
    entradas = [ProductoImportar.model_validate(f) for f in filas]
    # Posicional: el tercer parámetro de importar_catalogo se llama `_` (es
    # sólo el candado de administrador) y por nombre no se puede pasar.
    return importar_catalogo(entradas, db, usuario)


@router.post("/catalogo/importar", response_model=Respuesta)
def importar_catalogo(
    datos: CatalogoImportar | list[ProductoImportar],
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    """
    Reemplaza el catálogo entero.

    Acepta las dos formas: la lista pelada que devuelve `/catalogo/exportar`
    —para poder restaurar un respaldo con curl— y el `{"productos": [...]}`
    que manda el panel.

    El `id` de cada producto se respeta si viene en el JSON y está libre, para
    que exportar e importar no le cambie la identidad a los dulces; si falta o
    choca, se genera desde el nombre. Las fotos se conservan por ese mismo id.

    ⚠️ Borra todos los productos actuales. La confirmación se pide en el panel;
    aquí se valida ANTES de borrar nada: si el JSON trae una categoría que no
    existe, la respuesta es un 400 y la base se queda como estaba.
    """
    entradas = datos if isinstance(datos, list) else datos.productos

    if not entradas:
        raise HTTPException(status_code=400, detail="El catálogo llegó vacío.")

    faltan = {p.cat for p in entradas if not _existe_categoria(db, p.cat)}
    if faltan:
        raise HTTPException(
            status_code=400,
            detail="Categorías que no existen: " + ", ".join(sorted(faltan)),
        )

    # Las fotos se van con sus productos en el DELETE de abajo (ON DELETE
    # CASCADE). Pero el JSON que se importa casi siempre es el que salió de
    # `/catalogo/exportar`, donde `img` es una dirección y no la foto: sin
    # apartarlas antes, reimportar el catálogo propio dejaría todas las
    # tarjetas con el emoji. Se copian en memoria y se devuelven al producto
    # que tenga el mismo slug.
    #
    # Se guardan los valores, no las filas: en cuanto corra el DELETE, un
    # objeto Foto del ORM que intentara recargarse no encontraría su fila.
    guardadas = {
        fila.slug: {
            "mime": fila.mime,
            "datos": fila.datos,
            "peso": fila.peso,
            "ancho": fila.ancho,
            "alto": fila.alto,
            "huella": fila.huella,
        }
        for fila in db.query(
            Producto.slug,
            Foto.mime,
            Foto.datos,
            Foto.peso,
            Foto.ancho,
            Foto.alto,
            Foto.huella,
        ).join(Foto, Foto.producto_id == Producto.id)
    }

    db.query(Producto).delete()
    db.flush()  # que el DELETE corra antes que los INSERT, por el índice único

    usados: set[str] = set()
    for i, entrada in enumerate(entradas):
        slug = slug_en_lote(entrada.id, entrada.nombre, usados)
        usados.add(slug)

        producto = Producto(
            slug=slug,
            orden=i,
            **entrada.model_dump(exclude={"id", "img"}),
        )

        if not entrada.img.startswith("data:") and slug in guardadas:
            producto.foto = Foto(**guardadas[slug])
            producto.img = fotos_lib.ruta(slug, producto.foto)
        else:
            # Un `data:` en el JSON (hecho a mano, o venido de otro servidor)
            # entra como foto nueva; cualquier otra cosa se guarda tal cual.
            fotos_lib.aplicar(producto, entrada.img)

        db.add(producto)

    db.commit()
    return Respuesta(detalle=f"Catálogo reemplazado: {len(entradas)} producto(s).")


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
