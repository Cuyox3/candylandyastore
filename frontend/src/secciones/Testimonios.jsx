const TESTIMONIOS = [
  { c1:'#F42A8F', c2:'#FF8AC4', inicial:'M', nombre:'Mariana R.', lugar:'Guadalajara, Jal.',
    texto:'Armé un regalo para el cumpleaños de mi hermana con puros dulces japoneses y fue el detalle del año. Llegó en 2 días y todo venía perfecto.' },
  { c1:'#29B6E8', c2:'#7FDBFF', inicial:'D', nombre:'Diego P.', lugar:'CDMX',
    texto:'Surto mi cafetería con ellos desde hace un año. Los snacks coreanos vuelan y el trato siempre es rápido y claro.' },
  { c1:'#A05CD6', c2:'#D9A8F5', inicial:'S', nombre:'Sofía L.', lugar:'Monterrey, N.L.',
    texto:'Buscaba un sabor de chocolate que solo hay en Japón, se los pedí especial y en dos semanas lo tenía en mi casa.' }
];

export default function Testimonios() {
  return (
    <section className="section section-alt" id="testimonios">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Testimonios</span>
          <h2>Lo que dicen <span className="grad-text">nuestros golosos</span></h2>
        </div>
        <div className="grid-3">
          {TESTIMONIOS.map((t) => (
            <figure className="testimonial reveal" key={t.nombre}>
              <div className="stars">★★★★★</div>
              <blockquote>{t.texto}</blockquote>
              <figcaption>
                <span className="avatar" style={{ '--c1': t.c1, '--c2': t.c2 }}>{t.inicial}</span>
                <div><strong>{t.nombre}</strong><small>{t.lugar}</small></div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
