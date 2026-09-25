export default function Hero() {
  return (
    <section className="hero" id="inicio" aria-labelledby="hero-titulo">
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>

      <div className="container hero-inner">
        <div className="hero-copy">
          <span className="pill">🌎 Dulces de importación · Envíos a todo México</span>
          <h1 id="hero-titulo">El mundo entero <span className="grad-text">cabe en un dulce</span></h1>
          <p className="lead">
            Snacks, gomitas, chocolates y bebidas que no encuentras en la tienda de la esquina.
            Traemos lo mejor de <strong>Japón, Corea, Estados Unidos, Europa y Brasil</strong> directo a tu antojo.
          </p>

          <div className="hero-actions">
            <a href="#productos" className="btn btn-pink btn-lg">Ver productos 🍭</a>
            <a href="#contacto" className="btn btn-outline btn-lg">Pedir por WhatsApp</a>
          </div>

          <div className="hero-stats">
            <div><strong>+450</strong><span>productos únicos</span></div>
            <div><strong>+12</strong><span>países de origen</span></div>
            <div><strong>+8mil</strong><span>clientes felices</span></div>
          </div>
        </div>

        <div className="hero-art">
          <div className="hero-glow"></div>
          {/* El PNG pesa 251 KB y el WebP 39: el <picture> deja que el
              navegador se quede con el que entienda, y el PNG sigue ahí para
              los pocos que no. El width/height es el del archivo, no el del
              diseño —el CSS manda—, y sirve para que el navegador reserve el
              hueco antes de que la imagen llegue; sin eso, todo lo que hay
              debajo salta cuando aparece, que es lo que Google mide como CLS.
              `fetchpriority` la adelanta al resto: es la imagen grande de la
              primera pantalla. */}
          <picture>
            <source srcSet="/assets/mascota.webp" type="image/webp" />
            <img
              src="/assets/mascota.png"
              alt="Candy, la mascota de Candylandia Store, con una caja de dulces importados de Japón, Corea y Estados Unidos"
              className="mascot floaty"
              width="401" height="438"
              fetchPriority="high" decoding="async"
            />
          </picture>
          <div className="flag-chip chip-1">🇯🇵 Japón</div>
          <div className="flag-chip chip-2">🇰🇷 Corea</div>
          <div className="flag-chip chip-3">🇺🇸 USA</div>
          <div className="flag-chip chip-4">🇧🇷 Brasil</div>
        </div>
      </div>

      <div className="wave-divider" aria-hidden="true">
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none"><path d="M0,64 C240,120 480,0 720,32 C960,64 1200,120 1440,72 L1440,120 L0,120 Z"></path></svg>
      </div>
    </section>
  );
}
