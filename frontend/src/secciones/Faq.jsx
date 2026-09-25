import { useMemo } from 'react';
import { useJsonLd } from '../hooks/useSeo';

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
  /* Las mismas seis preguntas, en el formato que Google necesita para
     enseñarlas desplegadas debajo del resultado. Se generan desde la lista de
     arriba y no se escriben aparte: un FAQPage que promete una respuesta que
     no está en la página es motivo de aviso en Search Console, y con dos
     copias a mano eso pasa a la primera corrección de una errata. */
  const datos = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: PREGUNTAS.map((q) => ({
      '@type': 'Question',
      name: q.p,
      acceptedAnswer: { '@type': 'Answer', text: q.r }
    }))
  }), []);

  useJsonLd('faq', datos);

  return (
    <section className="section" id="faq" aria-labelledby="faq-titulo">
      <div className="container narrow">
        <div className="section-head reveal">
          <span className="eyebrow">Preguntas frecuentes</span>
          <h2 id="faq-titulo">Resolvemos tus <span className="grad-text">dudas dulces</span></h2>
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
