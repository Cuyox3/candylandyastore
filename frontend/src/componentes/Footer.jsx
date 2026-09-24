import { Link } from 'react-router-dom';

/* Pie de la tienda. El bloque de abajo (copyright + autoría) es el mismo que
   usa el panel, por eso vive en FooterBottom y se reutiliza. */
export function FooterBottom({ children }) {
  return (
    <div className="container footer-bottom">
      {children}
      <p className="footer-autor">
        Hecho por <a href="https://cuyox3.com/" target="_blank" rel="noopener">Cuyox3</a>
        <a className="autor-emoji" href="https://cuyox3.github.io/portfolio/" target="_blank" rel="noopener"
           title="Portafolio de Cuyox3" aria-label="Ver el portafolio de Cuyox3">💼</a>
      </p>
    </div>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src="/assets/logo.png" alt="Candylandia Store" />
          <p>Dulces de importación seleccionados a mano. Traemos el mundo a tu antojo desde 2021.</p>
        </div>
        <div className="footer-col">
          <h4>Tienda</h4>
          <a href="#productos">Productos</a>
          <a href="#mayoreo">Mayoreo</a>
          <a href="#contacto">Pedidos especiales</a>
        </div>
        <div className="footer-col">
          <h4>Nosotros</h4>
          <a href="#nosotros">Nuestra historia</a>
          <a href="#testimonios">Testimonios</a>
          <a href="#faq">Preguntas frecuentes</a>
          <a href="#contacto">Contacto</a>
        </div>
        <div className="footer-col">
          <h4>Ayuda</h4>
          <a href="#faq">Envíos y entregas</a>
          <a href="#faq">Formas de pago</a>
          <a href="#faq">Devoluciones</a>
          <a href="#contacto">Soporte</a>
          <Link to="/admin">Panel de administración</Link>
        </div>
      </div>
      <FooterBottom>
        <p>© <span id="year">{new Date().getFullYear()}</span> Candylandia Store. Todos los derechos reservados.</p>
        <p>Hecho con 💖 y mucha azúcar.</p>
      </FooterBottom>
    </footer>
  );
}
