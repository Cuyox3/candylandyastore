"""
Catálogo de arranque.

Es el mismo `PRODUCTOS_BASE` que viajaba en clasico/productos.js, traducido a
Python. Se siembra UNA vez, en el primer arranque con la base vacía: a partir
de ahí manda la base de datos y este archivo sólo sirve como punto de partida
de una instalación nueva (o de `./deploy.sh --sembrar --forzar`).

Sembrar es idempotente por `slug`: volver a correrlo no duplica nada, pero
tampoco pisa lo que hayas editado desde el panel.
"""

from sqlalchemy.orm import Session

from .models import Categoria, Producto

# Categorías de los filtros de la tienda y del desplegable del panel.
CATEGORIAS = [
    {"slug": 'japon', "label": '🇯🇵 Japón', "orden": 0},
    {"slug": 'corea', "label": '🇰🇷 Corea', "orden": 1},
    {"slug": 'usa', "label": '🇺🇸 Estados Unidos', "orden": 2},
    {"slug": 'europa', "label": '🇪🇺 Europa', "orden": 3},
    {"slug": 'bebidas', "label": '🥤 Bebidas', "orden": 4},
]

# Etiquetas de la esquina de la tarjeta. Las consume el panel; van aquí para
# que front y back no tengan cada uno su copia.
ETIQUETAS = [
    {"tipo": '', "etiqueta": '', "label": 'Sin etiqueta'},
    {"tipo": 'nuevo', "etiqueta": 'Nuevo', "label": 'Nuevo (cian)'},
    {"tipo": 'top', "etiqueta": 'Top ventas', "label": 'Top ventas (amarillo)'},
]

PRODUCTOS_BASE = [
    {
        "slug": 'p-kitkat-matcha',
        "cat": 'japon',
        "emoji": '🍫',
        "nombre": 'Kit Kat Matcha',
        "origen": 'Japón',
        "desc": 'Chocolate blanco con té verde de Uji. El clásico que todos piden.',
        "precio": 89,
        "etiqueta": 'Top ventas',
        "tipo": 'top',
        "c1": '#8FD98A',
        "c2": '#D9F5C7',
    },
    {
        "slug": 'p-hichew',
        "cat": 'japon',
        "emoji": '🍡',
        "nombre": 'Hi-Chew Surtido',
        "origen": 'Japón',
        "desc": 'Caramelo masticable de fresa, uva y mango. Sabor intenso de verdad.',
        "precio": 65,
        "etiqueta": '',
        "tipo": '',
        "c1": '#FF8AC4',
        "c2": '#FFD6EA',
    },
    {
        "slug": 'p-pocky-fresa',
        "cat": 'japon',
        "emoji": '🍜',
        "nombre": 'Pocky Fresa',
        "origen": 'Japón',
        "desc": 'Palitos crujientes bañados en crema de fresa. Ideal para compartir.',
        "precio": 52,
        "etiqueta": '',
        "tipo": '',
        "c1": '#F42A8F',
        "c2": '#FFB8DC',
    },
    {
        "slug": 'p-peach-ring',
        "cat": 'corea',
        "emoji": '🍬',
        "nombre": 'Gomitas Peach Ring',
        "origen": 'Corea',
        "desc": 'Aros de durazno con azúcar ácida. Suaves, jugosas y adictivas.',
        "precio": 79,
        "etiqueta": 'Nuevo',
        "tipo": 'nuevo',
        "c1": '#FFB36B',
        "c2": '#FFE3C2',
    },
    {
        "slug": 'p-buldak',
        "cat": 'corea',
        "emoji": '🔥',
        "nombre": 'Ramen Picante Buldak',
        "origen": 'Corea',
        "desc": 'El reto viral de fideos extra picantes. Ten leche a la mano.',
        "precio": 75,
        "etiqueta": 'Top ventas',
        "tipo": 'top',
        "c1": '#FF6B6B',
        "c2": '#FFC9C9',
    },
    {
        "slug": 'p-honey-butter',
        "cat": 'corea',
        "emoji": '🍯',
        "nombre": 'Honey Butter Chips',
        "origen": 'Corea',
        "desc": 'Papas con miel y mantequilla. El snack dulce-salado más famoso.',
        "precio": 98,
        "etiqueta": '',
        "tipo": '',
        "c1": '#FFC93C',
        "c2": '#FFF0B8',
    },
    {
        "slug": 'p-reeses',
        "cat": 'usa',
        "emoji": '🥜',
        "nombre": 'Reese’s Big Cup',
        "origen": 'Estados Unidos',
        "desc": 'Chocolate con leche relleno de crema de cacahuate. Un clásico eterno.',
        "precio": 59,
        "etiqueta": '',
        "tipo": '',
        "c1": '#E08A3C',
        "c2": '#FFD9A8',
    },
    {
        "slug": 'p-nerds-clusters',
        "cat": 'usa',
        "emoji": '🌈',
        "nombre": 'Nerds Gummy Clusters',
        "origen": 'Estados Unidos',
        "desc": 'Gomita suave forrada de nerds crujientes. Textura brutal.',
        "precio": 139,
        "etiqueta": 'Top ventas',
        "tipo": 'top',
        "c1": '#A05CD6',
        "c2": '#E4CBF7',
    },
    {
        "slug": 'p-oreo-limitada',
        "cat": 'usa',
        "emoji": '🍪',
        "nombre": 'Oreo Edición Limitada',
        "origen": 'Estados Unidos',
        "desc": 'Sabores que solo salen unos meses al año. Pregunta por el del mes.',
        "precio": 115,
        "etiqueta": 'Nuevo',
        "tipo": 'nuevo',
        "c1": '#6E5A8C',
        "c2": '#D6CDE8',
    },
    {
        "slug": 'p-kinder-maxi',
        "cat": 'europa',
        "emoji": '🥚',
        "nombre": 'Kinder Sorpresa Maxi',
        "origen": 'Italia',
        "desc": 'Chocolate con leche y juguete coleccionable en versión grande.',
        "precio": 129,
        "etiqueta": '',
        "tipo": '',
        "c1": '#FF8A29',
        "c2": '#FFD8AE',
    },
    {
        "slug": 'p-haribo',
        "cat": 'europa',
        "emoji": '🐻',
        "nombre": 'Haribo Alemán Original',
        "origen": 'Alemania',
        "desc": 'Los ositos de oro de la receta europea. Se nota la diferencia.',
        "precio": 95,
        "etiqueta": '',
        "tipo": '',
        "c1": '#FFC93C',
        "c2": '#FFF2C4',
    },
    {
        "slug": 'p-toffifee',
        "cat": 'europa',
        "emoji": '🍮',
        "nombre": 'Toffifee Caja 15',
        "origen": 'Alemania',
        "desc": 'Caramelo, avellana, crema de nuez y chocolate en un solo bocado.',
        "precio": 149,
        "etiqueta": '',
        "tipo": '',
        "c1": '#C98A5E',
        "c2": '#F0DAC4',
    },
    {
        "slug": 'p-ramune',
        "cat": 'bebidas',
        "emoji": '🥤',
        "nombre": 'Ramune Original',
        "origen": 'Japón',
        "desc": 'La soda de la canica. Divertida de abrir y refrescante de tomar.',
        "precio": 69,
        "etiqueta": 'Top ventas',
        "tipo": 'top',
        "c1": '#29B6E8',
        "c2": '#BEEBFB',
    },
    {
        "slug": 'p-milkis-melon',
        "cat": 'bebidas',
        "emoji": '🧋',
        "nombre": 'Milkis Melón',
        "origen": 'Corea',
        "desc": 'Soda cremosa de yogurt con melón. Suave, burbujeante y distinta.',
        "precio": 55,
        "etiqueta": 'Nuevo',
        "tipo": 'nuevo',
        "c1": '#9FE08A',
        "c2": '#E2F7D4',
    },
    {
        "slug": 'p-fanta-mundo',
        "cat": 'bebidas',
        "emoji": '🍊',
        "nombre": 'Fanta Sabores del Mundo',
        "origen": 'Europa / Asia',
        "desc": 'Sabores que no existen en México: piña, sandía, manzana verde.',
        "precio": 62,
        "etiqueta": '',
        "tipo": '',
        "c1": '#FF6B35',
        "c2": '#FFD1BB',
    },
    {
        "slug": 'p-paleta-gigante',
        "cat": 'usa',
        "emoji": '🍭',
        "nombre": 'Paleta Gigante Arcoíris',
        "origen": 'Estados Unidos',
        "desc": 'La paleta espiral de 30 cm. Perfecta para fotos y para regalar.',
        "precio": 99,
        "etiqueta": '',
        "tipo": '',
        "c1": '#F42A8F',
        "c2": '#7FDBFF',
    },
]


def sembrar(db: Session, forzar: bool = False) -> tuple[int, int]:
    """
    Deja en la base las categorías y los productos de arriba.

    Devuelve (categorías nuevas, productos nuevos). Con `forzar` también
    reescribe los productos que ya existen con los valores de este archivo —es
    lo que hace `--sembrar --forzar`— y por eso NO es lo que corre en cada
    despliegue: te llevaría por delante los precios que cambiaste en el panel.
    """
    cats_nuevas = 0
    for datos in CATEGORIAS:
        cat = db.query(Categoria).filter(Categoria.slug == datos["slug"]).first()
        if cat is None:
            db.add(Categoria(**datos))
            cats_nuevas += 1
        elif forzar:
            cat.label = datos["label"]
            cat.orden = datos["orden"]

    prods_nuevos = 0
    # La tienda ordena por `orden` ASCENDENTE, así que el primero de esta lista
    # lleva el número más bajo y es el que sale primero. Los productos nuevos
    # que se den de alta desde el panel toman `mínimo - 1` y se colocan encima,
    # igual que hacía `lista.unshift(producto)` en el panel estático.
    for i, datos in enumerate(PRODUCTOS_BASE):
        prod = db.query(Producto).filter(Producto.slug == datos["slug"]).first()
        if prod is None:
            db.add(Producto(orden=i, **datos))
            prods_nuevos += 1
        elif forzar:
            for campo, valor in datos.items():
                setattr(prod, campo, valor)
            prod.orden = i

    db.commit()
    return cats_nuevas, prods_nuevos
