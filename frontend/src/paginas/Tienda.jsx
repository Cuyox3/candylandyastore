import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { CONFIG } from '../config';
import { useReveal } from '../hooks/useReveal';
import { useScroll } from '../hooks/useScroll';
import { SITIO, absoluta, useJsonLd, useSeo } from '../hooks/useSeo';

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

/* Lo mismo que trae index.html escrito a mano. Se repite aquí para que, al
   volver del panel, la cabecera quede como estaba: el panel la cambia entera
   —incluido el `noindex`— y alguien tiene que devolverla. */
const SEO = {
  titulo: 'Dulces de importación en México | Candylandia Store',
  descripcion: 'Dulces y snacks de importación de Japón, Corea, USA, Europa y Brasil. '
             + 'Más de 450 productos originales, novedades cada semana, envíos a todo '
             + 'México y precios de mayoreo.',
  canonica: `${SITIO.url}/`,
  robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
};

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

  useSeo(SEO);

  /* El catálogo, en el vocabulario que entienden los buscadores.

     Se construye con la lista COMPLETA y no con `visibles`: el filtro es cosa
     de quien está mirando la tienda, y regenerar los datos estructurados cada
     vez que alguien pulsa «Corea» sólo conseguiría que Google viera un
     catálogo distinto en cada visita.

     Las fotos que llegan como `data:` se quedan fuera: un base64 de 40 KB
     dentro del JSON-LD no es una dirección que nadie pueda ir a buscar. */
  const catalogo = useMemo(() => {
    if (!productos.length) return null;

    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      '@id': `${SITIO.url}/#catalogo-visible`,
      name: 'Catálogo de dulces de importación',
      numberOfItems: productos.length,
      itemListElement: productos.map((p, i) => {
        const foto = absoluta(p.img);
        const item = {
          '@type': 'Product',
          '@id': `${SITIO.url}/#producto-${p.id}`,
          name: p.nombre,
          category: p.cat,
          offers: {
            '@type': 'Offer',
            price: Number(p.precio || 0).toFixed(2),
            priceCurrency: 'MXN',
            availability: 'https://schema.org/InStock',
            url: `${SITIO.url}/#productos`,
            seller: { '@id': `${SITIO.url}/#tienda` }
          }
        };
        if (p.desc)   item.description = p.desc;
        if (p.origen) item.countryOfOrigin = { '@type': 'Country', name: p.origen };
        if (foto && !foto.startsWith('data:')) item.image = foto;
        return { '@type': 'ListItem', position: i + 1, item };
      })
    };
  }, [productos]);

  useJsonLd('catalogo', catalogo);

  return (
    <>
      <TopBar mensajes={MENSAJES} />
      <Navbar inicio="#inicio" enlaces={ENLACES} activa={activa} bajado={bajado} />

      {/* <main> no cambia nada de lo que se ve —styles.css sólo mira clases—,
          pero le dice a un lector de pantalla y a un buscador dónde empieza
          el contenido propio de la página y dónde acaban la cinta promocional
          y el menú, que se repiten igual en todas. */}
      <main>
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
      </main>

      <Footer />
      <Flotantes mostrarSubir={lejos} />
    </>
  );
}
