import { useEffect } from 'react';

/* =========================================================
   El título de la pestaña.

   En el sitio clásico cada página traía el suyo en su propio <title>. Aquí
   index.html es uno solo para las dos rutas, así que la página lo pone al
   montarse y lo devuelve al salir — si no, ir a /admin y volver a la tienda
   dejaría «Panel de administración» en la pestaña.
   ========================================================= */
export function useTitulo(titulo) {
  useEffect(() => {
    const previo = document.title;
    document.title = titulo;
    return () => { document.title = previo; };
  }, [titulo]);
}
