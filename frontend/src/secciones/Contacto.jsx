import { useState } from 'react';
import { api } from '../api';
import { CONFIG, REDES, mapaUrl, telefonoBonito, waLink } from '../config';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const VACIO = { nombre:'', email:'', tel:'', motivo:'', mensaje:'' };

const MOTIVOS = [
  'Quiero hacer un pedido',
  'Precios de mayoreo',
  'Pedido especial de importación',
  'Estado de mi envío',
  'Otro'
];

/* =========================================================
   Formulario de contacto.

   Sigue abriendo WhatsApp con el mensaje montado, igual que siempre: es lo
   que la gente espera al pulsar el botón. La novedad es que ANTES se guarda
   en la base, así que un mensaje que nadie llegó a mandar —porque se cerró
   la pestaña de WhatsApp, o porque no tenía la app— ya no se pierde.

   Si el guardado falla, WhatsApp se abre igual: entre perder el registro y
   perder al cliente, se pierde el registro.
   ========================================================= */
export default function Contacto() {
  const [datos, setDatos]   = useState(VACIO);
  const [malos, setMalos]   = useState({});
  const [msg, setMsg]       = useState({ texto:'', error:false });
  /* Qué botón está trabajando: '' | 'whatsapp' | 'correo'. Guardar cuál (y no
     un simple true) deja poner «Enviando…» sólo en el que se pulsó. */
  const [enviando, setEnviando] = useState('');

  function cambiar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    if (malos[campo]) setMalos((m) => ({ ...m, [campo]: false }));
  }

  /* Los dos botones mandan lo MISMO al servidor —que es quien guarda y quien
     manda el correo—; lo único que cambia es qué pasa después. */
  async function procesar(canal) {
    const fallos = {
      nombre:  !datos.nombre.trim(),
      email:   !CORREO.test(datos.email.trim()),
      motivo:  !datos.motivo.trim(),
      mensaje: !datos.mensaje.trim()
    };
    setMalos(fallos);

    if (Object.values(fallos).some(Boolean)) {
      setMsg({ texto:'Revisa los campos marcados, por favor.', error:true });
      return;
    }

    setEnviando(canal);
    let guardado = true;
    try {
      await api.contacto({
        nombre:  datos.nombre.trim(),
        email:   datos.email.trim(),
        tel:     datos.tel.trim(),
        motivo:  datos.motivo,
        mensaje: datos.mensaje.trim()
      });
    } catch (err) {
      guardado = false;
      console.warn('No se pudo guardar el mensaje:', err.message);
    } finally {
      setEnviando('');
    }

    /* Por correo no hay segunda red: si la llamada falló, no se ha mandado
       nada y hay que decirlo. Es justo lo contrario del botón de WhatsApp, que
       se abre pase lo que pase porque el mensaje viaja igualmente. */
    if (canal === 'correo') {
      if (!guardado) {
        setMsg({
          texto:'No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos por WhatsApp.',
          error:true
        });
        return;
      }
      setMsg({ texto:'¡Enviado! Te respondemos a tu correo lo antes posible. 📧', error:false });
      setDatos(VACIO);
      return;
    }

    const texto =
`¡Hola ${CONFIG.negocio}! 🍭
Nombre: ${datos.nombre.trim()}
Correo: ${datos.email.trim()}${datos.tel.trim() ? '\nTeléfono: ' + datos.tel.trim() : ''}
Motivo: ${datos.motivo}
Mensaje: ${datos.mensaje.trim()}`;

    /* Si el guardado falló, WhatsApp se abre igual: entre perder el registro y
       perder al cliente, se pierde el registro. */
    window.open(waLink(texto), '_blank', 'noopener');

    setMsg({ texto:'¡Listo! Abrimos WhatsApp con tu mensaje. 💬', error:false });
    setDatos(VACIO);
  }

  /* El submit del formulario (y por tanto la tecla Enter) sigue siendo
     WhatsApp, que es lo que este botón ha hecho siempre. */
  function enviar(e) {
    e.preventDefault();
    procesar('whatsapp');
  }

  return (
    <section className="section" id="contacto" aria-labelledby="contacto-titulo">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Contáctanos</span>
          <h2 id="contacto-titulo">Hablemos de <span className="grad-text">dulces</span></h2>
          <p>Escríbenos y te respondemos el mismo día. También puedes visitarnos en la tienda.</p>
        </div>

        <div className="contact-grid">
          <div className="contact-info reveal">
            <a className="info-card" href={`https://wa.me/${CONFIG.whatsapp}`} target="_blank" rel="noopener">
              <span className="info-ico" style={{ '--c1':'#25D366', '--c2':'#8FF0B4' }}>💬</span>
              <div><strong>WhatsApp</strong><span>{telefonoBonito()}</span></div>
            </a>
            <a className="info-card" href={`mailto:${CONFIG.correo}`}>
              <span className="info-ico" style={{ '--c1':'#F42A8F', '--c2':'#FF8AC4' }}>✉️</span>
              <div><strong>Correo</strong><span>{CONFIG.correo}</span></div>
            </a>
            {/* Al tocarla se abre la app de mapas del aparato con la tienda ya
                buscada (Mapas en iPhone, Google Maps en lo demás). */}
            <a className="info-card" href={mapaUrl()} target="_blank" rel="noopener noreferrer">
              <span className="info-ico" style={{ '--c1':'#29B6E8', '--c2':'#7FDBFF' }}>📍</span>
              <div>
                <strong>Tienda física</strong>
                <span>{CONFIG.direccion}</span>
                <span className="info-pista">Cómo llegar →</span>
              </div>
            </a>
            <div className="info-card">
              <span className="info-ico" style={{ '--c1':'#A05CD6', '--c2':'#D9A8F5' }}>🕒</span>
              <div><strong>Horario</strong><span>Lun a Sáb 10:00 – 20:00 · Dom 11:00 – 17:00</span></div>
            </div>

            {/* Síguenos.

                Sale de REDES (config.js) y no de una lista escrita aquí, para
                que el pie y el contacto no se puedan desincronizar cuando se
                añada o se cambie una cuenta. */}
            <div className="redes-bloque">
              <h3 className="redes-titulo">Síguenos en nuestras redes</h3>
              <p className="redes-texto">
                Ahí sacamos lo que acaba de llegar, las ediciones limitadas y los antojos del mes.
              </p>
              <div className="socials">
                {REDES.map((red) => (
                  <a
                    key={red.nombre}
                    href={red.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${red.nombre} de ${CONFIG.negocio}`}
                    style={{ '--c1': red.c1, '--c2': red.c2 }}
                  >
                    <span aria-hidden="true">{red.emoji}</span> {red.nombre}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <form className="contact-form reveal" id="contactForm" noValidate onSubmit={enviar}>
            <div className="field">
              <label htmlFor="nombre">Nombre completo *</label>
              <input type="text" id="nombre" name="nombre" placeholder="¿Cómo te llamas?" required
                     className={malos.nombre ? 'invalid' : ''}
                     value={datos.nombre} onChange={(e) => cambiar('nombre', e.target.value)} />
            </div>
            <div className="field-row">
              <div className="field">
                <label htmlFor="email">Correo *</label>
                <input type="email" id="email" name="email" placeholder="tucorreo@ejemplo.com" required
                       className={malos.email ? 'invalid' : ''}
                       value={datos.email} onChange={(e) => cambiar('email', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="tel">Teléfono</label>
                <input type="tel" id="tel" name="tel" placeholder="55 1234 5678"
                       value={datos.tel} onChange={(e) => cambiar('tel', e.target.value)} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="motivo">¿En qué te ayudamos? *</label>
              <select id="motivo" name="motivo" required
                      className={malos.motivo ? 'invalid' : ''}
                      value={datos.motivo} onChange={(e) => cambiar('motivo', e.target.value)}>
                <option value="">Selecciona una opción</option>
                {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="mensaje">Mensaje *</label>
              <textarea id="mensaje" name="mensaje" rows="5" placeholder="Cuéntanos qué se te antoja…" required
                        className={malos.mensaje ? 'invalid' : ''}
                        value={datos.mensaje} onChange={(e) => cambiar('mensaje', e.target.value)} />
            </div>
            <button type="submit" className="btn btn-pink btn-lg btn-block" disabled={Boolean(enviando)}>
              {enviando === 'whatsapp' ? 'Enviando…' : 'Enviar por WhatsApp 💬'}
            </button>

            {/* Sólo si el servidor puede mandar correos de verdad: ofrecer el
                botón con el SMTP a medias sería prometer un correo que nunca
                sale. Lo dice /api/v1/config. */}
            {CONFIG.correoActivo ? (
              <button
                type="button"
                className="btn btn-correo btn-lg btn-block"
                onClick={() => procesar('correo')}
                disabled={Boolean(enviando)}
              >
                {enviando === 'correo' ? 'Enviando…' : 'Enviar por correo ✉️'}
              </button>
            ) : null}

            <p className={'form-msg' + (msg.error ? ' error' : '')} id="contactMsg" role="status">{msg.texto}</p>
            <small className="form-note">
              {CONFIG.correoActivo
                ? 'Con WhatsApp se abre la app con tu mensaje listo; por correo te contestamos a la dirección que dejaste.'
                : 'Al enviar se abrirá WhatsApp con tu mensaje listo para mandar.'}
            </small>
          </form>
        </div>
      </div>
    </section>
  );
}
