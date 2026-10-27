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
