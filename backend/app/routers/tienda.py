"""
Lo que manda la tienda: /api/v1/suscriptores y /api/v1/mensajes

Estos dos formularios ya funcionaban sin servidor (el newsletter guardaba el
correo en el localStorage de quien se suscribía; el contacto abría WhatsApp y
no dejaba rastro). Ahora quedan registrados, sin cambiar lo que ve el cliente:
el contacto sigue abriendo WhatsApp igual.

Además, un mensaje de contacto manda un aviso al correo de la tienda (ver
correo.py). Es un extra, no un requisito: si el SMTP no está configurado o
falla, el mensaje se guarda igual y se lee desde el panel.
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import correo
from ..database import obtener_db
from ..models import Mensaje, Suscriptor, Usuario
from ..schemas import (
    MensajeCrear,
    MensajeSalida,
    Respuesta,
    SuscriptorCrear,
)
from ..security import admin_actual

router = APIRouter(tags=["tienda"])


@router.post("/suscriptores", response_model=Respuesta, status_code=201)
def suscribir(datos: SuscriptorCrear, db: Session = Depends(obtener_db)):
    email = datos.email.lower().strip()

    # Suscribirse dos veces no es un error para quien lo hace: la respuesta es
    # la misma de siempre y no se crea nada.
    if db.query(Suscriptor).filter(Suscriptor.email == email).first() is None:
        db.add(Suscriptor(email=email))
        db.commit()

    return Respuesta(detalle="¡Gracias! Ya eres parte del club dulce 🍬")


@router.get("/suscriptores", response_model=list[str])
def listar_suscriptores(
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    filas = db.query(Suscriptor).order_by(Suscriptor.creado.desc()).all()
    return [s.email for s in filas]


@router.post("/mensajes", response_model=Respuesta, status_code=201)
def crear_mensaje(
    datos: MensajeCrear,
    tareas: BackgroundTasks,
    db: Session = Depends(obtener_db),
):
    mensaje = Mensaje(**datos.model_dump())
    mensaje.email = str(mensaje.email).lower().strip()
    db.add(mensaje)
    db.commit()

    # El aviso por correo va DESPUÉS del commit y en segundo plano: lo que no
    # puede fallar es el guardado, y un servidor de correo lento no tiene por
    # qué dejar al cliente mirando el botón «Enviando…». Si no sale, queda en
    # el log y el mensaje se lee igual desde el panel.
    #
    # Los campos se leen AQUÍ y se pasan ya como texto, no dentro de la tarea:
    # el commit deja la fila expirada y la sesión se cierra al devolver la
    # respuesta, así que leer `mensaje.nombre` más tarde intentaría recargarla
    # con una sesión que ya no existe.
    tareas.add_task(
        correo.avisar,
        nombre=mensaje.nombre,
        email=mensaje.email,
        tel=mensaje.tel,
        motivo=mensaje.motivo,
        texto=mensaje.mensaje,
    )
    return Respuesta(detalle="Mensaje recibido.")


@router.get("/mensajes", response_model=list[MensajeSalida])
def listar_mensajes(
    solo_nuevos: bool = False,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    consulta = db.query(Mensaje)
    if solo_nuevos:
        consulta = consulta.filter(Mensaje.leido.is_(False))
    return consulta.order_by(Mensaje.creado.desc()).limit(200).all()


@router.post("/mensajes/{mensaje_id}/leido", response_model=Respuesta)
def marcar_leido(
    mensaje_id: int,
    db: Session = Depends(obtener_db),
    _: Usuario = Depends(admin_actual),
):
    mensaje = db.query(Mensaje).filter(Mensaje.id == mensaje_id).first()
    if mensaje is None:
        raise HTTPException(status_code=404, detail="Ese mensaje no existe.")
    mensaje.leido = True
    db.commit()
    return Respuesta(detalle="Marcado como leído.")
