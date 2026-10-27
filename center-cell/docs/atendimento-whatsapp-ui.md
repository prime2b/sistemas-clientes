# Atendimento: referência WhatsApp Web

## Referências consultadas

- Design at Meta, “Keeping WhatsApp fresh, simple and approachable”: https://www.meta.com/design-at-meta/blog/whatsapp-user-interface-update/
- Meta, “Find Messages Faster with WhatsApp Chat Filters”: https://about.fb.com/news/2024/04/whatsapp-chat-filters/

As publicações descrevem princípios e referências visuais, não um pacote público de componentes CSS. A implementação usa componentes locais: cores, ícones no grid de 24 px, tipografia do sistema, agrupamento de mensagens, lista de conversas e controles familiares. O padrão de fundo é um SVG local original com traços discretos. A identidade da central continua sendo Center Cell.

## Escopo

Somente a lista de conversas, o chat e seus detalhes recebem o tratamento visual. O menu lateral e o cabeçalho da aplicação mantêm exatamente o design e o comportamento padrão das demais telas, incluindo a preferência persistida de recolher ou expandir. Catálogo, orçamentos fora da conversa, integrações, configurações, login e playground mantêm seu tema.

A tela sem seleção apresenta um estado de repouso. O painel operacional anterior continua em “Visão geral da central”, acessível pelo cabeçalho da lista e pelo botão da tela vazia. Filtros avançados de responsável, minhas conversas e finalizadas ficam no botão Filtros. Arquivadas também têm entrada própria quando há conversas arquivadas.

O contato no cabeçalho abre os detalhes e a transferência. A barra de mensagem contém envio, seletor de emoji e o menu + para orçamento, nota interna e respostas rápidas. Busca na conversa filtra o histórico carregado; limpar ou fechar restaura a visualização. O menu de cada mensagem permite copiar seu texto e abrir a confirmação de exclusão da central. Não há simulação de chamadas ou áudio sem suporte do canal.

Permissões de assumir, transferir, responder, enviar orçamento, finalizar, reabrir, arquivar e excluir continuam nos endpoints existentes. O redesign não muda o fluxo da Ceci, cadastro, prompts, preços, conexão ou configuração de produção. Mensagem aceita pelo provedor mostra um tique; entregue, dois; lida, dois azuis, somente quando esse status constar no histórico. Sem confirmação é exibido apenas o registro local. A interface não supõe presença online do cliente nem criptografia do histórico administrativo.

## Verificação

- Compilação e TypeScript.
- Renderização real dos componentes React, incluindo caixa bloqueada antes de assumir, estado vazio e diferenças entre enviada, entregue e lida.
- A prévia gerenciada local estava indisponível devido a outro servidor em execução; não foi alterada a infraestrutura. O navegador conectado não disponibilizou uma sessão autenticada. Conferência visual interativa da área interna permanece pendente.

## Checkpoint

Antes do redesign: versão 77 do Sites, origem `e745dc69fc9e069c5fc470354c0b421c1d4370a7`, GitHub `574c14b3f8621735ee671b79d7f0aaf200557a43`.

Branch: https://github.com/prime2b/sistemas-clientes/tree/checkpoint/center-cell-v77-before-whatsapp-ui-2026-10-27

Para retornar, fazer uma nova publicação do código anterior, preservando os dados atuais. Não há migração de banco nesta alteração. O checkpoint da versão 76 também permanece preservado para o fluxo anterior à central compartilhada.
