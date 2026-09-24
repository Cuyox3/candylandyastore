const PREGUNTAS = [
  { p:'¿A qué partes de México envían?',
    r:'Enviamos a toda la República con paqueterías nacionales. El tiempo estimado es de 2 a 4 días hábiles en zonas urbanas y de 4 a 6 en zonas extendidas. Todos los pedidos incluyen guía rastreable.' },
  { p:'¿Los productos son originales?',
    r:'Sí. Importamos directo o mediante distribuidores autorizados, y todos nuestros productos cuentan con su etiquetado correspondiente. Puedes revisar la fecha de caducidad en la descripción de cada artículo.' },
  { p:'¿Cómo cuidan los chocolates en climas calurosos?',
    r:'Empacamos con bolsa térmica y gel refrigerante en temporada de calor. Si tu zona supera los 30°C, te recomendamos programar tu envío a inicio de semana para evitar que el paquete pase el fin de semana en tránsito.' },
  { p:'¿Puedo pedir un producto que no está en el catálogo?',
    r:'Claro. Trabajamos pedidos especiales con un anticipo del 50%. El tiempo de llegada varía entre 2 y 5 semanas según el país de origen.' },
  { p:'¿Qué formas de pago aceptan?',
    r:'Transferencia bancaria, tarjetas de crédito y débito, pagos en efectivo en tiendas de conveniencia y meses sin intereses a partir de $1,500.' },
  { p:'¿Cuál es el pedido mínimo de mayoreo?',
    r:'$3,500 en el primer pedido y $2,000 en reposiciones. Te asignamos un asesor que te ayuda a armar el surtido según lo que más se vende en tu zona.' }
];

export default function Faq() {
  return (
    <section className="section" id="faq">
      <div className="container narrow">
        <div className="section-head reveal">
          <span className="eyebrow">Preguntas frecuentes</span>
          <h2>Resolvemos tus <span className="grad-text">dudas dulces</span></h2>
        </div>

        <div className="faq-list">
          {PREGUNTAS.map((q) => (
            /* <details> nativo, como en el sitio clásico: la apertura y el
               cierre los lleva el navegador y styles.css ya los estiliza. */
            <details className="faq-item reveal" key={q.p}>
              <summary>{q.p}</summary>
              <p>{q.r}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
