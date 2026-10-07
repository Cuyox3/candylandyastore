import { useRef } from 'react';
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
  onEditar, onQuitar, onExportar, onImportar, onRestaurar,
  onDescargar, onImportarExcel
}) {
  /* El <input type="file"> va escondido y lo dispara el botón: el control que
     trae el navegador no se puede peinar y rompería la fila de botones. */
  const archivoExcel = useRef(null);

  function alElegirArchivo(e) {
    const archivo = e.target.files && e.target.files[0];
    /* Se limpia SIEMPRE, también cuando se cancela. Sin esto, elegir el mismo
       archivo dos veces seguidas no dispara `change` y parece que el botón
       dejó de funcionar. */
    e.target.value = '';
    if (archivo) onImportarExcel(archivo);
  }

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
      </div>

      {/* Descargas y respaldo, en dos filas rotuladas: antes eran tres
          botones sueltos donde «Exportar» y «Restaurar» quedaban a la misma
          altura, y uno de los dos borra el catálogo. */}
      <div className="admin-descargas">
        <div className="descarga-grupo">
          <span className="descarga-titulo">Descargar</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onExportar}
                  title="El respaldo completo: es el único que se lleva las fotos dentro">
            JSON 🧾
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDescargar('xlsx')}
                  title="Para cambiar precios en masa y volver a subirlo">
            Excel 📊
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDescargar('pdf')}
                  title="Para mirar, imprimir o mandar. No se puede reimportar">
            PDF 📄
          </button>
        </div>

        <div className="descarga-grupo">
          <span className="descarga-titulo">Reemplazar el catálogo</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onImportar}>
            Pegar JSON
          </button>
          <button type="button" className="btn btn-ghost btn-sm"
                  onClick={() => archivoExcel.current?.click()}>
            Subir Excel
          </button>
          <button type="button" className="btn btn-ghost btn-sm peligro" onClick={onRestaurar}>
            Restaurar el de fábrica
          </button>
          <input
            ref={archivoExcel} type="file" className="sr-only" tabIndex={-1}
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={alElegirArchivo}
          />
        </div>
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
