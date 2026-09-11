/* Uso sin cobertura.
   - Teselas e imagenes: primero cache (rapido y offline), y si no estan, red.
   - Resto (html, js, json, geojson): primero red, y si no hay, lo guardado.
     Asi el mapa se actualiza solo cuando hay cobertura y nunca se queda "pillado"
     en una version vieja. */
var CACHE = 'cerezo-lidar-v3';

self.addEventListener('install', function(){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(ks){
    return Promise.all(ks.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

function guarda(req, res){
  if (res && (res.ok || res.type === 'opaque')) {
    var copia = res.clone();
    caches.open(CACHE).then(function(c){ c.put(req, copia); }).catch(function(){});
  }
  return res;
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var propio = url.origin === self.location.origin;
  var esImagen = req.destination === 'image' || /\.(png|jpg|jpeg|webp)$/i.test(url.pathname)
                 || /tile|wms|arcgis|GetMap/i.test(url.href);

  if (esImagen) {                       // cache primero
    e.respondWith(caches.match(req).then(function(hit){
      return hit || fetch(req).then(function(r){ return guarda(req, r); })
                              .catch(function(){ return new Response('', {status:504}); });
    }));
    return;
  }

  if (propio || /unpkg\.com/.test(url.host)) {   // red primero, cache de respaldo
    e.respondWith(
      fetch(req).then(function(r){ return guarda(req, r); })
        .catch(function(){
          return caches.match(req, {ignoreSearch:true}).then(function(h){
            return h || caches.match('index.html') || new Response('', {status:504});
          });
        })
    );
  }
});
