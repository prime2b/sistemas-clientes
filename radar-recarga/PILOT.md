# Piloto WeCharge — São Paulo

O piloto armazena consultas ao mapa público WeCharge em D1 (binding DB). A fonte não exige login e fornece status atuais, não histórico. Os registros podem agregar equipamentos/conectores; cpoId representa a rede. IDs wc- são gerados com rede, nome e coordenadas. Alterações nesses campos podem gerar novo ID. Não há associação automática com cadastros OCM.

## Operação por tarefa na nuvem

1. Obtenha o Site pelo Sites get_site, usando o project_id deste repositório. Confirme que continua owner-private. Não amplie o acesso.
2. Obtenha o acesso de serviço suportado retornado pelo Site. Envie-o apenas ao mesmo Site no cabeçalho OAI-Sites-Authorization: Bearer <valor>. Mantenha a credencial em memória/stdin, nunca em arquivos, código, argumentos, mensagens ou logs.
3. Envie POST /api/pilot/wecharge/collect ao current_live_url retornado. A rota consulta a fonte pública https://admin.wecharge.com.br/api/maps/stations?max=9999 e salva apenas registros de SP com coordenadas válidas.
4. Confirme a resposta por GET /api/pilot/wecharge. Verifique meta.lastCaptureAt, meta.total e meta.lastAttempt.status. Um resultado collected:false indica que outro processo já iniciou a consulta no mesmo intervalo de cinco minutos; leia a última tentativa antes de declarar sucesso. Se ainda estiver running, faça uma única leitura posterior. Falha não equivale a coleta concluída.
5. Não publique outra versão durante atualizações rotineiras. Não crie histórico retroativo ou amostras a partir de cache antigo. Se a fonte falhar, mantenha os dados anteriores e registre/informe a falha. Não tente contornar bloqueios ou autenticação do provedor.

A tarefa vinculada deve rodar uma vez por hora (America/Sao_Paulo), maior frequência suportada neste ambiente. A seção aberta e visível complementa com consultas a cada cinco minutos. Uma trava durável por intervalo evita duplicatas entre abas e tarefa. Não repetir consultas em loop.

## Cálculo

Somente intervalos com duas amostras AVAILABLE/CHARGING, separados por até 75 minutos, têm cobertura. Mudanças são estimadas no ponto médio; estados iguais também são uma hipótese entre amostras, não prova de sessão contínua. Não extrapolar antes/depois da série. Offline, indisponível e lacunas não viram zero. Os minutos são divididos por hora/dia no fuso America/Sao_Paulo e somados por dia/semana/mês/trimestre/semestre civil. Cobertura divide tempo observado pelo tempo decorrido no período, incluindo a parte anterior ao início do piloto como desconhecida. Sem duas amostras válidas, horas ficam nulas. Não se inferem energia, faturamento, sessões, quantidade de conectores ou tempo efetivo transferindo energia.

## Persistência e validação

Schema em db/schema.ts; migrations Drizzle schema-only versionadas em drizzle/. A plataforma aplica as migrations ao publicar. Não criar tabelas durante requisições. Coleta grava pontos, amostras e conclusão na mesma transação D1 batch; falhas deixam a última base íntegra. GET não consulta o provedor e usa Cache-Control privado/no-store.

Perfis manuais continuam no localStorage radar-recarga-v1. Mapa OCM e chave hospedada são preservados. O piloto usa banco separado desses perfis, compartilhado apenas dentro do Site privado.

Prévia local usa SQLite em memória, aplicando as mesmas migrations, e uma captura real arquivada em .qa/wecharge-capture.json (ignorada no Git). O horário da captura é preservado, marcado como prévia, sem inventar novas observações. Testes usam fixtures explícitas em memória e nunca alimentam produção.

Verificação: npm run build; npm test; node scripts/validate-artifact.mjs. O coletor deve ser exercitado em produção por acesso de serviço e o resultado persistido lido antes de habilitar a tarefa.
