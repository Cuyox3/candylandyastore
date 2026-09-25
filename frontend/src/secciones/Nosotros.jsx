export default function Nosotros() {
  return (
    <section className="section" id="nosotros" aria-labelledby="nosotros-titulo">
      <div className="container about-grid">
        <div className="about-art reveal">
          <div className="about-frame">
            <picture>
              <source srcSet="/assets/mascota.webp" type="image/webp" />
              <img
                src="/assets/mascota.png"
                alt="Candy, la mascota de Candylandia Store, dando la bienvenida"
                width="401" height="438"
                loading="lazy" decoding="async"
              />
            </picture>
          </div>
          <div className="about-badge">
            <strong>Hola, soy Candy 👋</strong>
            <span>Tu guía oficial de antojos</span>
          </div>
        </div>

        <div className="about-copy reveal">
          <span className="eyebrow">Nosotros</span>
          <h2 id="nosotros-titulo">Una tiendita chiquita con <span className="grad-text">sabores de todo el mundo</span></h2>
          <p>
            Candylandia Store nació en 2021 de un antojo muy específico: probar esos dulces que solo salían
            en videos de internet. Empezamos con una maleta de gomitas japonesas y hoy somos la tienda favorita
            de quienes coleccionan sabores raros, arman regalos originales y celebran con estilo.
          </p>
          <p>
            Seleccionamos cada producto a mano, verificamos su origen y lo probamos antes de ponerlo en el
            aparador. Si no nos encanta, no lo vendemos.
          </p>

          <ul className="check-list">
            <li>Productos 100% originales con etiquetado de importación</li>
            <li>Control de caducidad y cadena de frío en chocolates</li>
            <li>Atención personalizada por WhatsApp, de humano a humano</li>
            <li>Recomendaciones según tu nivel de picante, dulzura o rareza</li>
          </ul>

          <div className="values">
            <div><span>🎯</span><strong>Misión</strong><p>Acercar los sabores del mundo a cada mesa mexicana.</p></div>
            <div><span>🌈</span><strong>Visión</strong><p>Ser la dulcería de importación más querida del país.</p></div>
            <div><span>💛</span><strong>Valores</strong><p>Honestidad, curiosidad y mucha, mucha azúcar.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}
