"""
Lo que manda la tienda: /api/v1/suscriptores y /api/v1/mensajes

Estos dos formularios ya funcionaban sin servidor (el newsletter guardaba el
correo en el localStorage de quien se suscribía; el contacto abría WhatsApp y
no dejaba rastro). Ahora quedan registrados, sin cambiar lo que ve el cliente:
el contacto sigue abriendo WhatsApp igual.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
def crear_mensaje(datos: MensajeCrear, db: Session = Depends(obtener_db)):
    mensaje = Mensaje(**datos.model_dump())
    mensaje.email = str(mensaje.email).lower().strip()
    db.add(mensaje)
    db.commit()
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
