# Servidor da sessão WhatsApp Web

Este serviço usa Baileys para manter **uma** sessão de aparelho conectado. Execute em um servidor Node 24 sempre ligado, com HTTPS por um proxy reverso e disco persistente. Sites não mantém a conexão WebSocket do WhatsApp ativa por conta própria.

## Implantação

1. Crie um servidor com Docker e um domínio HTTPS dedicado, por exemplo `https://conexao.suaempresa.com.br`. Mantenha somente uma réplica da aplicação e monte um volume persistente em `/data`.
2. Gere `BRIDGE_API_TOKEN` com pelo menos 32 caracteres aleatórios e `SESSION_KEY` com 32 bytes aleatórios em Base64. Configure estas variáveis como segredos do servidor. Guarde uma cópia segura da chave da sessão; sem ela não é possível ler o banco criptografado após reiniciar.
3. Configure `SITE_EVENTS_URL` com `https://center-cell-atendimento.fredborrasca.chatgpt.site/api/whatsapp-web/events`. Configure `SITE_AUTH_HEADER` com o **valor literal** do cabeçalho `OAI-Sites-Authorization` que autoriza a chamada do serviço para o Site privado. Esse valor concede acesso ao Site e não deve ser exposto ao navegador.
4. Construa a imagem com `docker build -t center-cell-whatsapp-web ./bridge` e execute com volume `/data`, segredos e proxy HTTPS. Não publique a porta 3100 diretamente na internet; o proxy é a única entrada.
5. Em Integrações no Site, informe o domínio HTTPS do servidor e a mesma `BRIDGE_API_TOKEN`, então abra o QR. No celular, use WhatsApp → Aparelhos conectados → Conectar um aparelho.
6. Envie uma mensagem de teste de outro número. A central libera o recebimento somente depois que o evento assinado chega. Ative a IA depois das demais verificações comerciais e de catálogo.

O endpoint HTTP do serviço exige `Authorization: Bearer <BRIDGE_API_TOKEN>` para todas as operações. O Site exige autenticação de proprietário para obter o QR e controlar a sessão. O serviço envia eventos assinados por HMAC para a rota privada, guarda eventos ainda não entregues no SQLite e tenta novamente. Salve o volume e os segredos em backups restritos. O QR e os arquivos de autenticação permitem vincular a conta; não os compartilhe.

Baileys não é uma integração oficial da Meta. Mudanças no WhatsApp Web podem interromper o pareamento ou a entrega, e uso automatizado pode sofrer restrições. Valide com um número de teste antes de usar o número comercial.
