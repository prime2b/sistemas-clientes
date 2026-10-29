# Radar Recarga
Dashboard em português para Fred estudar concorrentes de recarga de veículos elétricos. Começa por São Paulo, filtros preparados para outras UFs. Fonte inicial: screenshots fornecidos pelo usuário; não há integração ou monitoramento automático ativo.

Métrica: ocupação média estimada. Cada fração horária é interpretada como proporção de tempo ocupado na hora. Referência 100% definida pelo usuário por perfil, sem validação do aplicativo. Não equivale a energia transferida nem histórico observado. O print não comprova a escala. Dados desconhecidos são null, nunca zero. Perfis de sete dias; projeções por calendário local e cobertura explícita. Escopo por conector ou estação não confirmado deve permanecer sinalizado. Não multiplicar tomadas automaticamente.

Persistência local no navegador, com backup/importação JSON. CSV de projeção. Sem APIs pagas, credenciais ou coletor automático.

## Mapa e catálogo real
O módulo de localização usa a exportação oficial pública openchargemap/ocm-export (commit 8e3bedca48ca94807d96b2f5e7ee02cffe63ae54, 22/04/2026). Base inicial BR: 1297 registros com coordenadas válidas e licença aberta, 281 classificados em SP. Uma coordenada inválida foi excluída. UFs ausentes/não reconhecidas foram identificadas espacialmente na malha oficial IBGE BR_UF_2023; a origem derivada aparece no detalhe. Um registro continua com UF não informada. Isto não é um inventário completo nem corrente de todos os eletropostos.

Mapa Leaflet 1.9.4 com ruas OpenFreeMap/OSM renderizadas em Canvas (OpenLayers), atribuição visível e malha IBGE de contingência. Lista usa o mesmo catálogo e filtros (UF/cidade/operador/conector/potência/busca), página12. Cadastrar análise a partir do mapa preserva OCM-ID, coordenadas, operador e atribuição, sem inventar aplicativo nem ocupação. Vincular ao cadastro existente adiciona metadados de localização e preserva os perfis. Não duplicar OCM-ID em análises. Cadastros locais com coordenadas também aparecem. A fonte estática é apenas contingência; a API é consultada no servidor, sem coleta automática de uso.

Compatibilidade: manter a chave localStorage radar-recarga-v1 e schemaVersion1. Coordenadas e campos OCM são opcionais. Backups antigos continuam válidos. A versão publicada anterior continua acessível no histórico para recuperação.

## Consulta atual à API (v3)
O catálogo principal agora usa GET /api/ocm/locations no mesmo endereço do Site. O servidor consulta somente a API oficial OCM, paísBR e licenças abertas, limite10.000. Segredo OPENCHARGEMAP_API_KEY configurado no runtime Sites, nunca no front-end. Cache de cinco minutos e coalescência evitam chamadas duplicadas. Dados geográficos/operadores/conectores são normalizados, sem repassar comentários, contatos ou chave. A data da consulta é distinta da data cadastral.

A tela consulta ao abrir, ao clicar Atualizar agora e a cada cinco minutos com documento visível. Sem automação persistente fora do navegador. Falhas mantêm a última consulta com aviso de desatualização; sem resposta anterior, usa a fotografiaOCM22/04/2026 claramente identificada como contingência. A API não garante disponibilidade/ocupação ao vivo e não cria perfis horários. A chave do localStorage e origem do Site permanecem as mesmas.

A hospedagem agora é WorkerESM: interface em public/, servidor em worker/, build em dist/server/index.js com assets embutidos. Não há dependências de execução adicionais. Testes locais da interface podem usar uma resposta pública real registrada em .qa/, nunca incluída na publicação.

## Ficha integral e visual (v4)

Interface branca e roxa, conforme referências aprovadas. Lista flutuante sobre o mapa, página da unidade e gaveta de dados técnicos. Cada resposta de unidade preserva o POI original em `raw`, além da normalização para filtros. API compact=false, verbose=true e includecomments=true: comentários, mídia, campos nulos e referências expandidas quando disponíveis. Fotos e check-ins são históricos. JSON original pode ser consultado e exportado por unidade. A contingência antiga não tem raw e sua limitação é informada.

Gráficos de projeções por calendário, perfis semanais e percentuais horários usam os perfis já existentes. Não há alteração de schemaVersion1 ou chave local. As seis métricas não somam escopos incompatíveis: horas e média pertencem somente à unidade selecionada; cobertura e contagens são da seleção.
