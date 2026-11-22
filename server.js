'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const PORT=Number(process.env.PORT||3000);
const DB_PATH=process.env.DB_PATH||path.join(__dirname,'data','orders.sqlite');
const ADMIN_KEY=process.env.ADMIN_KEY;
if(!ADMIN_KEY || ADMIN_KEY.length<24){console.error('Set ADMIN_KEY to a random secret of at least 24 characters.');process.exit(1)}
fs.mkdirSync(path.dirname(DB_PATH),{recursive:true});
const db=new DatabaseSync(DB_PATH);
db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS orders (token TEXT PRIMARY KEY, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Eingegangen', created TEXT NOT NULL, updated TEXT NOT NULL); CREATE INDEX IF NOT EXISTS orders_created ON orders(created DESC);`);
const insert=db.prepare('INSERT INTO orders(token,payload,status,created,updated) VALUES(?,?,?,?,?)');
const get=db.prepare('SELECT * FROM orders WHERE token=?');
const list=db.prepare('SELECT * FROM orders ORDER BY created DESC LIMIT 250');
const change=db.prepare('UPDATE orders SET status=?,updated=? WHERE token=? AND status=?');
const allowedOrigin=process.env.FRONTEND_ORIGIN||'';
function send(res,status,data,origin){const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(origin&&allowedOrigin&&origin===allowedOrigin){headers['Access-Control-Allow-Origin']=origin;headers['Vary']='Origin';headers['Access-Control-Allow-Headers']='Content-Type, X-Admin-Key';headers['Access-Control-Allow-Methods']='GET, POST, PATCH, OPTIONS'}res.writeHead(status,headers);res.end(JSON.stringify(data))}
function authorized(req){const key=req.headers['x-admin-key']||'';return typeof key==='string'&&key.length===ADMIN_KEY.length&&crypto.timingSafeEqual(Buffer.from(key),Buffer.from(ADMIN_KEY))}
function orderView(row){return {...JSON.parse(row.payload),status:row.status,created:row.created}}
function readBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',chunk=>{raw+=chunk;if(raw.length>30000){reject(new Error('Request too large'));req.destroy()}});req.on('end',()=>{try{resolve(JSON.parse(raw))}catch{reject(new Error('Invalid JSON'))}});req.on('error',reject)})}
function validTime(o){if(o.mode!=='Abholung')return true;if(!o.time||o.time==='ASAP')return true;if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(o.time))return false;const d=new Date(o.time+':00+01:00');if(Number.isNaN(d.getTime()))return false;const day=new Date(o.time.slice(0,10)+'T12:00:00Z').getUTCDay();const minutes=Number(o.time.slice(11,13))*60+Number(o.time.slice(14,16));return day!==1&&minutes>=(day===0?720:660)&&minutes<=1275&&d.getTime()>Date.now()-3600000}
function validate(o){if(!o||typeof o!=='object')return 'Ungültige Bestellung';if(!['Lieferung','Abholung'].includes(o.mode))return 'Bestellart ungültig';if(typeof o.name!=='string'||o.name.trim().length<2||o.name.length>120)return 'Name ungültig';if(typeof o.phone!=='string'||!/^\+?[0-9\s()/-]{6,30}$/.test(o.phone))return 'Telefon ungültig';if(!Array.isArray(o.items)||!o.items.length||o.items.length>60)return 'Warenkorb ungültig';if(o.items.some(i=>!i||typeof i.name!=='string'||i.name.length>200||!Number.isInteger(i.qty)||i.qty<1||i.qty>50||!Number.isFinite(i.price)||i.price<0||i.price>500))return 'Artikel ungültig';if(o.mode==='Lieferung'&&(!o.address||o.address.length>400))return 'Adresse fehlt';if(o.payment!=='Bargeld')return 'Online-Zahlung noch nicht verfügbar';if(!validTime(o))return 'Abholzeit ungültig';return null}
const server=http.createServer(async(req,res)=>{const origin=req.headers.origin||'';if(origin&&allowedOrigin&&origin!==allowedOrigin)return send(res,403,{error:'Origin not allowed'});if(req.method==='OPTIONS')return send(res,204,{},origin);const url=new URL(req.url,'http://localhost');try{
if(url.pathname==='/api/health'&&req.method==='GET')return send(res,200,{ok:true,storage:'sqlite'},origin);
if(url.pathname==='/api/orders'&&req.method==='POST'){
 const o=await readBody(req),err=validate(o);if(err)return send(res,400,{error:err},origin);
 const subtotal=Math.round(o.items.reduce((sum,i)=>sum+i.price*i.qty,0)*100)/100;
 if(Math.abs(subtotal-Number(o.subtotal))>0.02)return send(res,400,{error:'Zwischensumme stimmt nicht'},origin);
 const fee=o.mode==='Abholung'?0:Number(o.fee);if(!Number.isFinite(fee)||fee<0||fee>50)return send(res,400,{error:'Lieferkosten ungültig'},origin);
 const now=new Date().toISOString(),token='AM-'+crypto.randomBytes(10).toString('hex').toUpperCase();
 const clean={token,name:o.name.trim(),phone:o.phone,mode:o.mode,address:o.mode==='Lieferung'?o.address:'',items:o.items.map(i=>({name:i.name,option:String(i.option||''),note:String(i.note||''),price:i.price,qty:i.qty})),subtotal,fee,total:Math.round((subtotal+fee)*100)/100,payment:'Bargeld',paymentStatus:'Noch nicht bezahlt',time:o.time||'',eta:'',created:now};
 insert.run(token,JSON.stringify(clean),'Eingegangen',now,now);return send(res,201,{order:{...clean,status:'Eingegangen'}},origin)
}
if(url.pathname==='/api/orders'&&req.method==='GET'){if(!authorized(req))return send(res,401,{error:'Unauthorized'},origin);return send(res,200,{orders:list.all().map(orderView)},origin)}
const statusMatch=url.pathname.match(/^\/api\/orders\/(AM-[A-F0-9]{20})\/status$/);
if(statusMatch&&req.method==='PATCH'){if(!authorized(req))return send(res,401,{error:'Unauthorized'},origin);const body=await readBody(req);if(!['Bestätigt','Abgelehnt'].includes(body.status))return send(res,400,{error:'Status ungültig'},origin);const r=change.run(body.status,new Date().toISOString(),statusMatch[1],'Eingegangen');if(!r.changes)return send(res,409,{error:'Bestellung bereits bearbeitet oder unbekannt'},origin);return send(res,200,{order:orderView(get.get(statusMatch[1]))},origin)}
const tracking=url.pathname.match(/^\/api\/track\/(AM-[A-F0-9]{20})$/);
if(tracking&&req.method==='GET'){const row=get.get(tracking[1]);if(!row)return send(res,404,{error:'Nicht gefunden'},origin);const o=orderView(row);return send(res,200,{order:{token:o.token,status:o.status,mode:o.mode,created:o.created,time:o.time,eta:o.eta}},origin)}
if(req.method==='GET'&&['/','/index.html','/logo1.png','/config.js'].includes(url.pathname)){
 const file=path.join(__dirname,url.pathname==='/'?'index.html':url.pathname.slice(1));res.writeHead(200,{'Content-Type':file.endsWith('.png')?'image/png':file.endsWith('.js')?'application/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return fs.createReadStream(file).pipe(res)
}
return send(res,404,{error:'Not found'},origin)
}catch(e){console.error(e);if(!res.headersSent)send(res,500,{error:'Server error'},origin)}});
server.listen(PORT,'0.0.0.0',()=>console.log(`ASIA MAI listening on ${PORT}; DB ${DB_PATH}`));
