# Status da Ceci e das integrações

## Três informações distintas

- **Ceci validada:** existe resposta da agente publicada no playground, com chamada concluída ao modelo e configuração/chave correspondentes à versão atual. É validação técnica da resposta; os resultados e a aprovação dos cenários permanecem no playground.
- **Integrações conectadas (0/3 a 3/3):** MercadoPhone com consulta validada e credencial disponível; OpenAI com acesso comprovado; WhatsApp com sessão efetivamente conectada. Ter uma credencial salva não comprova uma conexão.
- **Preparação e ativação em produção:** catálogo, modelo de produção, resposta com esse modelo, recebimento externo e demais etapas continuam sendo acompanhados separadamente. Conexão e teste econômico não significam liberação automática de produção.

Um teste econômico com Luna comprova a conexão da OpenAI e a resposta do playground. Ele não comprova acesso ao modelo de produção se esse modelo for diferente. O indicador da Ceci mostra Validada e explica o escopo do teste. Quando o mesmo modelo configurado para produção responde com a configuração atual, a evidência também atende à validação desse modelo.

Em Integrações → OpenAI, a etapa **Validação da Ceci** usa essa mesma evidência, incluindo testes econômicos: fica verde e concluída, mostra data e modelo utilizado e oferece **Revisar testes no playground**. Não solicita uma nova validação enquanto a evidência atual for válida. O acesso ao modelo de atendimento continua na etapa própria; quando falta uma resposta com esse modelo, a preparação identifica especificamente **Resposta com o modelo de produção**, sem apresentar a validação da Ceci como pendente.

## Registros já existentes

O painel recupera evidências das últimas 30 sessões com resposta publicada e assinatura da configuração atual. A recuperação cruza snapshot, cursor de resposta e medidor da chamada da Ceci; respostas apenas do cliente simulado/avaliador não validam a agente. Não são feitas novas chamadas externas ou gastos de tokens. Novas respostas do playground registram a validação ao serem publicadas.

Alteração de chave ou configuração invalida as evidências correspondentes. Um registro antigo não sobrescreve uma falha mais recente da mesma conexão. Pausa manual, ativação de produção, credenciais e aprovações dos cenários não são alteradas pela reconciliação de status. O histórico dos testes permanece preservado.

## Verificação

`tests/integration-status-runtime.mjs` usa D1/SQLite e serviços simulados para verificar recuperação, assinatura atual, chamada da Ceci, distinção Luna/produção, contagem 3/3, recebimento pendente, invalidação e preservação da pausa. `tests/availability-ui.mjs` verifica os indicadores. `tests/playground-interface.mjs` renderiza a tela real de integrações com validação econômica, de produção e pendente. O fluxo completo de `tests/shared-central-runtime.mjs` comprova que uma rotina registra sua validação a partir do medidor compartilhado do lote.
