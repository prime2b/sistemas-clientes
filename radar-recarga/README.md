# Radar Recarga

Mapa de eletropostos com dados Open Charge Map e piloto WeCharge em São Paulo.

## Netlify

Instale com `npm ci`; execute `npm test` e `npm run build`. Configure `OPENCHARGEMAP_API_KEY` apenas no ambiente protegido do Netlify. O deploy aplica migrations PostgreSQL de `netlify/database/migrations/`, provisiona Netlify Database e publica a interface de `public/`. A função `collect-wecharge` consulta a fonte a cada cinco minutos.

O projeto deve permanecer privado, com proteção de acesso do Netlify. Nunca inclua segredos ou `.netlify` no Git. A coleta registra somente dados públicos da WeCharge, com trava de cinco minutos. Falhas preservam os registros anteriores.

A importação inicial contém 265 amostras reais, com horários originais. Identificadores `import:` distinguem as consultas migradas; seu início é representado pelo horário observado, pois a fonte exportada não inclui o início original de todas as consultas. Não há histórico inventado. O instante de corte está documentado na migration; coletas posteriores no endereço anterior continuam lá até a validação da nova hospedagem.

Perfis manuais ficam no navegador por endereço. Para transferi-los, use Salvar backup no endereço anterior e Importar base no novo. Não feche a base antiga antes de conferir a importação.

A adaptação PostgreSQL preserva os IDs dos pontos e a lógica de cobertura. As horas são estimativas por amostragem; offline, indisponível e intervalos acima de 75 minutos ficam sem cobertura. Não medem energia ou duração exata das sessões.
