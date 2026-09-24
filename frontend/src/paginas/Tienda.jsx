import { useEffect, useState } from 'react';
import { api } from '../api';
import { CONFIG } from '../config';
import { useReveal } from '../hooks/useReveal';
import { useScroll } from '../hooks/useScroll';

import TopBar from '../componentes/TopBar';
import Navbar from '../componentes/Navbar';
import Footer from '../componentes/Footer';
import Flotantes from '../componentes/Flotantes';

import Hero from '../secciones/Hero';
import Beneficios from '../secciones/Beneficios';
import Nosotros from '../secciones/Nosotros';
import Productos from '../secciones/Productos';
import Mayoreo from '../secciones/Mayoreo';
import Testimonios from '../secciones/Testimonios';
import Faq from '../secciones/Faq';
import Newsletter from '../secciones/Newsletter';
import Contacto from '../secciones/Contacto';

const MENSAJES = [
  '🚚 Envío GRATIS en compras mayores a $699',
  '🍬 Novedades de Japón y Corea cada semana',
  '🏪 Precios especiales de mayoreo'
];

const ENLACES = [
  { href:'#inicio',    texto:'Inicio' },
  { href:'#nosotros',  texto:'Nosotros' },
  { href:'#productos', texto:'Productos' },
  { href:'#mayoreo',   texto:'Mayoreo' },
  { href:'#faq',       texto:'FAQ' },
  { href:'#contacto',  texto:'Contacto' },
  { href:'#contacto',  texto:'Haz tu pedido', cta:true }
];

const SECCIONES = ['inicio','nosotros','productos','mayoreo','testimonios','faq','contacto'];

export default function Tienda() {
  const [categorias, setCategorias] = useState([]);
  const [productos,  setProductos]  = useState([]);
  const [filtro,     setFiltro]     = useState('todos');
  const [cargando,   setCargando]   = useState(true);
  const [error,      setError]      = useState('');

  const { bajado, lejos, activa } = useScroll(SECCIONES);

  /* Una sola carga al entrar: el catálogo completo y las categorías. El
     filtrado se hace en memoria —son decenas de productos, no miles— para que
     cambiar de categoría sea instantáneo y no dependa de la red. */
  useEffect(() => {
    let vivo = true;

    (async () => {
      try {
        const [cats, prods, cfg] = await Promise.all([
          api.categorias(),
          api.productos('todos'),
          api.config().catch(() => null)   // si falla, quedan los valores por defecto
        ]);
        if (!vivo) return;

        setCategorias(cats);
        setProductos(prods);
        if (cfg && cfg.whatsapp) CONFIG.whatsapp = cfg.whatsapp;
        if (cfg && cfg.sitio)    CONFIG.negocio  = cfg.sitio;
        setError('');
      } catch (err) {
        if (vivo) setError(err.message);
      } finally {
        if (vivo) setCargando(false);
      }
    })();

    return () => { vivo = false; };
  }, []);

  const visibles = filtro === 'todos'
    ? productos
    : productos.filter((p) => p.cat === filtro);

  /* Las tarjetas nuevas que aparecen al filtrar también tienen que animarse,
     por eso el hook depende de lo que se está pintando. */
  useReveal([cargando, filtro, productos.length]);

  return (
    <>
      <TopBar mensajes={MENSAJES} />
      <Navbar inicio="#inicio" enlaces={ENLACES} activa={activa} bajado={bajado} />

      <Hero />
      <Beneficios />
      <Nosotros />
      <Productos
        productos={visibles}
        categorias={categorias}
        filtro={filtro}
        onFiltrar={setFiltro}
        cargando={cargando}
        error={error}
      />
      <Mayoreo />
      <Testimonios />
      <Faq />
      <Newsletter />
      <Contacto />

      <Footer />
      <Flotantes mostrarSubir={lejos} />
    </>
  );
}
