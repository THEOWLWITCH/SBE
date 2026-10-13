// Local static frontend + proxy to the existing, real BE GOOD Node server.
// No substitute model, auth or database. Configure that server as documented.
import { createServer, request } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
const args=process.argv.slice(2);
const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:Number(args[i+1]);};
const port=option('--port',8791),apiPort=option('--api-port',8790);
const app=fileURLToPath(new URL('../app/',import.meta.url));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')||req.url==='/health'){
    const proxy=request({host:'127.0.0.1',port:apiPort,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:'+apiPort}},upstream=>{
      res.writeHead(upstream.statusCode,upstream.headers);upstream.pipe(res);
    });
    proxy.on('error',()=>{if(!res.headersSent)res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({code:'unavailable',error:'השרת המקומי אינו זמין. אפשר להפעיל את שרת BE GOOD ולנסות שוב.'}));});
    req.pipe(proxy);return;
  }
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const path=resolve(app,'.'+(pathname==='/'?'/entry.html':pathname));
    if(!path.startsWith(app)){res.writeHead(403);return res.end();}
    let bytes=await readFile(path);const type=extname(path);
    // Existing entry and gateway clients keep their normal auth workflow on
    // localhost. Only the locally served bytes change, never deployed source.
    if(type==='.html'||type==='.js')bytes=Buffer.from(bytes.toString('utf8').replaceAll('https://sbe-server.onrender.com','http://127.0.0.1:'+port));
    res.writeHead(200,{'content-type':mime[type]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log('BE GOOD local frontend: http://127.0.0.1:'+port+'/entry.html (real API on '+apiPort+')'));
