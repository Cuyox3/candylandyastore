"""
El correo que avisa de un mensaje del formulario de contacto.

Con `smtplib` y `EmailMessage`, los dos de la biblioteca estándar: no hace
falta instalar nada. Lo que se manda es un aviso al correo de la tienda, con
`Reply-To` apuntando a quien escribió — así, responder desde Gmail le llega al
cliente directamente y no a uno mismo.

Dos reglas que gobiernan todo lo de aquí:

1. **Esto nunca tumba una petición.** El mensaje ya está guardado en la base
   cuando se llama a `avisar`; si el SMTP no contesta, se anota en el log y se
   sigue. Quien escribió no tiene por qué enterarse de que nuestro servidor de
   correo tuvo un mal día, y el mensaje no se pierde: está en el panel.
2. **Sin configurar, no se intenta.** Si falta CORREO_CONTACTO o SMTP_HOST,
   `avisar` no hace nada. Es el comportamiento de antes de este cambio, y el
   que tiene cualquiera que despliegue esto sin querer dar de alta un correo.
"""

import logging
import smtplib
import ssl
from email.message import EmailMessage

from .config import ajustes

log = logging.getLogger("candylandia.correo")

# Tiempo máximo esperando al servidor de correo. Va corto a propósito: esto
# corre en segundo plano, pero un worker de gunicorn atrapado dos minutos en
# un socket mudo es un worker que no atiende a nadie más.
ESPERA = 15


def _limpio(valor: str) -> str:
    """
    Un salto de línea dentro de una cabecera deja colar cabeceras nuevas (el
    truco de siempre: un `\\n` y detrás un `Bcc:`). El nombre y el motivo
    vienen de un formulario público y acaban en el asunto, así que se les
    quitan los saltos antes de que lleguen ahí.
    """
    return " ".join(str(valor).split())


def _enviar(mensaje: EmailMessage) -> bool:
    contexto = ssl.create_default_context()
    try:
        if ajustes.SMTP_TLS:
            with smtplib.SMTP(ajustes.SMTP_HOST, ajustes.SMTP_PUERTO, timeout=ESPERA) as smtp:
                smtp.starttls(context=contexto)
                if ajustes.SMTP_USUARIO:
                    smtp.login(ajustes.SMTP_USUARIO, ajustes.SMTP_PASSWORD)
                smtp.send_message(mensaje)
        else:
            # Puerto 465: TLS desde el primer byte, sin STARTTLS de por medio.
            with smtplib.SMTP_SSL(
                ajustes.SMTP_HOST, ajustes.SMTP_PUERTO, timeout=ESPERA, context=contexto
            ) as smtp:
                if ajustes.SMTP_USUARIO:
                    smtp.login(ajustes.SMTP_USUARIO, ajustes.SMTP_PASSWORD)
                smtp.send_message(mensaje)
        return True
    except smtplib.SMTPAuthenticationError:
        # El fallo más común con Gmail con diferencia: la contraseña normal no
        # vale, hace falta una «contraseña de aplicación».
        log.error(
            "El servidor de correo rechazó el usuario «%s». Con Gmail hace falta "
            "una contraseña de aplicación, no la del correo.",
            ajustes.SMTP_USUARIO,
        )
    except Exception as err:  # noqa: BLE001 - se informa, no se propaga
        log.error("No se pudo mandar el correo: %s", err)
    return False


def avisar(nombre: str, email: str, tel: str, motivo: str, texto: str) -> bool:
    """
    Manda al correo de la tienda el mensaje que alguien dejó en el formulario.

    Devuelve si se envió, pero quien llama puede ignorarlo tranquilamente:
    corre como tarea de fondo y el mensaje ya está guardado.
    """
    if not ajustes.correo_listo:
        log.debug("Correo sin configurar: no se avisa de los mensajes nuevos.")
        return False

    nombre, motivo = _limpio(nombre), _limpio(motivo)

    aviso = EmailMessage()
    aviso["Subject"] = f"🍬 {motivo or 'Mensaje nuevo'} — {nombre}"
    aviso["From"] = ajustes.remitente
    aviso["To"] = ajustes.CORREO_CONTACTO
    # Para responderle a quien escribió sin tener que copiar la dirección a
    # mano desde el cuerpo del correo.
    aviso["Reply-To"] = _limpio(email)

    aviso.set_content(
        f"Alguien escribió desde {ajustes.SITE_NAME}.\n\n"
        f"Nombre:   {nombre}\n"
        f"Correo:   {email}\n"
        f"Teléfono: {tel or '—'}\n"
        f"Motivo:   {motivo or '—'}\n\n"
        f"Mensaje:\n{texto}\n\n"
        f"—\nResponde a este correo y le llegará directo a {email}.\n"
        f"El mensaje también queda guardado en el panel: {ajustes.SITE_URL}/admin\n"
    )

    if _enviar(aviso):
        log.info("Aviso de contacto enviado a %s", ajustes.CORREO_CONTACTO)
        return True
    return False
