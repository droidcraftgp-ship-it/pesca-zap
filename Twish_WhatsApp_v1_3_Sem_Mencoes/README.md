# Twish WhatsApp v1.3 — sem menções

Atualize **somente** o `index.js` no repositório do serviço `pesca-zap`. Não altere o `pesca-l60f`, o Supabase ou as variáveis de ambiente.

- `/notify` envia o anúncio ao grupo sem `mentions` e sem `@` de participantes.
- `/test-send` continua enviando uma mensagem sem menções.
- `/test-mentions` retorna HTTP 410 e não envia nada.
- O botão de menções foi retirado do painel `/admin`.
- `/health`, `/qr`, `/groups` e autenticação permanecem.

Após o deploy, confira `/health` e teste um envio sem menções.
