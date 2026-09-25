import { useState } from 'react';
import { api } from '../api';
import { CONFIG, waLink } from '../config';

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
  const [enviando, setEnviando] = useState(false);

  function cambiar(campo, valor) {
    setDatos((d) => ({ ...d, [campo]: valor }));
    if (malos[campo]) setMalos((m) => ({ ...m, [campo]: false }));
  }

  async function enviar(e) {
    e.preventDefault();

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

    setEnviando(true);
    try {
      await api.contacto({
        nombre:  datos.nombre.trim(),
        email:   datos.email.trim(),
        tel:     datos.tel.trim(),
        motivo:  datos.motivo,
        mensaje: datos.mensaje.trim()
      });
    } catch (err) {
      /* Se registra en la consola y se sigue: el cliente no tiene por qué
         enterarse de que nuestro servidor tuvo un mal día. */
      console.warn('No se pudo guardar el mensaje:', err.message);
    } finally {
      setEnviando(false);
    }

    const texto =
`¡Hola ${CONFIG.negocio}! 🍭
Nombre: ${datos.nombre.trim()}
Correo: ${datos.email.trim()}${datos.tel.trim() ? '\nTeléfono: ' + datos.tel.trim() : ''}
Motivo: ${datos.motivo}
Mensaje: ${datos.mensaje.trim()}`;

    window.open(waLink(texto), '_blank', 'noopener');

    setMsg({ texto:'¡Listo! Abrimos WhatsApp con tu mensaje. 💬', error:false });
    setDatos(VACIO);
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
              <div><strong>WhatsApp</strong><span>+52 55 1234 5678</span></div>
            </a>
            <a className="info-card" href="mailto:hola@candylandiastore.com">
              <span className="info-ico" style={{ '--c1':'#F42A8F', '--c2':'#FF8AC4' }}>✉️</span>
              <div><strong>Correo</strong><span>hola@candylandiastore.com</span></div>
            </a>
            <div className="info-card">
              <span className="info-ico" style={{ '--c1':'#29B6E8', '--c2':'#7FDBFF' }}>📍</span>
              <div><strong>Tienda física</strong><span>Av. Dulce 123, Col. Centro, CDMX</span></div>
            </div>
            <div className="info-card">
              <span className="info-ico" style={{ '--c1':'#A05CD6', '--c2':'#D9A8F5' }}>🕒</span>
              <div><strong>Horario</strong><span>Lun a Sáb 10:00 – 20:00 · Dom 11:00 – 17:00</span></div>
            </div>

            <div className="socials">
              <a href="#" aria-label="Instagram">Instagram</a>
              <a href="#" aria-label="TikTok">TikTok</a>
              <a href="#" aria-label="Facebook">Facebook</a>
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
            <button type="submit" className="btn btn-pink btn-lg btn-block" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Enviar por WhatsApp 💬'}
            </button>
            <p className={'form-msg' + (msg.error ? ' error' : '')} id="contactMsg" role="status">{msg.texto}</p>
            <small className="form-note">Al enviar se abrirá WhatsApp con tu mensaje listo para mandar.</small>
          </form>
        </div>
      </div>
    </section>
  );
}
