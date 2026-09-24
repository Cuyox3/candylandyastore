import TarjetaProducto from '../componentes/TarjetaProducto';
import { CONFIG, waLink } from '../config';

/* =========================================================
   Catálogo de la tienda.

   Los filtros salen de las categorías del API, no de una lista escrita aquí:
   si mañana se añade «Brasil» desde el panel, el botón aparece solo. Es lo
   mismo que hacía renderFiltros() con CATEGORIAS, pero ahora la fuente es la
   base de datos y no un archivo del código.
   ========================================================= */
export default function Productos({ productos, categorias, filtro, onFiltrar, cargando, error }) {
  function pedir(p) {
    const msg = `¡Hola ${CONFIG.negocio}! 🍬 Me interesa el producto: ${p.nombre}. ¿Tienen disponible?`;
    window.open(waLink(msg), '_blank', 'noopener');
  }

  return (
    <section className="section section-alt" id="productos">
      <div className="container">
        <div className="section-head reveal">
          <span className="eyebrow">Productos</span>
          <h2>Nuestros <span className="grad-text">consentidos</span></h2>
          <p>Una probadita del catálogo. Tenemos más de 450 productos en tienda y llegan novedades cada semana.</p>
        </div>

        <div className="filters reveal" id="filters" aria-label="Filtrar productos por categoría">
          <button
            className={'filter' + (filtro === 'todos' ? ' active' : '')}
            onClick={() => onFiltrar('todos')}
            type="button"
          >Todos</button>

          {categorias.map((c) => (
            <button
              key={c.slug}
              className={'filter' + (filtro === c.slug ? ' active' : '')}
              onClick={() => onFiltrar(c.slug)}
              type="button"
            >{c.label}</button>
          ))}
        </div>

        <div className="products" id="products">
          {cargando && (
            <p style={{ gridColumn:'1/-1', textAlign:'center', color:'#6B5573' }}>
              Cargando el catálogo… 🍬
            </p>
          )}

          {/* Si el API no responde la tienda lo dice y no se queda en blanco
              fingiendo que no hay dulces. */}
          {!cargando && error && (
            <p style={{ gridColumn:'1/-1', textAlign:'center', color:'#D42B4B' }}>
              No pudimos cargar el catálogo. {error}
            </p>
          )}

          {!cargando && !error && productos.length === 0 && (
            <p style={{ gridColumn:'1/-1', textAlign:'center', color:'#6B5573' }}>
              Pronto agregaremos productos de esta categoría 🍬
            </p>
          )}

          {!cargando && !error && productos.map((p) => (
            <TarjetaProducto key={p.id} producto={p} onPedir={pedir} />
          ))}
        </div>

        <div className="products-cta reveal">
          <p>¿Buscas algo que no está aquí? Lo conseguimos por pedido especial.</p>
          <a href="#contacto" className="btn btn-cyan btn-lg">Pídelo a la medida ✨</a>
        </div>
      </div>
    </section>
  );
}
