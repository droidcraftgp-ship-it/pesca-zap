# Twish WhatsApp — serviço separado

Projeto inicial para Render (Node.js 20+), WhatsApp via Baileys e sessão criptografada no Supabase. **Integração não oficial**: pode desconectar e sofrer restrições do WhatsApp. Não usar para mensagens sem consentimento dos participantes.

## Instalação

1. Suba estes arquivos para um **repositório privado** no GitHub.
2. No Render, crie um **Web Service**, Runtime Node, Build Command `npm install`, Start Command `npm start`.
3. Variáveis obrigatórias: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `WA_SESSION_ENCRYPTION_KEY` (64 caracteres hexadecimais aleatórios), `INTEGRATION_SECRET` (32+ caracteres aleatórios). Variável opcional: `WA_SESSION_ID=main`.
4. Gere chaves em um terminal local: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (execute duas vezes, uma para cada variável secreta).
5. Para abrir a tela de QR, a rota `/qr` requer o header `x-integration-secret`. Exemplo local: `curl -H "x-integration-secret: SUA_CHAVE" https://SEU-SERVICO.onrender.com/qr -o qr.html` e abra o HTML localmente. Nunca compartilhe o arquivo QR.
6. Após conectar, obtenha os grupos: `curl -H "x-integration-secret: SUA_CHAVE" https://SEU-SERVICO.onrender.com/groups`. Copie o ID do grupo para `WA_GROUP_ID` nas variáveis de ambiente do Render.
7. O serviço aceita POST `/notify` com header `x-integration-secret` e JSON `{"eventId":"...","eventName":"...","category":"...","originalMessage":"..."}`.

## Supabase

Usa a tabela `public.twish_wa_auth` com chave composta `(session_id,key_id)` e coluna `payload`, criada anteriormente. A sessão é criptografada com AES-256-GCM antes do armazenamento. **Faça backup da chave de criptografia**: perdê-la impede recuperar a sessão.

## Importante

- A integração com o Twish Eventos atual **ainda precisa ser implementada** para chamar `/notify`; este ZIP é o serviço receptor, não altera o bot da Twitch.
- No Render Free, hibernação interrompe a conexão e pode atrasar notificações; monitoramento HTTP não garante continuidade.
- A versão inicial usa armazenamento de deduplicação em memória; reinícios podem permitir reenvio.
- A página QR foi protegida por header secreto, portanto não é uma página de login convencional.
- Algumas versões do Baileys podem mudar a forma de identificação de participantes. Teste menções em um grupo com consentimento antes de ativar notificações.
