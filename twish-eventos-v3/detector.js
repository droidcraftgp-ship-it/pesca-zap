'use strict';
const specialNames=['Cardume Passageiro','Coins em Dobro','Comprador do Porto','Concurso do Menor Peixe','Desconto na Loja','Garrafa ao Mar','Maré Turbo','Peso Pesado','Rede Coletiva','Sorte Rara','Venda Turbinada','XP em Dobro'];
const grandNames=['Invasão Pirata','Julgamento de Njord','Barco Misterioso','O Kraken','Caldeirada','Tempestade'];
const aliases=[...specialNames.map(name=>({name,category:'Evento especial',aliases:[name]})),...grandNames.map(name=>({name,category:'Grande evento',aliases:[name]}))];
const boatVariants=['Bergelmir','Jörmungandr','Rán','Thor','Ægir'];
const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/æ/gi,'ae').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const endPattern=/\b(terminou|encerrad[oa]|finalizad[oa]|acabou|resultado|vencedor(?:es)?|ganhou|recebeu|recompensa|concluid[oa]|restam|faltam|progresso|placar|pontuacao|classificacao|ranking|parabens|participantes|capturou|pescou)\b/i;
const startPattern=/\b(comecou|comeca|iniciou|inicia|comecando|iniciado|iniciada|surgiu|chegou|apareceu|esta ativo|esta ativa|esta acontecendo|vai comecar|evento especial|grande evento)\b/i;
function parseEvent(message){
 const original=String(message||'').trim();if(!original)return null;
 const text=normalize(original);if(endPattern.test(text))return null;
 const matches=[];
 for(const item of aliases){for(const alias of item.aliases){const key=normalize(alias);const i=(' '+text+' ').indexOf(' '+key+' ');if(i>=0)matches.push({...item,key,position:i});}}
 if(!matches.length)return null;
 matches.sort((a,b)=>b.key.length-a.key.length);const found=matches[0];
 const prefix=text.slice(0,found.position).trim();const suffix=text.slice(found.position+found.key.length).trim();
 // Conservative start evidence: explicit event prefix, name as a headline, or a clear start verb.
 const explicit=/\b(evento especial|grande evento|evento iniciado|evento comecou)\b/.test(prefix);
 const headline=prefix.length===0 && (original.includes('!') || original.includes(':'));
 const start=startPattern.test(text);
 if(!(explicit||headline||start))return null;
 // Avoid unqualified standalone names / incidental references.
 if(!explicit&&!start&&!headline)return null;
 const minutes=original.match(/\b(\d+)\s*minutos?\b/i);
 const variant=found.name==='Barco Misterioso'?boatVariants.find(v=>text.includes(normalize(v))):null;
 return {name:found.name,category:found.category,variant:variant||null,minutes:minutes?Number(minutes[1]):null,message:original};
}
module.exports={parseEvent,specialNames,grandNames,boatVariants,normalize};
