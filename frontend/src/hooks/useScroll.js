import { useEffect, useState } from 'react';

/* =========================================================
   Estado del scroll: sombra de la barra, botón «subir» y
   sección activa del menú.

   Mismos umbrales que el sitio clásico (12 px y 600 px) para que el cambio de
   la barra ocurra exactamente en el mismo punto.
   ========================================================= */
export function useScroll(idsSecciones = []) {
  const [bajado, setBajado]   = useState(false);   // > 12 px
  const [lejos,  setLejos]    = useState(false);   // > 600 px
  const [activa, setActiva]   = useState('');

  useEffect(() => {
    function alScrollear() {
      const y = window.scrollY;
      setBajado(y > 12);
      setLejos(y > 600);

      let actual = '';
      idsSecciones.forEach((id) => {
        const sec = document.getElementById(id);
        if (sec && y >= sec.offsetTop - 140) actual = id;
      });
      setActiva(actual);
    }

    window.addEventListener('scroll', alScrollear, { passive: true });
    alScrollear();
    return () => window.removeEventListener('scroll', alScrollear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsSecciones.join(',')]);

  return { bajado, lejos, activa };
}
