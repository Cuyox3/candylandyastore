import TarjetaProducto from '../TarjetaProducto';

/* =========================================================
   Listado del panel.

   Cada producto se pinta con la MISMA tarjeta que la tienda, envuelta en
   .admin-item para colgarle los dos botones de la esquina (✎ y ✕). El botón
   «Lo quiero» queda inerte aquí: es parte del diseño, no una acción del
   panel.
   ========================================================= */
export default function ListaProductos({
  productos, buscar, onBuscar, editandoId,
  onEditar, onQuitar, onExportar, onImportar, onRestaurar
}) {
  return (
    <section className="admin-panel">
      <h3>🗂️ Productos en el catálogo</h3>
      <p>Pulsa ✎ para modificar un producto o ✕ para quitarlo de la tienda.</p>

      <div className="admin-toolbar">
        <label className="sr-only" htmlFor="buscar">Buscar producto</label>
        <input
          type="search" className="admin-search" id="buscar"
          placeholder="Buscar por nombre, país o categoría…"
          value={buscar} onChange={(e) => onBuscar(e.target.value)}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onExportar}>Exportar catálogo</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onImportar}>Importar</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRestaurar}>Restaurar</button>
      </div>

      <div className="admin-products" id="adminProducts">
        {productos.length === 0 ? (
          <p className="admin-empty">
            {buscar
              ? `Ningún producto coincide con «${buscar}».`
              : 'El catálogo está vacío. Agrega tu primer dulce con el formulario de al lado 🍬'}
          </p>
        ) : productos.map((p) => (
          <div className={'admin-item' + (editandoId === p.id ? ' editando' : '')} key={p.id}>
            <button
              type="button" className="card-edit"
              title={`Modificar ${p.nombre}`}
              aria-label={`Modificar ${p.nombre}`}
              onClick={() => onEditar(p)}
            >✎</button>

            <button
              type="button" className="card-del"
              title={`Quitar ${p.nombre}`}
              aria-label={`Quitar ${p.nombre}`}
              onClick={() => onQuitar(p)}
            >✕</button>

            <TarjetaProducto producto={p} botonInerte />
          </div>
        ))}
      </div>
    </section>
  );
}
