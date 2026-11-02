# Twish Eventos v3.1 — Discord + WhatsApp

Atualização do serviço **pesca-l60f**, preservando o detector da v3.0 e o Discord.

## Variáveis no Render (serviço pesca-l60f)

- `DISCORD_WEBHOOK_URL`: manter a existente.
- `WHATSAPP_SERVICE_URL`: `https://pesca-zap.onrender.com` (sem `/notify`).
- `INTEGRATION_SECRET`: **exatamente a mesma chave** do serviço `pesca-zap`.
- `TWITCH_CHANNEL`: opcional, padrão `npz1n`.

**Não altere o `pesca-zap` nem o Supabase.** A rota `POST /notify` já está na v1.2 do WhatsApp.

## Atualização

Substitua os arquivos do repositório de `pesca-l60f` pelos arquivos deste pacote e execute o deploy. Configure as duas variáveis novas no serviço Twitch. Depois, abra `https://pesca-l60f.onrender.com/health` e confira `whatsAppEnabled: true`. O envio real só acontece quando o TwishGameBot anuncia um evento reconhecido.

O Discord e o WhatsApp são tentados independentemente. Os erros de cada destino aparecem em `/health`. O código não envia mensagens de teste automaticamente.

## Limitações

- A instância gratuita do Render pode hibernar; isso pode interromper a sessão WhatsApp.
- A deduplicação é mantida em memória e não persiste após reinício. O serviço WhatsApp também possui deduplicação em memória por 2 minutos.
- Falhas de rede após um envio bem-sucedido podem tornar incerto se o WhatsApp recebeu a mensagem; por isso, evite repetição automática agressiva.
- O bot usa Baileys, integração não oficial com WhatsApp.
