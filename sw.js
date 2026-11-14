const CACHE='opeladeiro-v40';
const CORE=['/','/index.html','/manifest.webmanifest','/config.js','/vendor/supabase.js','/icons/icon-192.png','/icons/icon-512.png','/icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Abre na hora com o que está guardado e atualiza por trás (sinal fraco na quadra não trava a abertura).
function fromCacheThenUpdate(e,key){
  const net=fetch(e.request).then(res=>{if(res&&res.ok){const c=res.clone();caches.open(CACHE).then(k=>k.put(key,c));}return res;});
  e.waitUntil(net.catch(()=>{}));
  return caches.match(key).then(m=>m||net.catch(()=>caches.match('/index.html')));
}
self.addEventListener('fetch',e=>{
  const r=e.request; if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin!==location.origin){
    if(u.host.endsWith('fonts.googleapis.com')||u.host.endsWith('fonts.gstatic.com'))
      e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const c=res.clone();caches.open(CACHE).then(k=>k.put(r,c));return res;})));
    return; // Supabase e outros: sempre direto pela rede
  }
  if(/^\/(download|termos|privacidade|sobre|excluir-conta)(\/|$)/.test(u.pathname)){e.respondWith(fetch(r).catch(()=>caches.match(r)));return;}
  // páginas do app (inclusive /convite/SP0001) usam o mesmo index
  const key=r.mode==='navigate'?'/index.html':r;
  e.respondWith(fromCacheThenUpdate(e,key));
});
self.addEventListener('push',e=>{
  let d={};try{d=e.data?e.data.json():{};}catch(_){}
  e.waitUntil(self.registration.showNotification(d.title||'Opeladeiro',{body:d.body||'',icon:'/icons/icon-192.png',badge:'/icons/monochrome-512.png',data:{url:d.url||'/'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l){if('focus' in c)return c.focus();}return clients.openWindow((e.notification.data&&e.notification.data.url)||'/');}));
});
