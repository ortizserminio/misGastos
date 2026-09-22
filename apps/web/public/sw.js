const CACHE='misgastos-v1';
const PRECACHE=['/','/icon.svg','/manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('misgastos-')&&key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api'))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try {
   const response=await fetch(event.request);
   if(response.ok){const copy=response.clone();event.waitUntil(cache.put(event.request,copy).catch(()=>{}));}
   return response;
  } catch {
   return await cache.match(event.request)||(event.request.mode==='navigate'?await cache.match('/'):undefined)||Response.error();
  }
 })());
});
