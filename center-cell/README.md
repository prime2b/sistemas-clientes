# Center Cell — Central de atendimento

Código-fonte da plataforma de atendimento da Center Cell, com a agente Ceci, catálogo MercadoPhone, orçamentos, painéis de atendentes e integração WhatsApp via UAZAPI.

## Versão desta publicação

- Sites: versão 75.
- Commit de origem: `9a6ab1b2bd1e5fdfab25b4b707e8f3bc40f5f679`.
- Aplicação: https://center-cell-atendimento.fredborrasca.chatgpt.site
- Produção: modelo configurado `gpt-5.6-terra`.
- Novos testes econômicos do playground: `gpt-5.6-luna`. Homologação permite usar o modelo de produção para a Ceci.

## Atendimento completo no playground

O cliente simulado não pode encerrar a rotina ao receber o orçamento: a confirmação precisa passar pelo motor Ceci e a venda só é concluída após a confirmação final com a atendente.

As rotinas comerciais continuam após a Ceci: recebimento no painel de uma das três atendentes simuladas, combinação de retirada/entrega e pagamento, confirmação final e venda simulada concluída. Há condução automática, modo manual e cenário de equipe indisponível. As mensagens automáticas da atendente usam textos contextuais sem gasto extra de IA; cliente e avaliador permanecem no modo econômico. Consulte [o guia](docs/playground-vendas.md).

A voz da Ceci foi ajustada para linguagem mais simples, mantendo nomes oficiais dos produtos e as regras de consulta. Nenhuma venda, cobrança ou envio real é realizado pelo playground.

## Estrutura

- `app/`: interface e rotas autenticadas.
- `lib/`: motor de atendimento, integrações, orçamentos e testes automáticos.
- `drizzle/`: schema e migrações D1.
- `public/`: logotipos, ícones e imagens da marca.
- `tests/`: verificações automatizadas, com serviços simulados quando indicado.
- `bridge/`: conector legado opcional de WhatsApp Web. A integração atual usa UAZAPI.

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

Credenciais de OpenAI, MercadoPhone e UAZAPI e a chave de criptografia são configuradas no ambiente de hospedagem ou no painel autenticado. Banco de produção, contas, sessões e dados de clientes não fazem parte desta cópia. A migração de autenticação foi exportada sem o cadastro e os hashes de acesso inicial do administrador. Configure o acesso administrador pelo procedimento privado do ambiente de implantação; não há senha padrão neste repositório.

Os testes locais não devem enviar mensagens ao WhatsApp nem criar vendas reais. Conectar o repositório ao GitHub não implanta a aplicação ou transfere os dados D1.

O arquivo `README-Sites-historico.md` preserva a documentação original, escrita em etapas anteriores do desenvolvimento, e pode conter referências a fluxos legados.
