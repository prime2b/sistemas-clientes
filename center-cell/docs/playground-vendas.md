# Atendimento completo no playground

Novas rotinas comerciais continuam depois do orçamento aceito: recebimento no painel simulado, resposta da atendente, combinação de retirada/entrega e forma de pagamento, confirmação final do cliente e conclusão da venda simulada. O cenário “Equipe indisponível” encerra a avaliação com o atendimento aguardando na fila, sem falsa aceitação.

## Operação

Em Playground → Rotinas automáticas, escolha Conversa natural e a finalização “Continuar automaticamente” ou “Quero assumir como atendente”. Inicie a execução e acompanhe Cliente/WhatsApp, Atendente ou Texto. O telefone mantém seu tamanho e só mostra mensagens visíveis ao cliente.

A visualização Atendente oferece três filas. Somente a responsável recebe a conversa, o resumo e o mesmo orçamento aceito. No modo manual, use “Assumir como atendente”, escreva uma resposta ou use a sugestão, envie e aguarde o cliente simulado. Depois de combinar retirada/entrega e pagamento, peça confirmação. “Concluir venda simulada” só funciona quando essa confirmação estiver registrada. Pode devolver a condução ao modo automático. Pausa, retomada, histórico, exportação e limites de consumo continuam disponíveis; a página deve permanecer aberta para avançar os ticks.

## Limites da simulação

Consultas de catálogo/preço seguem o motor Ceci existente. A distribuição usa a mesma função de decisão da operação, com três disponibilidades e cargas fictícias, sem atribuir conversas às contas reais. Nome/avatar configurados são usados apenas na apresentação da simulação. O acesso é exclusivo de administradores e do dono da execução, com validação de origem, responsável, revisão e trava de concorrência.

As mensagens da atendente automática usam textos contextuais limitados para combinar o fechamento, sem chamadas adicionais de IA. O cliente e o avaliador continuam no modelo econômico e no orçamento compartilhado. Retirada/entrega e Pix/cartão são condições fictícias, sem endereço, frete, prazo, chave Pix, pagamento aprovado, reserva de estoque ou venda no MercadoPhone. O orçamento não é recriado no encaminhamento. Mudanças de itens e valores não fazem parte dessa etapa.

“Venda simulada concluída” é um estado explícito, separado do status fechado da conversa. A avaliação verifica o recebimento, continuidade, ausência de novas mensagens da Ceci, preservação do orçamento e confirmação final. Encerrar a conversa sozinho não aprova o teste. Relatórios concluídos preservam seu snapshot; repetições mantêm os produtos/contexto da execução original.

O cliente simulado não pode encerrar uma rotina comercial apenas declarando `done`. Se ele parar ao receber um orçamento válido das duas unidades escolhidas, o executor envia uma confirmação como cliente simulado e aguarda o encaminhamento real do motor Ceci. Essa recuperação não cria o encaminhamento, não aprova o orçamento no banco e não atribui sucesso ao relatório. A atendente ainda precisa receber o atendimento, combinar retirada/entrega e pagamento, obter a confirmação final e registrar a conclusão. Sem orçamento válido, há uma única tentativa limitada de obter uma continuação do cliente; se falhar, o teste fica inconclusivo. Limites de tempo e consumo continuam valendo.

A voz simples da Ceci é aplicada no mesmo construtor de instruções usado em teste e produção, respeitando as configurações salvas no Chatbot e mantendo regras de consulta, identificação de variantes e fidelidade aos valores. O avaliador considera linguagem excessivamente formal e jargão desnecessário, sem penalizar os nomes oficiais dos produtos.
