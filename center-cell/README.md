# Center Cell — Central de atendimento

Código-fonte da plataforma de atendimento da Center Cell, com a agente Ceci, catálogo MercadoPhone, orçamentos, central compartilhada de atendentes e integração WhatsApp via Z-API.

## Versão desta publicação

- Sites: versão 84.
- Commit de origem: `b6cd4b5239f90341b35eb8337494afde66984172`.
- Aplicação: https://center-cell-atendimento.netlify.app
- Origem: https://center-cell-atendimento.fredborrasca.chatgpt.site
- Modelos e credenciais existentes preservados. Playground econômico continua separado da homologação e produção.

## Rotinas automáticas: escolha até a venda simulada

A versão 84 corrige a repetição após a escolha de código e quantidade. O cliente fictício recebe opções aptas à quantidade exigida, sem saldo de estoque; seleções geradas inválidas podem ser ajustadas antes da mensagem e ficam registradas em eventos de simulação. A lista completa da Ceci é preservada. Quantidades por extenso e referências à posição da lista são reconhecidas. Retirada/Pix antecipados são aproveitados sem dispensar aceite do orçamento e confirmação final. Uma escolha já persistida pode ser retomada sem duplicação ou nova chamada de IA.

O problema foi reproduzido no executor anterior com o mesmo erro de repetição, usando um item disponível sem quantidade suficiente. A regressão e o fluxo completo passaram em testes isolados, incluindo rotas compiladas, várias marcas, retomada, orçamento único e conclusão da venda simulada. Caso nenhuma opção atenda à quantidade, a rotina termina como indisponível. Não houve venda, cobrança, envio ao WhatsApp ou mudança de configuração de produção nesses testes. Veja [o guia](docs/playground-vendas.md).

## Correção da geração do QR Code

A versão 83 interpreta corretamente os detalhes informativos retornados em `error` pelo endpoint `/status` da Z-API. Estados documentados de conectado, desconectado e sessão a restaurar não são tratados como falhas de credenciais. Quando desconectada, a central segue para solicitar o QR real. Falhas de autenticação, respostas inválidas e erros do endpoint de QR continuam bloqueados. A regressão foi reproduzida antes da correção e validada nas rotas reais com HTTP simulado. Credenciais e interface foram preservadas.

## WhatsApp pela Z-API

A versão 82 substitui a UAZAPI por Z-API nas mensagens da Ceci e das atendentes, no QR Code, nos avatares e nos eventos de conexão e leitura. A página de integração tem área ampliada de pareamento (até 440–460 px conforme o espaço), credenciais protegidas, instruções e estados separados de conexão e recebimento. O menu da plataforma foi preservado.

São necessários ID, token da instância e **Client-Token**, o token de segurança da conta Z-API. O QR real só é solicitado com as três credenciais. O callback é registrado pelo servidor e protegido por segredo próprio e ID da instância. Receptores antigos retornam 410, evitando dois provedores ativos. O teste isolado exercita a Ceci e respostas humanas, eventos repetidos, contatos privados, recibos e desconexão sem enviar mensagens externas. A validação do aparelho real depende das credenciais completas e do pareamento. Veja [configuração e testes](docs/whatsapp-zapi.md).

Checkpoint anterior: [versão 81 antes da migração](https://github.com/prime2b/sistemas-clientes/tree/checkpoint/center-cell-v81-before-zapi-2026-10-27). O retorno exige uma nova publicação do código anterior, preservando o banco; não restaura conversas a um instante passado.

## Central compartilhada e atendimento curto

A Ceci identifica peça e modelo, consulta o catálogo e lista todos os produtos disponíveis com valores verificados. Depois encaminha imediatamente para a fila da central. A atendente assume na mesma interface, escolhe produtos e quantidades com o cliente, gera o orçamento e conclui o atendimento. Mensagens posteriores não reativam a Ceci sem devolução explícita à IA.

Admin e atendentes usam o mesmo painel, mantendo seus logins e permissões. Há filtros de não lidas, não atribuídas, atribuídas, minhas conversas e finalizadas. A leitura é individual e a atribuição impede duas pessoas de assumir o mesmo atendimento. O visual inspirado no WhatsApp está limitado à área de atendimento.

## Interface de Atendimento

A área de conversas de Atendimento usa referências oficiais do WhatsApp: lista de conversas, filtros em cápsulas, balões, horários, controles e campo de mensagem em uma linha. A versão 79 restaura o menu lateral e o cabeçalho exatamente ao padrão das demais telas, incluindo cores, logotipo, ícones, largura e comportamento de recolher ou expandir. Os recursos de orçamento, nota interna e resposta rápida ficam no menu +. A visão geral permanece acessível no cabeçalho e no estado vazio. Indicadores de enviada, entregue e lida dependem dos status registrados; não são presumidos.

A configuração de menu das demais telas é preservada. Não há alterações no motor da Ceci, integrações, credenciais ou banco. Ver [referências, escopo e limites de verificação](docs/atendimento-whatsapp-ui.md). A versão 77 foi preservada antes deste redesign em [checkpoint/center-cell-v77-before-whatsapp-ui-2026-10-27](https://github.com/prime2b/sistemas-clientes/tree/checkpoint/center-cell-v77-before-whatsapp-ui-2026-10-27).

## Playground

As novas rotinas comerciais simulam o fluxo desde o “Oi”, passam pela fila compartilhada e pela ação de assumir, validam o orçamento feito pela atendente e chegam à confirmação final e venda simulada. Há modo manual, automático e equipe indisponível. Resultados antigos permanecem consultáveis. Consulte [o guia](docs/playground-vendas.md).

Os testes usam isolamento e serviços simulados: não realizam venda, cobrança, pedido no ERP ou envio real ao WhatsApp. O teste interno não ativa a conexão de produção.

## Correção das rotinas automáticas

A versão 80 reconhece o aceite com o código e a quantidade exatos do orçamento junto com retirada e Pix. A conversa segue para a confirmação final, sem reorçar, gerar respostas vazias ou repetir a escolha. Testes parcialmente salvos podem reaproveitar o aceite já registrado depois do mesmo orçamento, sem nova chamada de IA. Alterações de item/quantidade e condições continuam exigindo esclarecimento.

O celular mostra a digitação de Ceci, atendente e cliente simulado no lado correto. Pausa, histórico e espera manual ficam sem digitação. A mensagem pendente é substituída pela persistida com o mesmo ID. Nenhum menu, tema ou configuração de produção foi alterado nesta correção. A regressão do print e a retomada foram verificadas em runtime isolado, com serviços simulados; a renderização do indicador também foi verificada. Veja [o guia do playground](docs/playground-vendas.md).

## Privacidade do saldo de estoque

A versão 81 substitui a quantidade em estoque por Disponível nas mensagens de produtos e nos cards de conversa. Os estados Indisponível e Consulta pendente permanecem explícitos. A regra vale para WhatsApp, playground e redação da Ceci. Resultados de inspeção enviados ao modelo não incluem o saldo numérico, e a redação é verificada contra sua divulgação. O saldo continua interno para validar os pedidos; as quantidades solicitadas no orçamento permanecem visíveis. Históricos antigos não são reescritos. Testes dos textos, renderização e preservação dos dados internos aprovados.

## Checkpoint para retorno

A versão anterior está preservada em [checkpoint/center-cell-v76-before-shared-inbox-2026-10-27](https://github.com/prime2b/sistemas-clientes/tree/checkpoint/center-cell-v76-before-shared-inbox-2026-10-27). Para retornar, publicar novamente esse código, preservando os dados posteriores. Veja [o procedimento](docs/checkpoint-v76.md). As migrações novas são aditivas; o checkpoint não é uma cópia do banco em um instante específico.

## Estrutura

- `app/`: interface e rotas autenticadas.
- `lib/`: motor de atendimento, integrações, orçamentos e testes automáticos.
- `drizzle/`: schema e migrações D1.
- `public/`: logotipos, ícones e imagens da marca.
- `tests/`: verificações automatizadas, com serviços simulados quando indicado.
- `bridge/`: conector legado opcional de WhatsApp Web. O receptor legado está desativado; a integração atual usa Z-API.

## Desenvolvimento

Requer Node.js 24 ou compatível e a versão de pnpm indicada em `package.json`.

```sh
cd center-cell
pnpm install
pnpm dev
# compilação
pnpm build
```

O projeto usa React, Vinext, Vite e Cloudflare Workers, com banco D1 no binding `DB`. O arquivo `.openai/hosting.json` registra a identidade da aplicação original no Sites; a configuração de hospedagem e banco precisa ser adaptada se o código for utilizado em outro ambiente.

## Configuração privada

Credenciais de OpenAI, MercadoPhone e Z-API e a chave de criptografia são configuradas no ambiente de hospedagem ou no painel autenticado. Banco de produção, contas, sessões e dados de clientes não fazem parte desta cópia. A migração de autenticação foi exportada sem o cadastro e os hashes de acesso inicial do administrador. Configure o acesso administrador pelo procedimento privado do ambiente de implantação; não há senha padrão neste repositório.

Os testes locais não devem enviar mensagens ao WhatsApp nem criar vendas reais. Conectar o repositório ao GitHub não implanta a aplicação ou transfere os dados D1.

O arquivo `README-Sites-historico.md` preserva a documentação original, escrita em etapas anteriores do desenvolvimento, e pode conter referências a fluxos legados.
