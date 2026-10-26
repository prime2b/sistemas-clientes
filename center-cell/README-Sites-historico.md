# Center Cell — Central de atendimento

Plataforma privada para gerenciar atendimento, catálogo e orçamentos da Center Cell Distribuidora. Interface em português, responsiva, com dados persistidos em D1. Criada com React/Vinext e componentes Shadcn.

## Entregue

- Caixa de entrada com histórico, busca, filtros, notas internas, perfil comercial, atribuição de responsável e encerramento/reabertura.
- Testes internos separados do WhatsApp. Uma resposta manual transfere a conversa para atendimento humano.
- Configuração persistente do nome, orientações, mensagem inicial e passagem para a equipe.
- Cadastro de responsáveis pela fila; esse cadastro não concede acesso ao painel. O compartilhamento permanece privado para o proprietário.
- Credenciais cifradas com AES-GCM no servidor; chave mestra em segredo de ambiente.
- Conector MercadoPhone somente leitura, fixado à Center Cell (unidade 4046). Catálogo paginado e pesquisável; sincronização iniciada pelo operador, com pausa, retomada e progresso persistente. O catálogo em uso só é substituído quando a nova leitura termina. Custos e fornecedores não entram no índice nem na IA.
- Orçamento persistente, com atualização de preços e estoque a cada geração, download em texto e cópia. Não grava orçamento/venda no ERP e não reserva estoque.
- Motor OpenAI Responses com busca, orçamento, identificação de perfil e passagem para a equipe. Requer chave de API configurada.
- Agente comercial com triagem de intenção: reparo, diagnóstico, mão de obra, garantia e orçamento de serviço são encaminhados à equipe; lojas e assistências comprando peças seguem no fluxo B2B. A busca remove palavras de ligação, reconhece sinônimos do setor (como frontal, display, tela, LCD, OLED e módulo) e ranqueia modelo e peça. O agente é bloqueado de afirmar preço ou disponibilidade sem uma nova consulta ao MercadoPhone para a quantidade solicitada.
- Adaptador WhatsApp com verificação de assinatura HMAC, validação do número, recepção de texto, passagem de mídia para humanos e bloqueio de envio fora da janela. O canal está inativo até concluir ativação e validação.
- Integrações mostra o QR real de aparelhos conectados quando o serviço contínuo em `bridge/` está online. Uma única sessão atende o painel administrativo e as três atendentes. A sessão usa Baileys/WhatsApp Web, sem Cloud API. O serviço mantém chaves da sessão criptografadas em SQLite, fila persistente de eventos, reconexão e um canal HTTP autenticado para o Site. Esta biblioteca não é oficial do WhatsApp e sua compatibilidade pode mudar.

## Continuação — verificações de ativação

- Integrações mostra seis etapas: ERP, catálogo completo, acesso ao modelo, resposta interna, sessão WhatsApp Web e recebimento externo. A ativação da IA exige uma mensagem real recebida depois do pareamento.
- Testes de acesso ao modelo (`GET /v1/models/{model}`) e de consulta do número Meta são somente leitura; não geram respostas nem enviam mensagens. Sucesso nesses testes não atesta entrega pelo WhatsApp nem saldo para geração.
- Resultados de IA e Meta são vinculados às configurações e credenciais por assinatura SHA-256 privada; somente status, rótulo, mensagem e data são retornados ao painel. Mudanças de chave/modelo invalidam resultados anteriores. O teste interno também depende das instruções salvas.
- Alterar credenciais pausa o atendimento automático. A ativação exige todas as etapas no servidor e na interface; o recebimento público permanece desligado.
- A resposta de passagem humana agora é distinguida de uma resposta automática comum para que a confirmação possa ser enviada depois da mudança de status. Isso não implementa serialização por conversa nem resolve todas as corridas com operadores concorrentes.
- `tests/integration-probes.mjs` usa respostas simuladas para verificar autenticação recusada, modelo indisponível, limites, respostas inválidas, falha de rede e ausência de vazamento de credenciais. `tests/platform-smoke.py` verifica API/banco locais, incluindo bloqueios de ativação. Os serviços externos e a interface autenticada não foram testados nesta continuação.

## Ativação pendente

1. Configurar a chave OpenAI e validar disponibilidade do modelo configurado; padrão `gpt-6-astra`. Para provisionar a chave pelo Work, habilitar o plugin OpenAI Developers. A integração real de IA não foi exercitada sem essa credencial.
2. Hospedar `bridge/` em um único servidor Node 24 com processo contínuo, HTTPS na frente e volume persistente `/data`. Gerar `BRIDGE_API_TOKEN` (ao menos 32 caracteres aleatórios) e `SESSION_KEY` (32 bytes aleatórios em Base64). Configurar também `SITE_EVENTS_URL=https://center-cell-atendimento.fredborrasca.chatgpt.site/api/whatsapp-web/events` e `SITE_AUTH_HEADER` com o cabeçalho de acesso servidor a servidor fornecido pelo Sites. O token de acesso privado dá alcance ao Site inteiro: mantê-lo apenas no servidor protegido, nunca no navegador ou repositório. A rota de eventos exige adicionalmente uma assinatura HMAC e carimbo de tempo.
3. Configurar o endereço HTTPS e a mesma chave compartilhada na aba Integrações. Abrir “Conectar WhatsApp”, ler o QR pelo celular em Aparelhos conectados e enviar uma mensagem real para validar a chegada à central. O QR não aparece enquanto o serviço não estiver online.
4. Validar reconexão, fila, recebimento, envio, contatos sem número compartilhado e escala em um piloto antes de operar com clientes. Mídia vira atendimento humano sem download. O processamento automático ainda precisa de serialização por conversa para cargas concorrentes. A biblioteca WhatsApp Web é não oficial e pode ter mudanças ou restrições de conta.
5. Ativar o atendimento automático somente após ERP, catálogo, IA, teste interno, sessão conectada e recebimento validado. O fluxo legado Cloud API permanece no código para dados antigos, mas não é o canal padrão.
6. Revisar permissões e campos adicionais de escrita no ERP antes de habilitar qualquer gravação. Não há rotas de mutação no ERP nesta versão.

## Regras de preço

A Center Cell é distribuidora. Lojistas/assistências usam `valorVenda`. Acessórios vendidos ao consumidor final usam `valorVenda2`, conforme a orientação encaminhada pela cliente. Perfil desconhecido, preço ausente, classificação contraditória ou segundo preço fora do escopo exigem revisão. Não há substituição automática pelo preço de lojista. Custo nunca é fornecido ao modelo ou à conversa.

## Configuração de ambiente

- `MERCADOPHONE_API_KEY`: segredo de conexão somente leitura autorizado pelo usuário.
- `CONFIG_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64, segredo do servidor.
- `OPENAI_API_KEY`, `WHATSAPP_TOKEN`, `META_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`: podem ser adicionados pelo painel, onde ficam cifrados, ou por segredo de ambiente.
- `WHATSAPP_WEB_BRIDGE_TOKEN`: chave compartilhada inserida em Integrações, cifrada no Site. O serviço contínuo usa o mesmo valor como `BRIDGE_API_TOKEN`.
- `WHATSAPP_WEBHOOK_PUBLIC`: sinalizador legado da Cloud API, não é necessário para a conexão WhatsApp Web.

Não gravar credenciais no código, Git, respostas, logs ou manifesto de hospedagem. A autenticação usa os cabeçalhos confiáveis do dispatcher Sites, não entradas do navegador. API administrativa exige identidade e rejeita mutações de outra origem. Mantenha o acesso do Site privado.

## Desenvolvimento e verificação

Instalação e build usam os helpers oficiais Sites; projeto com pnpm. Migrações Drizzle em `drizzle/`. O banco de teste local é separado da produção. O teste `tests/platform-smoke.py` inicia o Worker construído, usa apenas uma identidade local de teste e exige as migrações já aplicadas em `.wrangler/qa`.

Validação realizada: TypeScript sem erros, build completo, migrações locais aplicadas, integração local do Worker para autenticação, configurações, conversa, histórico, passagem humana, encerramento, CSRF, entradas inválidas, credencial IA ausente e webhook inativo. As 25 verificações do conector original validaram preços por perfil, centavos, disponibilidade, quantidades, paginação e exclusão de dados internos. O fluxo da plataforma também valida checkpoints retomáveis e rejeição de uma sincronização antiga após reinício. O teste dedicado valida publicação atômica, repetição segura da última página, preservação do catálogo em falhas, produtos duplicados entre páginas e concorrência entre abas.

A prévia gerenciada confirmou o carregamento do shell e o bloqueio de dados sem login. Esse contexto não forneceu identidade para testar o painel completo e não disponibilizou WebMCP; validação de WebMCP indisponível. Não foram relaxadas as proteções para contornar isso.

## Referências

- MercadoPhone OpenAPI fornecido pelo usuário e consultas GET autorizadas: https://platform.mercadophone.tech/
- OpenAI function calling: https://developers.openai.com/api/docs/guides/function-calling
- OpenAI orientação do modelo: https://developers.openai.com/api/docs/guides/latest-model
- Meta Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api/ — confirmar contrato e versão no momento da ativação; documentação online apresentou bloqueio de acesso na consulta desta sessão.
