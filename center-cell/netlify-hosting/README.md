# Center Cell no Netlify

Esta pasta publica uma **camada de acesso híbrida**. Páginas dinâmicas, APIs, SSR e autenticação são encaminhados ao sistema existente em `https://center-cell-atendimento.fredborrasca.chatgpt.site`. O backend, D1, integrações, tarefas agendadas e credenciais continuam na Cloudflare/Sites. Não é uma migração do backend para o Netlify.

## Configuração no Netlify

- Repositório: `prime2b/sistemas-clientes`, branch `main`.
- Base directory: `center-cell/netlify-hosting`.
- Build: `node --test gateway.test.mjs && node build.mjs`.
- Publish: `dist`.
- Functions: `functions`.
- Framework: nenhum; esta pasta não utiliza o adaptador Next.js.
- Node 24. Sem chaves de integração ou cópia de banco no Netlify.

Os recursos públicos existentes ficam no CDN. Os bundles versionados `/_next/*` são servidos pelo backend por rewrite. As páginas e APIs usam uma Netlify Function com preservação dos códigos HTTP, RSC, cookies seguros e validação de origem antes do encaminhamento. Respostas autenticadas não são armazenadas no cache compartilhado. A função não repete requisições automaticamente.

O cookie de login fica restrito ao domínio acessado. As credenciais de usuário continuam as mesmas; a sessão do endereço Sites não é compartilhada automaticamente com o novo domínio.

## Dependências e limites

O endereço Sites precisa continuar publicado e disponível. Atualizações do backend passam a ser vistas neste acesso; atualizações dos recursos públicos requerem novo build no Netlify. A versão de origem inicial é a 73, commit Sites `6aa3f7a87f20114ada47fc0253076505766c255f`.

O Netlify impõe 60 segundos por chamada síncrona. O encaminhamento encerra a espera aos 58 segundos com erro explícito, sem repetir uma escrita: a operação pode continuar no backend, então consulte o estado salvo antes de repeti-la. Não houve alteração nos limites do motor Ceci. Os webhooks continuam no endereço já configurado; publicar esta camada não conecta nem ativa o WhatsApp.

`.netlify/` está ignorado no Git. Nunca publique credenciais, cookies, dados de clientes ou arquivos de estado do CLI.
