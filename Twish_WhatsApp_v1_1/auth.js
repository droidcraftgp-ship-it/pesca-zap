import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';
const sessionId = process.env.WA_SESSION_ID || 'main';
const key = Buffer.from(process.env.WA_SESSION_ENCRYPTION_KEY || '', 'hex');
if (key.length !== 32) throw new Error('WA_SESSION_ENCRYPTION_KEY deve ter 64 caracteres hexadecimais');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false}});
function encrypt(value) { const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',key,iv); const data=Buffer.concat([cipher.update(JSON.stringify(value,BufferJSON.replacer),'utf8'),cipher.final()]); return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64'); }
function decrypt(payload) { const raw=Buffer.from(payload,'base64');const decipher=crypto.createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString(),BufferJSON.reviver); }
async function read(id) {const {data,error}=await db.from('twish_wa_auth').select('payload').eq('session_id',sessionId).eq('key_id',id).maybeSingle();if(error)throw error;return data?decrypt(data.payload):null;}
async function write(id,value){const {error}=await db.from('twish_wa_auth').upsert({session_id:sessionId,key_id:id,payload:encrypt(value),updated_at:new Date().toISOString()});if(error)throw error;}
async function remove(id){const {error}=await db.from('twish_wa_auth').delete().eq('session_id',sessionId).eq('key_id',id);if(error)throw error;}
export async function useSupabaseAuthState(){const creds=await read('creds')||initAuthCreds();return {state:{creds,keys:{get:async(type,ids)=>{const out={};for(const id of ids){let v=await read(`${type}-${id}`);if(type==='app-state-sync-key'&&v)v=proto.Message.AppStateSyncKeyData.fromObject(v);out[id]=v;}return out;},set:async(data)=>{for(const [type,entries] of Object.entries(data)){for(const [id,value] of Object.entries(entries)){if(value)await write(`${type}-${id}`,value);else await remove(`${type}-${id}`);}}}}},saveCreds:()=>write('creds',creds)};}
