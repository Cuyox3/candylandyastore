import { Route, Routes } from 'react-router-dom';
import Tienda from './paginas/Tienda';
import Admin from './paginas/Admin';

/* Dos páginas: la tienda y el panel. El panel vive en /admin, que es donde
   apuntaba admin.html en el sitio clásico. */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Tienda />} />
      <Route path="/admin" element={<Admin />} />
      {/* Cualquier otra dirección cae en la tienda, que es lo que espera
          alguien que escribió mal la URL de una dulcería. */}
      <Route path="*" element={<Tienda />} />
    </Routes>
  );
}
