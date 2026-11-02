import express from 'express';
import crypto from 'node:crypto';
import pino from 'pino';
import QRCode from 'qrcode';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { useSupabaseAuthState } from './auth.js';
const app=express();app.use(express.json({limit:'24kb'}));
const secret=process.env.INTEGRATION_SECRET;
if(!secret||secret.length<24)throw new Error('INTEGRATION_SECRET precisa ser uma chave aleatória com pelo menos 24 caracteres');
const groupId=process.env.WA_GROUP_ID||'';
let sock,qr=null,connected=false,lastSent=null,lastError=null,connecting=false;
let lastTestAt=null,lastTestKind=null,lastMentionCount=0;
const seen=new Map();
const timingSafe=(a,b)=>{const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&crypto.timingSafeEqual(x,y);};
const auth=(req,res,next)=>timingSafe(req.get('x-integration-secret'),secret)?next():res.sendStatus(401);
const safeText=s=>String(s||'').replace(/[\u0000-\u001f]/g,' ').slice(0,3000);
async function connect(){if(connecting)return;connecting=true;try{const {state,saveCreds}=await useSupabaseAuthState();const {version}=await fetchLatestBaileysVersion();sock=makeWASocket({auth:state,version,logger:pino({level:'silent'}),printQRInTerminal:false,markOnlineOnConnect:false,syncFullHistory:false});sock.ev.on('creds.update',()=>saveCreds().catch(e=>lastError=e.message));sock.ev.on('connection.update',({connection,lastDisconnect,qr:nextQR})=>{if(nextQR)qr=nextQR;if(connection==='open'){connected=true;qr=null;lastError=null;}if(connection==='close'){connected=false;const code=lastDisconnect?.error?.output?.statusCode;if(code===DisconnectReason.loggedOut){lastError='Sessão desconectada; vincule novamente';qr=null;}else setTimeout(()=>connect().catch(e=>lastError=e.message),5000);}});}catch(e){lastError=e.message;setTimeout(()=>connect().catch(()=>{}),10000);}finally{connecting=false;}}
app.get('/health',(req,res)=>res.json({status:connected?'connected':'disconnected',whatsappConnected:connected,groupConfigured:!!groupId,lastSent,lastError,lastTestAt,lastTestKind,lastMentionCount}));
app.get('/admin',(req,res)=>res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Twish WhatsApp — Administração</title><style>body{font:16px system-ui;background:#101714;color:#f4f7f5;max-width:680px;margin:40px auto;padding:0 18px}input,button{font:inherit;padding:12px;border-radius:8px}input{background:#1b2621;color:white;border:1px solid #52665b;width:95%}button{background:#24b86d;color:#07150d;border:0;cursor:pointer;margin:12px 8px 12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1b2621;padding:14px;border-radius:8px}img{max-width:100%;background:white;padding:12px;border-radius:8px}small{color:#b5c6bd}</style></head><body><h1>Twish WhatsApp</h1><p>Insira sua chave INTEGRATION_SECRET para consultar a vinculação. Ela permanece apenas nesta aba, em memória.</p><input id="key" type="password" autocomplete="off" placeholder="INTEGRATION_SECRET"><div><button id="qr">Mostrar QR Code</button><button id="groups">Listar grupos</button><button id="status">Atualizar status</button><button id="test">Testar envio (sem menções)</button><button id="mention">Testar menções (todos)</button></div><p id="message" role="status"></p><div id="result"></div><small>Para vincular: WhatsApp no celular → Dispositivos conectados → Conectar dispositivo. O QR expira; atualize se necessário. Para selecionar o grupo, copie o ID exibido e configure WA_GROUP_ID no Render.</small><script>
const key=document.getElementById('key'),result=document.getElementById('result'),message=document.getElementById('message');
async function request(path,method="GET"){result.replaceChildren();message.textContent='Consultando...';try{const r=await fetch(path,{method,headers:{'x-integration-secret':key.value},cache:'no-store'});const t=await r.text();if(!r.ok){message.textContent='HTTP '+r.status+': '+t;return;}message.textContent='';if(path==='/qr'){const doc=new DOMParser().parseFromString(t,'text/html');const img=doc.querySelector('img');if(img){const el=document.createElement('img');el.src=img.src;el.alt='QR Code para vincular o WhatsApp';result.append(el);}else result.textContent=doc.body.textContent;}else{const pre=document.createElement('pre');try{pre.textContent=JSON.stringify(JSON.parse(t),null,2)}catch{pre.textContent=t}result.append(pre)}}catch(e){message.textContent=e.message;}}
document.getElementById('qr').onclick=()=>request('/qr');document.getElementById('groups').onclick=()=>request('/groups');document.getElementById('status').onclick=()=>request('/health');document.getElementById('test').onclick=()=>{if(confirm('Enviar UMA mensagem de teste ao grupo, sem menções?'))request('/test-send','POST')};document.getElementById('mention').onclick=()=>{if(confirm('ATENÇÃO: mencionar TODOS os participantes do grupo em uma mensagem de teste?'))request('/test-mentions','POST')};
</script></body></html>`));

app.get('/qr',auth,async(req,res)=>{if(connected)return res.type('text').send('WhatsApp conectado.');if(!qr)return res.status(503).type('text').send('QR indisponível. Aguarde ou consulte /health.');res.type('html').send(`<html><body style="font-family:sans-serif;text-align:center"><h2>Vincular WhatsApp</h2><img alt="QR de vinculação" src="${await QRCode.toDataURL(qr)}"/><p>Escaneie no WhatsApp: Aparelhos conectados.</p></body></html>`);});
app.get('/groups',auth,async(req,res)=>{if(!connected)return res.status(503).json({error:'WhatsApp desconectado'});try{const groups=await sock.groupFetchAllParticipating();res.json(Object.values(groups).map(g=>({name:g.subject,id:g.id,participants:g.participants.length})));}catch(e){res.status(500).json({error:e.message});}});
// Testes manuais: nunca executados automaticamente. Intervalo mínimo de 60 s entre testes.
let lastTestRequest=0;
async function testSend(req,res,mentionAll){
  if(!connected||!sock)return res.status(503).json({error:'WhatsApp desconectado'});
  if(!groupId)return res.status(503).json({error:'WA_GROUP_ID não configurado'});
  if(Date.now()-lastTestRequest<60000)return res.status(429).json({error:'Aguarde 60 segundos entre testes'});
  lastTestRequest=Date.now();
  try{
    const group=await sock.groupMetadata(groupId);
    const members=mentionAll?[...new Set(group.participants.map(p=>p.id).filter(Boolean))]:[];
    const msg='🧪 *Twish WhatsApp — teste manual*\n'+(mentionAll?'Teste de menções aos participantes.':'Teste de envio sem menções.')+'\nNenhum evento foi iniciado por este teste.';
    // Menções reais são transportadas em mentions, não em @todos fictício.
    const mentionText=members.map((id,i)=>'@'+id.split('@')[0]).join(' ');
    await sock.sendMessage(groupId,{text:msg+(mentionText?'\n\n'+mentionText:''),...(members.length?{mentions:members}:{})});
    lastSent=new Date().toISOString();lastTestAt=lastSent;lastTestKind=mentionAll?'mentions':'plain';lastMentionCount=members.length;lastError=null;
    return res.json({ok:true,test:lastTestKind,mentioned:members.length,sentAt:lastSent});
  }catch(e){lastError=e.message;return res.status(500).json({error:'Falha no teste de envio',details:e.message});}
}
app.post('/test-send',auth,(req,res)=>testSend(req,res,false));
app.post('/test-mentions',auth,(req,res)=>testSend(req,res,true));
app.post('/notify',auth,async(req,res)=>{if(!connected)return res.status(503).json({error:'WhatsApp desconectado'});if(!groupId)return res.status(503).json({error:'WA_GROUP_ID não configurado'});const {eventId,eventName,category,originalMessage}=req.body||{};if(typeof eventName!=='string'||!eventName.trim()||typeof originalMessage!=='string'||!originalMessage.trim())return res.status(400).json({error:'eventName e originalMessage obrigatórios'});const id=safeText(eventId||`${eventName}:${originalMessage}`);if(seen.has(id)&&Date.now()-seen.get(id)<120000)return res.json({ok:true,duplicate:true});try{const group=await sock.groupMetadata(groupId);const members=[...new Set(group.participants.map(p=>p.id).filter(Boolean))];const tags=members.map((_,i)=>`@${i+1}`).join(' ');const text=`🎣 *TWISH — ${safeText(category||'Evento')}*\n*${safeText(eventName)}*\n\n${safeText(originalMessage)}\n\n🎮 twitch.tv/npz1n\n\n${tags}`;await sock.sendMessage(groupId,{text,mentions:members});seen.set(id,Date.now());lastSent=new Date().toISOString();res.json({ok:true,mentioned:members.length});}catch(e){lastError=e.message;res.status(500).json({error:'Falha ao enviar mensagem'});}});
app.get('/',(req,res)=>res.redirect('/health'));
const port=Number(process.env.PORT||3000);app.listen(port,'0.0.0.0',()=>{console.log(`Twish WhatsApp escutando porta ${port}`);connect();});
