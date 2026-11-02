'use strict';
const WebSocket=require('ws');
const http=require('http');
const crypto=require('crypto');
const {parseEvent,specialNames,grandNames,normalize}=require('./detector');
const CHANNEL=(process.env.TWITCH_CHANNEL||'npz1n').replace(/^#/,'').toLowerCase();
const BOT=(process.env.TWISH_BOT_USERNAME||'twishgamebot').toLowerCase();
const WEBHOOK=process.env.DISCORD_WEBHOOK_URL;
const WA_URL=(process.env.WHATSAPP_SERVICE_URL||'').replace(/\/+$/,'');
const WA_SECRET=process.env.INTEGRATION_SECRET||'';
const PORT=Number(process.env.PORT||3000);
const recent=new Map();
let connected=false,joined=false,lastMessageAt=null,lastEvent=null,lastDiscordAt=null,lastWhatsAppAt=null,lastDiscordError=null,lastWhatsAppError=null,lastError=null;
function status(){return {status:connected&&joined?'connected':'reconnecting',channel:CHANNEL,joined,lastMessageAt,lastEvent,lastDiscordAt,lastWhatsAppAt,lastError,lastDiscordError,lastWhatsAppError,whatsAppEnabled:!!WA_URL,knownSpecial:specialNames.length,knownGrand:grandNames.length};}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function sendDiscord(event){
 const payload={username:'Twish Eventos',allowed_mentions:{parse:[]},embeds:[{title:`${event.category==='Grande evento'?'🏆':'🎣'} ${event.name}${event.variant?' — '+event.variant:''}`,description:`**${event.category} • [${CHANNEL}](https://twitch.tv/${CHANNEL})**\n\n${event.message}`.slice(0,4096),color:event.category==='Grande evento'?0xE67E22:0xFACC15,timestamp:new Date().toISOString(),footer:{text:'TwishGameBot • Twitch'}}]};
 for(let attempt=0;attempt<3;attempt++){
  const response=await fetch(WEBHOOK,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  if(response.ok){lastDiscordAt=new Date().toISOString();lastDiscordError=null;return;}
  if(response.status===429&&attempt<2){const data=await response.json().catch(()=>({}));await sleep(Math.min(10000,Math.max(1000,Number(data.retry_after||2)*1000)));continue;}
  throw Error('Discord HTTP '+response.status);
 }
}
async function sendWhatsApp(event,eventId){
 if(!WA_URL)return;
 const body={eventId,eventName:event.name+(event.variant?' — '+event.variant:''),category:event.category,originalMessage:event.message};
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(WA_URL+'/notify',{method:'POST',headers:{'Content-Type':'application/json','x-integration-secret':WA_SECRET},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
   if(response.ok){lastWhatsAppAt=new Date().toISOString();lastWhatsAppError=null;return;}
   // Do not retry ambiguous application errors, to reduce repeated @mentions.
   if(response.status===503&&attempt<2){await sleep(3000*(attempt+1));continue;}
   throw Error('WhatsApp HTTP '+response.status);
  }catch(e){if(attempt===2||e.name==='TimeoutError')throw e;await sleep(2000*(attempt+1));}
 }
}
async function notify(event){
 const eventId=crypto.createHash('sha256').update(CHANNEL+'|'+normalize(event.message)).digest('hex');
 lastEvent={name:event.name,variant:event.variant,at:new Date().toISOString()};
 const results=await Promise.allSettled([sendDiscord(event),sendWhatsApp(event,eventId)]);
 if(results[0].status==='rejected'){lastDiscordError=results[0].reason.message;console.error('Falha Discord:',lastDiscordError);}
 if(results[1].status==='rejected'){lastWhatsAppError=results[1].reason.message;console.error('Falha WhatsApp:',lastWhatsAppError);}
 lastError=lastDiscordError||lastWhatsAppError;
 console.log('Evento processado:',event.name,'Discord:',results[0].status,'WhatsApp:',WA_URL?results[1].status:'desativado');
}
function connect(){
 const ws=new WebSocket('wss://irc-ws.chat.twitch.tv:443');
 ws.on('open',()=>{connected=true;joined=false;ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');ws.send('PASS SCHMOOPIIE');ws.send('NICK justinfan'+Math.floor(Math.random()*999999));ws.send('JOIN #'+CHANNEL);console.log('Twitch socket conectado');});
 ws.on('message',raw=>{for(const line of raw.toString().split('\r\n')){
  if(line.startsWith('PING')){ws.send(line.replace(/^PING/,'PONG'));continue;}
  if(line.includes(' JOIN #'+CHANNEL))joined=true;
  const m=line.match(/^(?:@([^ ]+) )?:([^! ]+)![^ ]+ PRIVMSG #([^ ]+) :(.+)$/);
  if(!m||m[2].toLowerCase()!==BOT||m[3].toLowerCase()!==CHANNEL)continue;
  lastMessageAt=new Date().toISOString();const event=parseEvent(m[4]);if(!event)continue;
  const now=Date.now();for(const [k,v] of recent)if(now-v>600000)recent.delete(k);
  const key=normalize(event.message);if(recent.has(key))continue;
  recent.set(key,now);notify(event).catch(e=>{lastError=e.message;console.error('Erro no processamento:',e.message);});
 }});
 ws.on('error',e=>{lastError=e.message;console.error('Twitch:',e.message);});
 ws.on('close',()=>{connected=false;joined=false;setTimeout(connect,5000);});
}
http.createServer((req,res)=>{if(!['/','/health'].includes((req.url||'').split('?')[0])){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(status()));}).listen(PORT,'0.0.0.0');
if(!WEBHOOK||!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/[^/]+\/[^/]+/.test(WEBHOOK)){console.error('Configure DISCORD_WEBHOOK_URL no Render');process.exit(1);}
if(WA_URL&&(!/^https:\/\/[a-z0-9.-]+$/i.test(WA_URL)||WA_SECRET.length<24)){console.error('Configure WHATSAPP_SERVICE_URL e INTEGRATION_SECRET válidos');process.exit(1);}
connect();
