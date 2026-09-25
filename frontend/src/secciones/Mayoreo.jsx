export default function Mayoreo() {
  return (
    <section className="wholesale" id="mayoreo" aria-labelledby="mayoreo-titulo">
      <div className="container wholesale-inner">
        <div className="wholesale-copy reveal">
          <span className="eyebrow light">Mayoreo</span>
          <h2 id="mayoreo-titulo">Dulces de importación al mayoreo para tu tienda, cafetería o kiosco</h2>
          <p>
            Surtimos a más de 120 negocios en el país con dulces de importación que se venden solos.
            Pide tu lista de precios y arma tu primer pedido desde $3,500.
          </p>
          <ul className="wholesale-list">
            <li><strong>Hasta 40%</strong> de margen sugerido</li>
            <li><strong>Surtido curado</strong> según tu tipo de cliente</li>
            <li><strong>Material POP</strong> y exhibidores sin costo</li>
            <li><strong>Reposición</strong> quincenal programada</li>
          </ul>
          <a href="#contacto" className="btn btn-yellow btn-lg">Solicitar lista de precios 📋</a>
        </div>
        <div className="wholesale-art reveal">
          <picture>
            <source srcSet="/assets/mascota.webp" type="image/webp" />
            <img
              src="/assets/mascota.png"
              alt="Candy con una caja de dulces de importación para pedidos de mayoreo"
              className="floaty"
              width="401" height="438"
              loading="lazy" decoding="async"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
