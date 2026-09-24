import { useState } from 'react';

/* =========================================================
   Pantalla de acceso al panel.

   Mismo diseño que la del sitio clásico, pero ahora la comprobación la hace
   el servidor: la contraseña ya no viaja dentro del JavaScript, donde
   cualquiera podía leerla abriendo admin.js.
   ========================================================= */
export default function Acceso({ onEntrar }) {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave]     = useState('');
  const [msg, setMsg]         = useState('');
  const [entrando, setEntrando] = useState(false);

  async function enviar(e) {
    e.preventDefault();

    if (!usuario.trim() || !clave) {
      setMsg('Escribe tu usuario y tu clave.');
      return;
    }

    setEntrando(true);
    setMsg('');
    try {
      await onEntrar(usuario.trim(), clave);
    } catch (err) {
      setMsg(err.message);
      setClave('');
    } finally {
      setEntrando(false);
    }
  }

  const fallo = Boolean(msg);

  return (
    <section className="section" id="acceso">
      <div className="container gate" id="gate">
        <form className="gate-card" id="gateForm" noValidate onSubmit={enviar}>
          <img src="/assets/mascota.png" alt="Candy, mascota de Candylandia Store" />
          <span className="eyebrow">Área privada</span>
          <h2>Panel de <span className="grad-text">administración</span></h2>
          <p>Escribe tu usuario y tu clave para administrar el catálogo de productos.</p>

          <div className="field">
            <label className="sr-only" htmlFor="usuario">Usuario</label>
            <input
              type="text" id="usuario" name="usuario" placeholder="Usuario"
              autoComplete="username" autoCapitalize="none" spellCheck="false" required
              className={fallo ? 'invalid' : ''}
              value={usuario} onChange={(e) => setUsuario(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="sr-only" htmlFor="clave">Clave de acceso</label>
            <input
              type="password" id="clave" name="clave" placeholder="Clave de acceso"
              autoComplete="current-password" required
              className={fallo ? 'invalid' : ''}
              value={clave} onChange={(e) => setClave(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-pink btn-lg btn-block" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar 🍭'}
          </button>

          <p className={'form-msg' + (fallo ? ' error' : '')} id="gateMsg" role="status">{msg}</p>
          <small className="form-note">
            El usuario y la clave se comprueban en el servidor. Para crearlos o cambiarlos:
            <code> ./deploy.sh --admin</code>
          </small>
        </form>
      </div>
    </section>
  );
}
