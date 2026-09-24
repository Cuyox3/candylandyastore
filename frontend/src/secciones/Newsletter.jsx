import { useState } from 'react';
import { api } from '../api';

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* =========================================================
   Newsletter.

   Antes el correo se guardaba en el localStorage de quien se suscribía, que
   es tanto como tirarlo. Ahora va a la base y se puede consultar desde el
   panel.
   ========================================================= */
export default function Newsletter() {
  const [email, setEmail] = useState('');
  const [msg, setMsg]     = useState({ texto:'', error:false });
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    const valor = email.trim();

    if (!CORREO.test(valor)) {
      setMsg({ texto:'Escribe un correo válido para suscribirte.', error:true });
      return;
    }

    setEnviando(true);
    try {
      const r = await api.suscribir(valor);
      setMsg({ texto: r.detalle || '¡Gracias! Ya eres parte del club dulce 🍬', error:false });
      setEmail('');
    } catch (err) {
      setMsg({ texto: err.message, error:true });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="newsletter">
      <div className="container newsletter-inner reveal">
        <div className="newsletter-copy">
          <h2>Entérate antes que nadie 🍫</h2>
          <p>Novedades, preventas y cupones exclusivos. Un correo a la semana, cero spam.</p>
        </div>
        <form className="newsletter-form" id="newsletterForm" noValidate onSubmit={enviar}>
          <label className="sr-only" htmlFor="newsEmail">Tu correo electrónico</label>
          <input
            type="email" id="newsEmail" name="email" placeholder="tucorreo@ejemplo.com"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <button type="submit" className="btn btn-purple" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Suscribirme'}
          </button>
        </form>
        <p className={'form-msg light' + (msg.error ? ' error' : '')} id="newsMsg" role="status">
          {msg.texto}
        </p>
      </div>
    </section>
  );
}
