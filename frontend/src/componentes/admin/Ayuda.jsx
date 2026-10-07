/* =========================================================
   La guía del panel: lo que abre el botón «?».

   Está escrita para quien vende dulces, no para quien programa: dice qué pasa
   al pulsar cada cosa y, sobre todo, qué NO tiene vuelta atrás. Por eso los
   avisos van pegados al paso que los provoca y no en una lista de advertencias
   al final, que no lee nadie.

   El contenido vive aquí en vez de en la base porque es documentación del
   panel: cambia cuando cambia el panel, en el mismo commit.
   ========================================================= */

const SECCIONES = [
  {
    id: 'productos',
    icono: '🍬',
    titulo: 'Productos',
    pasos: [
      ['Agregar uno', 'Llena el formulario de la izquierda y pulsa «Guardar producto». '
        + 'Aparece en la tienda al instante, arriba del todo.'],
      ['Modificar uno', 'Pulsa ✎ en la lista de la derecha. El formulario se llena con sus '
        + 'datos y el botón cambia a «Guardar cambios». Si te arrepientes, «Cancelar».'],
      ['Quitar uno', 'Pulsa 🗑️ y confirma. Desaparece de la tienda y su foto se borra con él. '
        + 'No se puede deshacer: si no estás seguro, exporta antes.'],
      ['Buscar', 'El buscador de la lista filtra por nombre, origen, categoría y descripción '
        + 'mientras escribes. No cambia nada, sólo lo que ves.'],
    ],
  },
  {
    id: 'fotos',
    icono: '📷',
    titulo: 'Fotos',
    pasos: [
      ['Subir una', 'En el formulario, «Subir foto». Se admite PNG, JPG, WebP, GIF y AVIF '
        + 'hasta 8 MB.'],
      ['Qué le pasa', 'Se reduce a 560 px por el lado mayor y se convierte a WebP, que pesa '
        + 'bastante menos sin que se note. Se guarda dentro de la base de datos, colgada del '
        + 'producto, así que entra en el respaldo con todo lo demás.'],
      ['Quitarla', '«Quitar foto» devuelve la tarjeta al emoji. La foto se borra de verdad.'],
      ['Si no pones foto', 'La tarjeta usa el emoji sobre el degradado de los dos colores '
        + 'que elijas. No es un parche: la mitad del catálogo de ejemplo va así.'],
    ],
  },
  {
    id: 'categorias',
    icono: '🗂️',
    titulo: 'Categorías',
    pasos: [
      ['Para qué son', 'Son los filtros de la tienda y el desplegable del formulario.'],
      ['Crear una', '«+ Nueva categoría». El identificador se propone solo a partir del '
        + 'nombre; es lo que usa el sistema por dentro y no se puede cambiar después.'],
      ['Cambiar el nombre', 'Edítalo en la fila y pulsa 💾. Puedes cambiar el nombre visible '
        + 'y el orden cuando quieras: el identificador se queda como está.'],
      ['Esconderla sin borrarla', 'Desmarca «Visible». Sale de los filtros y sus productos '
        + 'dejan de verse en la tienda, pero nada se pierde y se puede volver a marcar.'],
      ['Borrarla', 'Sólo si está vacía. Si tiene productos el servidor lo impide y te dice '
        + 'cuántos son: muévelos de categoría primero.'],
    ],
  },
  {
    id: 'etiquetas',
    icono: '🏷️',
    titulo: 'Etiquetas',
    pasos: [
      ['Qué son', 'La pastilla de color de la esquina de la tarjeta: «Nuevo», «Top ventas»…'],
      ['Crear una', '«+ Nueva etiqueta»: el texto que se verá y un color. Los colores son una '
        + 'lista cerrada porque son los que la tienda sabe pintar.'],
      ['Cambiarla', 'Edita el texto o el color y pulsa 💾. El cambio llega también a los '
        + 'productos que ya la tenían puesta, sin que tengas que abrirlos uno a uno.'],
      ['Borrarla', 'Se puede aunque tenga productos: a esos se les quita la pastilla y nada '
        + 'más. No desaparecen ni se esconden.'],
      ['Sin etiqueta', 'Es la primera opción del desplegable y no se puede borrar: es la '
        + 'manera de dejar un producto sin pastilla.'],
    ],
  },
  {
    id: 'respaldo',
    icono: '💾',
    titulo: 'Exportar e importar',
    pasos: [
      ['JSON — el respaldo de verdad', 'Es el único formato que se lleva las fotos dentro. '
        + 'Si quieres poder volver atrás del todo, este es el que tienes que guardar.'],
      ['Excel (.xlsx)', 'Para cambiar precios o textos en masa: lo abres, editas la columna '
        + 'y lo vuelves a subir. Las fotos no viajan en la hoja, pero NO se pierden: al '
        + 'reimportar se reconocen por el identificador y se vuelven a colgar solas.'],
      ['PDF', 'Para mirar, imprimir o mandar. Es sólo de lectura: no se puede reimportar.'],
      ['Importar', 'Reemplaza TODO el catálogo por lo que traiga el archivo. Los productos '
        + 'que no estén en él se van. Se pregunta antes, con los números delante.'],
      ['Restaurar el de fábrica', 'Vuelve a los 16 dulces de ejemplo y borra los tuyos. '
        + 'Exporta antes o no hay vuelta atrás.'],
    ],
  },
  {
    id: 'cuenta',
    icono: '🔐',
    titulo: 'Tu sesión',
    pasos: [
      ['Cuánto dura', '12 horas. Si caduca con el panel abierto, vuelve la pantalla de '
        + 'acceso; lo que ya habías guardado está a salvo.'],
      ['Ver la clave al escribirla', 'La casilla «Ver la clave» de la pantalla de acceso, '
        + 'por si el teclado del móvil te juega una mala pasada.'],
      ['Cerrar sesión', 'Arriba a la derecha. Hazlo si el equipo no es sólo tuyo.'],
      ['Cambiar la contraseña', 'Hoy se hace desde el servidor, con «./deploy.sh --admin». '
        + 'Si la olvidaste, con eso se pone una nueva.'],
    ],
  },
];

export default function Ayuda() {
  return (
    <div className="ayuda">
      <p className="ayuda-intro">
        Todo lo que se puede hacer desde aquí, paso a paso. Los cambios se guardan en el
        servidor y se publican en la tienda al instante.
      </p>

      {SECCIONES.map((s) => (
        <section className="ayuda-bloque" key={s.id}>
          <h4><span aria-hidden="true">{s.icono}</span> {s.titulo}</h4>
          <dl>
            {s.pasos.map(([que, como]) => (
              <div className="ayuda-paso" key={que}>
                <dt>{que}</dt>
                <dd>{como}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <p className="ayuda-pie">
        ¿Algo no cuadra? Exporta el catálogo en JSON antes de tocar nada: con ese archivo
        siempre se puede volver al estado de hoy.
      </p>
    </div>
  );
}
