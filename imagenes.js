/* =========================================================
   Candylandia Store — imágenes de productos

   Un producto puede mostrarse con un emoji (lo de siempre) o
   con una foto. Cuando tiene foto, el campo `img` guarda una
   ruta relativa dentro del proyecto, por ejemplo:

       assets/productos/kit-kat-matcha-a1b2.webp

   ¿Cómo llega el archivo a esa carpeta?
   · Chrome y Edge: con la File System Access API. Eliges UNA VEZ
     la carpeta del proyecto, das permiso y el panel escribe el
     archivo ahí de verdad. El permiso se recuerda (IndexedDB).
   · Otros navegadores (Firefox, Safari): el archivo se descarga
     y tú lo colocas en assets/productos/ a mano.

   Como el archivo puede tardar en llegar a su sitio (o no llegar,
   si estás en la versión publicada), guardamos además una copia
   reducida en localStorage: si la ruta no carga, la tarjeta usa
   esa copia como respaldo y nunca se ve rota.
   ========================================================= */

const CandyImg = (function(){

  const CARPETA   = 'assets/productos';  // dentro del proyecto
  const KEY       = 'candylandia_imagenes_v1';
  const LADO_MAX  = 560;                 // px del lado más largo
  const CALIDAD   = .82;
  const PESO_MAX  = 8 * 1024 * 1024;     // 8 MB del archivo original

  /* ---------------------------------------------------------
     1. Respaldos en localStorage  { ruta: dataURL }
     --------------------------------------------------------- */
  function leerRespaldos(){
    try{
      const raw = localStorage.getItem(KEY);
      const obj = raw ? JSON.parse(raw) : null;
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(err){
      return {};
    }
  }

  function escribirRespaldos(obj){
    try{
      localStorage.setItem(KEY, JSON.stringify(obj));
      return true;
    }catch(err){
      return false; // sin espacio o modo privado
    }
  }

  /* ---------------------------------------------------------
     2. Comprimir la imagen que eligió el usuario
     Reduce el lado más largo a LADO_MAX y la convierte a WebP,
     así una foto de 4 MB termina pesando unos 40 KB.
     --------------------------------------------------------- */
  function comprimir(file){
    return new Promise((resolve, reject) => {
      if(!file || !file.type.startsWith('image/')){
        reject(new Error('El archivo no es una imagen.'));
        return;
      }
      if(file.size > PESO_MAX){
        reject(new Error('La imagen pesa más de 8 MB. Usa una más ligera.'));
        return;
      }

      const url = URL.createObjectURL(file);
      const img = new Image();

      img.onload = () => {
        const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
        const lienzo = document.createElement('canvas');
        lienzo.width  = Math.max(1, Math.round(img.width  * escala));
        lienzo.height = Math.max(1, Math.round(img.height * escala));
        lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
        URL.revokeObjectURL(url);

        lienzo.toBlob(blob => {
          /* Si el navegador no sabe hacer WebP, probamos con JPEG */
          if(!blob){
            lienzo.toBlob(b2 => {
              if(!b2){ reject(new Error('No se pudo procesar la imagen.')); return; }
              aDataURL(b2, 'jpg', resolve, reject);
            }, 'image/jpeg', CALIDAD);
            return;
          }
          const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
          aDataURL(blob, ext, resolve, reject);
        }, 'image/webp', CALIDAD);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo leer la imagen.'));
      };

      img.src = url;
    });
  }

  function aDataURL(blob, ext, resolve, reject){
    const lector = new FileReader();
    lector.onload  = () => resolve({ blob, ext, dataURL: lector.result, peso: blob.size });
    lector.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    lector.readAsDataURL(blob);
  }

  /* ---------------------------------------------------------
     3. Recordar la carpeta del proyecto (IndexedDB)
     Los handles de carpeta no se pueden guardar en localStorage,
     por eso usamos IndexedDB con un almacén mínimo.
     --------------------------------------------------------- */
  const IDB_NOMBRE = 'candylandia_admin';
  const IDB_STORE  = 'handles';
  const IDB_LLAVE  = 'carpetaProyecto';

  function abrirIDB(){
    return new Promise((resolve, reject) => {
      if(!window.indexedDB){ reject(new Error('Sin IndexedDB')); return; }
      const req = indexedDB.open(IDB_NOMBRE, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function idbGuardar(valor){
    try{
      const db = await abrirIDB();
      await new Promise((res, rej) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(valor, IDB_LLAVE);
        tx.oncomplete = res;
        tx.onerror    = () => rej(tx.error);
      });
      db.close();
    }catch(err){ /* si falla, solo pedirá la carpeta otra vez */ }
  }

  async function idbLeer(){
    try{
      const db = await abrirIDB();
      const valor = await new Promise((res, rej) => {
        const tx  = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get(IDB_LLAVE);
        req.onsuccess = () => res(req.result || null);
        req.onerror   = () => rej(req.error);
      });
      db.close();
      return valor;
    }catch(err){
      return null;
    }
  }

  async function idbBorrar(){
    try{
      const db = await abrirIDB();
      await new Promise(res => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(IDB_LLAVE);
        tx.oncomplete = res;
        tx.onerror    = res;
      });
      db.close();
    }catch(err){ /* nada */ }
  }

  /* ---------------------------------------------------------
     4. Escribir el archivo en la carpeta del proyecto
     --------------------------------------------------------- */
  const soportaCarpeta = () => typeof window.showDirectoryPicker === 'function';

  async function permiso(handle, pedir){
    if(!handle || !handle.queryPermission) return false;
    const opciones = { mode:'readwrite' };
    if(await handle.queryPermission(opciones) === 'granted') return true;
    if(!pedir) return false;
    return await handle.requestPermission(opciones) === 'granted';
  }

  /* Abre el selector para que el usuario elija la carpeta del proyecto */
  async function elegirCarpeta(){
    if(!soportaCarpeta()) throw new Error('Tu navegador no permite escribir en carpetas.');
    const handle = await window.showDirectoryPicker({ id:'candylandia', mode:'readwrite' });
    if(!await permiso(handle, true)) throw new Error('No diste permiso de escritura.');
    await idbGuardar(handle);
    return handle;
  }

  /* Devuelve el handle guardado si sigue teniendo permiso, o null */
  async function carpetaGuardada(pedirPermiso){
    const handle = await idbLeer();
    if(!handle) return null;
    return await permiso(handle, !!pedirPermiso) ? handle : null;
  }

  async function olvidarCarpeta(){
    await idbBorrar();
  }

  /* Crea (si hace falta) assets/productos y escribe ahí el archivo */
  async function escribirEnCarpeta(handle, nombre, blob){
    let dir = handle;
    for(const parte of CARPETA.split('/')){
      dir = await dir.getDirectoryHandle(parte, { create:true });
    }
    const archivo  = await dir.getFileHandle(nombre, { create:true });
    const escritor = await archivo.createWritable();
    await escritor.write(blob);
    await escritor.close();
  }

  /* Último recurso: descargar el archivo a la carpeta de Descargas */
  function descargar(nombre, blob){
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ---------------------------------------------------------
     5. API pública
     --------------------------------------------------------- */
  return {
    carpeta: CARPETA,
    soportaCarpeta,
    comprimir,
    elegirCarpeta,
    carpetaGuardada,
    olvidarCarpeta,

    /* Ruta relativa que se guarda en el producto */
    ruta(nombreArchivo){
      return CARPETA + '/' + nombreArchivo;
    },

    /* Guarda el archivo. Devuelve 'carpeta' o 'descarga' según
       cómo se haya podido guardar. */
    async guardarArchivo(nombreArchivo, blob){
      if(soportaCarpeta()){
        try{
          const handle = await carpetaGuardada(true) || await elegirCarpeta();
          await escribirEnCarpeta(handle, nombreArchivo, blob);
          return 'carpeta';
        }catch(err){
          /* Canceló el selector, negó el permiso o no se pudo escribir
             (pasa al abrir el sitio con file://). Descargamos el archivo. */
        }
      }
      descargar(nombreArchivo, blob);
      return 'descarga';
    },

    /* --- respaldos --- */
    respaldo(ruta){
      return leerRespaldos()[ruta] || '';
    },
    guardarRespaldo(ruta, dataURL){
      const obj = leerRespaldos();
      obj[ruta] = dataURL;
      return escribirRespaldos(obj);
    },
    quitarRespaldo(ruta){
      const obj = leerRespaldos();
      if(!(ruta in obj)) return;
      delete obj[ruta];
      escribirRespaldos(obj);
    },
    /* Borra los respaldos de imágenes que ya no usa ningún producto */
    limpiarRespaldos(rutasVivas){
      const obj = leerRespaldos();
      let cambio = false;
      Object.keys(obj).forEach(ruta => {
        if(!rutasVivas.includes(ruta)){ delete obj[ruta]; cambio = true; }
      });
      if(cambio) escribirRespaldos(obj);
    },

    /* Si la ruta del archivo no carga, la tarjeta usa el respaldo.
       Se llama después de pintar las tarjetas. */
    aplicarRespaldos(contenedor){
      const raiz = contenedor || document;
      raiz.querySelectorAll('img.card-img:not([data-respaldo-listo])').forEach(img => {
        img.dataset.respaldoListo = '1';
        img.addEventListener('error', function(){
          const copia = CandyImg.respaldo(this.dataset.ruta || '');
          if(copia && this.src !== copia){
            this.src = copia;
            return;
          }
          /* Sin archivo y sin respaldo: volvemos al emoji del producto */
          const media = this.closest('.card-media');
          if(media && this.dataset.emoji){
            this.replaceWith(Object.assign(document.createElement('span'), {
              className: 'emoji',
              textContent: this.dataset.emoji
            }));
          }
        }, { once:false });
      });
    },

    /* HTML del interior de .card-media: imagen si hay, si no el emoji */
    mediaHTML(p, esc){
      if(!p.img) return `<span class="emoji">${esc(p.emoji)}</span>`;
      return `<img class="card-img" src="${esc(p.img)}" alt="${esc(p.nombre)}"
        data-ruta="${esc(p.img)}" data-emoji="${esc(p.emoji)}" loading="lazy">`;
    }
  };
})();
