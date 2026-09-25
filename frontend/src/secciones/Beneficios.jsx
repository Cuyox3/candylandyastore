const BENEFICIOS = [
  { c1:'#F42A8F', c2:'#FF8AC4', ico:'🛫', titulo:'Importación directa',
    texto:'Compramos en origen, sin intermediarios. Producto original y fecha de caducidad vigente, siempre.' },
  { c1:'#29B6E8', c2:'#7FDBFF', ico:'🚚', titulo:'Envíos a todo México',
    texto:'Empaque térmico y anti-golpes. Recibe en 2 a 4 días hábiles con guía rastreable.' },
  { c1:'#A05CD6', c2:'#D9A8F5', ico:'🆕', titulo:'Novedades semanales',
    texto:'Cada viernes llegan ediciones limitadas y sabores de temporada que duran lo que duran.' },
  { c1:'#FF8A29', c2:'#FFD36E', ico:'🏷️', titulo:'Mayoreo y revendedores',
    texto:'Listas de precio por volumen, surtido curado y asesoría para que tu tienda venda más.' }
];

export default function Beneficios() {
  return (
    /* El diseño de esta franja no lleva título: son cuatro tarjetas y ya. Pero
       sin un h2 los cuatro h3 de abajo cuelgan directamente del h1 del hero, y
       tanto un lector de pantalla como un buscador leen eso como un salto de
       nivel. El título está, sólo que sólo lo ve quien no ve la página. */
    <section className="benefits" aria-labelledby="beneficios-titulo">
      <h2 id="beneficios-titulo" className="sr-only">
        Por qué comprar en Candylandia Store
      </h2>
      <div className="container grid-4">
        {BENEFICIOS.map((b) => (
          <article className="benefit reveal" key={b.titulo}>
            <div className="benefit-ico" style={{ '--c1': b.c1, '--c2': b.c2 }}>{b.ico}</div>
            <h3>{b.titulo}</h3>
            <p>{b.texto}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
