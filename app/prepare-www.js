// Copia só o que o app precisa para a pasta www/ (usada pelo Capacitor).
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),out=path.join(root,'www');
const items=['index.html','sw.js','config.js','manifest.webmanifest','icons','vendor'];
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const i of items)fs.cpSync(path.join(root,i),path.join(out,i),{recursive:true});
console.log('www/ pronto');
