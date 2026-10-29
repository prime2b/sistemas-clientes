# Radar Recarga — Interface v4

Direção visual aprovada a partir das quatro referências Tupi fornecidas pelo usuário. Preservar a marca Radar Recarga e a lógica de estimativas existente.

## Estrutura

- Cabeçalho branco de64px, trilho de ícones de57px e submenu de240px em desktop.
- Fundo branco, linhas #e2e4eb, ação principal #7000ff, seleção lilás suave.
- Inter variável hospedada localmente, com SIL Open Font License. Títulos de página:28px/600. Subtítulos e códigos de carregador:22px/500 em cinza. Labels de cards:13px muted. Valores de KPI:24px/600. Texto de tabela:14px. A hierarquia mantém esses tamanhos em celular, tablet e desktop; os campos podem quebrar linha.
- Cinco cartões cadastrais acima do mapa; eles filtram a seleção sem inventar disponibilidade ao vivo.
- Mapa Leaflet com base de ruas OpenFreeMap/OSM, pins roxos, popup e lista flutuante à esquerda.
- Página da unidade com abas Agora, Dados da unidade, Fotos e comentários, Dados completos.
- Gaveta à direita com fundo escurecido, campos integrais e botões para copiar e exportar.
- Análise: seis cartões em3×2, distribuição cadastral, corrente AC/DC/desconhecida, tabela e perfil horário preservados, três gráficos de estimativas.

## Cartografia

Leaflet1.9.4 controla navegação, marcadores, popups e acessibilidade. A base vetorial usa OpenFreeMap Liberty, com OpenLayers10.6.1 e ol-mapbox-style13.1.1 para renderização Canvas. Não depende de WebGL, conta ou chave de mapa. Atribuições OCM/OpenFreeMap/OpenMapTiles/OpenStreetMap ficam visíveis. Não há download offline. A malha territorial IBGE é apenas contingência em falha da base de ruas.

## Dados e interação

Todos os valores vêm do catálogo real ou dos perfis locais. Cada ponto mantém o objeto original OCM em `raw`; campos desconhecidos também aparecem na árvore técnica e no JSON exportado. Nulos são 'Não informado'; false é 'Não'; zero é0. A ficha não apresenta firmware, OCPP ou telemetria quando a fonte não os oferece. Valores técnicos originais não são traduzidos no JSON.

Status operacional é cadastral e não significa livre, conectado ou carregando. Comentários e check-ins são históricos. Gráficos interrompem linhas nos dados ausentes; nenhuma lacuna é convertida em zero. Não há faturamento, sessões, energia ou comparação anterior inventados.

## Responsividade

Abaixo de900px o submenu é recolhido e a lista passa para baixo do mapa. Em390px o trilho tem42px, os cartões usam duas colunas, os conectores são reordenados e a gaveta usa toda a largura. Abaixo de1450px a análise coloca perfil e tabela em sequência. Formulários, importação, backup, escopo e referência de100% permanecem acessíveis.

## Preservação

Mesma origem e chave local `radar-recarga-v1`, schemaVersion1. Sem limpar localStorage, reimportar automaticamente ou substituir perfis. IDs OCM únicos, vínculo preserva perfis. Versões anteriores permanecem no histórico do Site.
