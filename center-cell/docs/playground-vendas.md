# Center Cell — atendimento na central compartilhada

## Fluxo atual

A Ceci acolhe, identifica peça e modelo, consulta o MercadoPhone, apresenta todos os produtos disponíveis com valores confirmados e encaminha imediatamente para a fila compartilhada. A atendente assume, aproveita a lista e o contexto, combina produto e quantidade, gera orçamento com nova consulta, obtém a confirmação e conclui a compra. A Ceci não pergunta quantidade, qualidade, perfil ou intenção de compra neste fluxo e não exige orçamento ou compra confirmada para encaminhar.

O canal é destinado a lojistas e usa por padrão a tabela B2B configurada na plataforma. Isso não afirma que a pessoa está cadastrada. A identificação por telefone continua silenciosa. Em Chatbot, a administração pode optar por exigir perfil identificado; nesse caso, situações sem condição comercial segura seguem diretamente à equipe.

## Operação

Admin e atendentes entram com suas contas no endereço principal. `/atendente` redireciona para a central. A equipe vê a mesma caixa de entrada, com filtros por situação e responsável. “Minhas conversas” filtra a mesma central. Somente o responsável pode responder ou montar orçamento; o administrador pode assumir ou transferir. A assunção é atômica e as operações da conversa são serializadas, evitando dois responsáveis simultâneos. Mensagens enviadas pela equipe registram a identidade da pessoa.

Não lida, atribuída, respondida e finalizada são condições independentes. A leitura é registrada por usuário e por mensagem recebida efetivamente exibida com a janela em foco. Marcar como não lida não remove a responsável. Uma mensagem que chega depois da leitura continua não lida. A leitura de uma pessoa não limpa a pendência de outra.

A caixa preserva fotos de perfil, histórico, notas internas, arquivar/restaurar, finalizar/reabrir e exclusões conforme as permissões. A equipe acessa perfil pessoal e atendimento; configurações administrativas, usuários, integração, segredos e playground permanecem restritos à administração. A aparência familiar do WhatsApp está limitada à área de Atendimento.

Depois de encaminhar, novas mensagens permanecem com a equipe. Após finalizar, uma nova mensagem reabre para atendimento humano. Devolver à Ceci exige ação explícita da responsável ou administração. Não houve ativação automática do WhatsApp nesta atualização.

## Playground

As novas rotinas usam o mesmo fluxo curto da produção. Selecione Conversa natural e “Continuar automaticamente” ou “Quero assumir como atendente”. Na visualização Central, há uma única caixa compartilhada. O seletor “Operando como” escolhe a identidade simulada; ele não abre outro painel. No modo manual, clique em Assumir, responda ao cliente, use “Consultar e enviar orçamento” quando a seleção estiver pronta e conclua somente após a confirmação final. O modo automático simula essas ações. Os testes de alteração de quantidade e segundo modelo ocorrem com a atendente.

A avaliação exige listagem completa antes do encaminhamento, ausência de orçamento gerado pela Ceci, recebimento e assunção na central, orçamento consultado pela atendente, aceite do cliente e confirmação final. Equipe indisponível termina com a conversa na fila, sem inventar orçamento ou venda. Preço/estoque insuficientes deixam o cenário não executável ou inconclusivo, com as evidências preservadas.

Consultas de catálogo e preço são reais; mensagens, assunção e venda são simuladas. Nenhuma cobrança, reserva de estoque, mensagem ao WhatsApp ou pedido no ERP é criado pelo playground. A atendente automática usa textos contextuais; cliente e avaliador mantêm o modelo econômico e o orçamento de tokens. Os limites de tempo e consumo continuam sendo respeitados.

Relatórios antigos conservam seus snapshots. Uma repetição cria execução nova com os mesmos produtos e o fluxo atual. O [checkpoint da versão 76](checkpoint-v76.md) preserva o código do comportamento anterior.

## Digitação e proteção contra repetição

O celular acompanha quem está preparando a próxima resposta: Ceci/atendente à esquerda e cliente simulado à direita. Pausa, histórico, espera por operação manual e recuo após falha não mostram digitação. A mensagem pendente do cliente usa o mesmo ID da versão persistida, evitando duplicação ao atualizar a tela. Mensagens históricas vazias não geram balões; mensagens distintas com texto igual permanecem visíveis.

O aceite pode incluir o código e a quantidade exatos do orçamento, junto com retirada e Pix. Esses dados são verificados e aproveitados; a confirmação final da combinação continua obrigatória. Produto ou quantidade divergentes, recusa, perguntas e condições não confirmam a compra. Referências ambíguas a um SKU em um orçamento com vários itens exigem esclarecimento.

A atendente não publica mensagens vazias. Uma resposta repetida sem mudança de etapa é interrompida antes de criar outra mensagem. Se um teste anterior já tiver um aceite válido registrado depois do mesmo orçamento, a rotina retoma a partir dessa evidência, sem reenviar nem consultar o modelo novamente. O histórico anterior não é apagado.

Verificação: regressão do texto do print (código, duas unidades, aceite, retirada e Pix), fluxo até a venda simulada com um orçamento, retomada, bloqueio de duplicação, recibos/visibilidade do celular e renderização dos indicadores de digitação. Serviços de IA, ERP e envio são substituídos por fixtures nos testes isolados; isso não representa uma nova homologação com os provedores reais.


## Saldo de estoque

As mensagens da Ceci e os cards de produtos mostram apenas disponibilidade, sem divulgar quantas peças existem em estoque. A mesma apresentação vale no WhatsApp e no playground. O saldo numérico continua disponível internamente para validar a quantidade solicitada e impedir orçamento sem estoque suficiente. Quantidades do pedido e do orçamento permanecem visíveis. A consulta de opções enviada ao modelo não contém o campo numérico de estoque, e a redação da agente também é verificada contra divulgação de saldo. Históricos de mensagens antigas não são reescritos.

## Escolha sem repetição na simulação

Um item disponível pode não atender à quantidade do cenário. O cliente fictício recebe opções aptas à quantidade solicitada, sem acesso ao saldo numérico. A lista da Ceci continua completa. Uma escolha gerada inválida pode ser corrigida uma única vez pelo executor antes de virar mensagem, usando somente códigos apresentados e quantidade do cenário; esse ajuste fica registrado nos eventos como `simulated-client-repair`. Isso não altera mensagens reais, respostas já salvas nem o comportamento da Ceci em produção. Se nenhuma opção atender à quantidade, o resultado é indisponível, nunca uma venda ficticiamente aprovada.

O executor reconhece quantidades por extenso, códigos e referências à posição da lista. Retirada e pagamento informados junto da escolha são aproveitados; aceite do orçamento e confirmação final continuam sendo exigidos em etapas distintas. Escolhas já persistidas em execuções parcialmente salvas são retomadas sem nova mensagem ou chamada de IA. Quando faltar um dado ou a quantidade não puder ser confirmada, o pedido de esclarecimento indica a pendência específica.

A regressão do print foi reproduzida no executor anterior com `AUTO_SALE_REPEATED_REPLY` e um item disponível sem quantidade suficiente. `tests/playground-selection-runtime.mjs` verifica o mesmo caso até a venda simulada, o diálogo com retirada/Pix antecipados, Samsung, Motorola, Xiaomi, retomada e indisponibilidade legítima, usando serviços isolados. `tests/shared-central-runtime.mjs` cobre o fluxo completo desde o “Oi”, as demais rotinas e as rotas compiladas.

## Conversa com a atendente manual

O cliente simulado recebe explicitamente a última mensagem da operadora e as pendências comerciais. Ele responde ao que foi escrito, sem seguir cegamente a instrução de repetir escolha e quantidade. A correção automática de seleção da rotina não é aplicada às respostas conversacionais no modo manual. Uma reformulação redundante do mesmo código após uma fala de encerramento é substituída por uma resposta contextual do cliente fictício, com registro nos eventos. Respostas já salvas não são reescritas.

“Já separei, pode vir buscar” recebe um reconhecimento natural. Se faltar orçamento, o cliente pede para conferi-lo; essa frase da atendente não comprova reserva, aceite ou venda. A operadora pode continuar escrevendo e tem o botão Consultar e enviar orçamento disponível junto do próximo passo. Depois do orçamento aceito e das condições combinadas, uma confirmação natural como “Combinado, vou buscar. Obrigada!” libera Concluir venda simulada. Perguntas, recusas, condições ou mudança de quantidade não autorizam concluir. O teste manual aguarda a operadora nessas etapas e permite até 30 respostas do cliente, mantendo os limites de tempo/tokens.

`tests/playground-manual-runtime.mjs` cobre os textos dos prints, a recuperação de seleção anterior, fala fora de contexto, orçamento ausente, aceite, encerramento natural e conclusão explícita pela operadora. As mensagens não são enviadas ao WhatsApp e nenhuma venda é criada no ERP.

## Aceite natural e prevenção de ciclos

O cliente simulado pode aceitar o orçamento e informar retirada/entrega e pagamento na mesma mensagem. Expressões como “Está tudo certo. Pode seguir com a compra; vou retirar na loja e pagar por Pix” são decompostas em aceite e preferências, mantendo a conferência do SKU/quantidade do orçamento. O executor avança para o resumo final, sem perguntar de novo sobre o orçamento ou gerar outra cotação. A confirmação final também aceita essa linguagem natural; ela continua sendo uma mensagem posterior ao resumo das condições.

Recusas, dúvidas, condicionais, códigos/quantidades diferentes ou preferências conflitantes não são convertidas em compra. Se o cliente mudar retirada/entrega ou pagamento, a atendente resume as novas condições e pede uma nova confirmação. Mensagens de cortesia isoladas não aceitam um orçamento.

No modo automático, uma resposta que não esclarece o aceite ou a confirmação final admite no máximo uma pergunta de esclarecimento diferente. Se continuar ambígua, o resultado é inconclusivo com motivo explícito, sem ciclo de perguntas nem venda inventada. O modo manual continua aguardando a operadora. Um aceite já persistido antes de uma falha de salvamento é aproveitado sem nova chamada ao modelo ou repetição da mensagem.

`tests/playground-consent-runtime.mjs` reproduz o texto do print e verifica a conversa até a conclusão, orçamento único, recuperação sem gasto adicional, várias peças/modelos, recusas e proteção contra ciclos. O fluxo completo em `tests/shared-central-runtime.mjs` inclui o aceite natural no executor e nas rotas compiladas. As regras e os prompts da Ceci em produção não são alterados por esse tratamento do simulador.
