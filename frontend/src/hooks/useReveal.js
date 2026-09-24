import { useEffect } from 'react';

/* =========================================================
   Aparición al hacer scroll (.reveal → .visible)

   Es el IntersectionObserver del script.js clásico. En React hay que
   re-observar cuando cambia el contenido —al filtrar productos aparecen
   nodos nuevos que nunca pasaron por el observador— y por eso el hook recibe
   una lista de dependencias.

   Los elementos ya visibles se dejan en paz: volver a observarlos les quitaría
   la clase y la tarjeta parpadearía en cada render.
   ========================================================= */
export function useReveal(dependencias = []) {
  useEffect(() => {
    const nodos = document.querySelectorAll('.reveal:not(.visible)');
    if (!nodos.length) return;

    const observador = new IntersectionObserver((entradas) => {
      entradas.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('visible');
          observador.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    nodos.forEach((el) => observador.observe(el));
    return () => observador.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);
}
