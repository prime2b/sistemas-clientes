# WhatsApp pela Z-API

A central usa a instância Z-API configurada pelo administrador. O menu, os dados, as credenciais de outros serviços e a configuração da Ceci permanecem preservados.

## Configuração

Em Integrações → WhatsApp, configure ID da instância, token da instância e **Client-Token** (token de segurança da conta Z-API). Todos os pedidos passam pelo servidor. O navegador recebe somente indicadores de credenciais configuradas, o ID da instância, estados sanitizados e o QR Code real.

O Client-Token é diferente do token da instância. Sem ele, a central mostra a configuração pendente e não chama a API para gerar um QR fictício.

Ao gerar o QR ou configurar o recebimento, o servidor registra quatro callbacks na instância: mensagens recebidas, conexão, desconexão e status das mensagens. O callback usa uma chave aleatória de 256 bits, protegida no servidor, e valida também o ID da instância.

Variáveis de runtime, nunca no Git ou no manifesto:

- `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN`, `ZAPI_CLIENT_TOKEN`: segredos da instância/conta.
- `ZAPI_WEBHOOK_URL`: URL HTTPS de `/api/z-api/events` na origem Sites da aplicação.
- `ZAPI_WEBHOOK_SECRET`: gerado e cifrado no primeiro cadastro dos callbacks, ou fornecido como segredo de runtime.
- `CONFIG_ENCRYPTION_KEY`: chave existente para cifrar configurações sensíveis.

O QR expira em 20 segundos. A tela renova após 15 segundos, até três solicitações; depois exige interação. Se a instância já estiver conectada, a tela apresenta o estado conectado. Verificações adicionais exigidas pelo WhatsApp são encaminhadas à alternativa oficial da Z-API.

## Atendimento

Mensagens recebidas possuem identificação determinística e uma trava por contato. Repetições de webhook não criam outro atendimento ou resposta já confirmada. Ecos da API, mensagens próprias, grupos, newsletters, edições e mensagens ainda aguardando descriptografia são ignorados. Mídias seguem para atendimento humano. IDs privados `@lid` são aceitos sem tratá-los como telefone real; associações a telefones são feitas apenas quando fornecidas pelo provedor.

A Ceci segue as configurações existentes, respeita a pausa manual e a propriedade humana da conversa. A integração atende ao bot e às respostas das atendentes no mesmo painel. Confirmações de envio/entrega/leitura são monotônicas e podem chegar antes da gravação da mensagem.

Os receptores `/api/uazapi/events` e `/api/whatsapp-web/events` estão desativados (410) para não processar a mesma conversa por dois provedores. Segredos antigos permanecem protegidos para permitir retorno ao checkpoint, sem serem utilizados pelo canal atual.

## Verificação

`node --experimental-strip-types tests/zapi-runtime.mjs` exercita rotas reais e o motor da Ceci em D1/SQLite isolado, com HTTP simulado e sem mensagens externas. Cobre autenticação, origem, callbacks, QR, duplicação, IDs privados, propriedade humana, resposta da atendente, fotos, recibos e desconexão.

Esses testes não substituem a validação da instância real: adicionar o Client-Token, vincular o aparelho e receber uma mensagem de teste antes de liberar o número para clientes. Uma instância conectada e um recebimento validado são estados diferentes na interface.

Referências oficiais: [Client-Token](https://developer.z-api.io/security/client-token), [QR Code](https://developer.z-api.io/instance/qrcode), [eventos recebidos](https://developer.z-api.io/webhooks/on-message-received), [IDs privados](https://developer.z-api.io/tips/lid).
