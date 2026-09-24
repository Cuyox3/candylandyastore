import { useCallback, useEffect, useRef, useState } from 'react';

/* =========================================================
   El avisito de abajo (.toast) del panel.

   El temporizador se guarda en una ref y se limpia al desmontar: si no,
   cerrar el panel con un aviso en pantalla deja un setTimeout apuntando a un
   componente que ya no existe.
   ========================================================= */
export function useToast(milisegundos = 3200) {
  const [aviso, setAviso] = useState(null);   // { texto, error }
  const temporizador = useRef(null);

  const mostrar = useCallback((texto, error = false) => {
    setAviso({ texto, error });
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), milisegundos);
  }, [milisegundos]);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  return { aviso, mostrar };
}
