'use strict';
const assert=require('node:assert/strict');const {parseEvent,specialNames,grandNames}=require('./detector');
const yes=['Evento especial: Peso Pesado! Durante 10 minutos','🐟 Cardume Passageiro! Pesque agora','🏴‍☠️ Invasão Pirata! Pesque um peixe mítico','O Kraken surgiu!','Evento especial: XP em Dobro!','🚢 Barco Misterioso! Thor chegou!','Grande evento: Caldeirada começou!','Tempestade! O evento começou'];
const no=['O evento Peso Pesado terminou!','Jogador ganhou 500 coins','Resultado da Invasão Pirata: vencedor','Ranking da Tempestade','Você pescou no Cardume Passageiro','O Kraken recebeu recompensas','Concurso do Menor Peixe','O evento Rede Coletiva acabou!'];
for(const s of yes)assert.ok(parseEvent(s),`Deveria reconhecer: ${s}`);
for(const s of no)assert.equal(parseEvent(s),null,`Deveria ignorar: ${s}`);
assert.equal(parseEvent('Barco Misterioso! Thor chegou!').variant,'Thor');
assert.equal(specialNames.length,12);assert.equal(grandNames.length,6);
console.log(`${yes.length+no.length+3} testes passaram`);
