// A same-origin access layer, not a second application/database deployment.
// Keep the upstream fixed: never accept a destination from query parameters or headers.
export const UPSTREAM = 'https://center-cell-atendimento.fredborrasca.chatgpt.site';
const SESSION = '__Host-cc_session';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const requestHeaders = new Set([
  'accept', 'accept-language', 'content-type', 'user-agent', 'range',
  'if-none-match', 'if-modified-since', 'rsc', 'next-url',
  'next-router-state-tree', 'next-router-prefetch', 'next-router-segment-prefetch',
  'x-vinext-interception-context', 'x-vinext-mounted-slots', 'x-vinext-rsc-render-mode',
  'x-center-relay', 'x-hub-signature-256',
]);
const failure = (error, status) => Response.json({error}, {
  status, headers:{'Cache-Control':'no-store', 'Netlify-CDN-Cache-Control':'no-store'},
});

export async function forward(request, upstreamFetch = fetch) {
  const incoming = new URL(request.url);
  const origin = request.headers.get('origin');
  // Preserve the application's CSRF boundary before translating its origin.
  if (origin && origin !== incoming.origin) return failure('Origem inválida.', 403);
  if (!safeMethods.has(request.method) && request.headers.get('sec-fetch-site') === 'cross-site') {
    return failure('Origem inválida.', 403);
  }
  const target = new URL(UPSTREAM);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const [key,value] of request.headers) if (requestHeaders.has(key)) headers.set(key,value);
  if (origin) headers.set('origin', UPSTREAM);
  const cookies = (request.headers.get('cookie') || '').split(';').map(c=>c.trim());
  const session = cookies.find(c=>c.startsWith(SESSION+'='));
  if (session) headers.set('cookie', session);
  // Never automatically retry writes: a timed-out request may already be saved.
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(58000)]);
  let response;
  try {
    response = await upstreamFetch(target, {
      method:request.method, headers,
      body:safeMethods.has(request.method) ? undefined : await request.arrayBuffer(),
      signal, redirect:'manual',
    });
  } catch {
    return failure('Não foi possível concluir a conexão com a central. Confira o estado do atendimento antes de repetir a ação.', 504);
  }
  const output = new Headers(response.headers);
  for (const key of ['content-encoding','content-length','connection','transfer-encoding','server','set-cookie']) output.delete(key);
  const setCookies = response.headers.getSetCookie();
  // The application session remains host-only, HttpOnly, Secure and SameSite=Lax.
  // Do not transplant Cloudflare or other cookies into the Netlify origin.
  for (const cookie of setCookies) {
    if (cookie.startsWith(SESSION+'=') && !/;\s*Domain=/i.test(cookie)) output.append('set-cookie',cookie);
  }
  const location = output.get('location');
  if (location) {
    const redirect = new URL(location,target);
    if (redirect.origin === UPSTREAM) output.set('location',incoming.origin+redirect.pathname+redirect.search+redirect.hash);
  }
  // Never place authenticated HTML, RSC or API responses in the shared CDN cache.
  output.set('cache-control','no-store');
  output.set('netlify-cdn-cache-control','no-store');
  output.set('x-content-type-options','nosniff');
  return new Response(request.method === 'HEAD' ? null : response.body, {
    status:response.status, statusText:response.statusText, headers:output,
  });
}

export default async function handler(request) { return forward(request); }
export const config = {path:'/*', excludedPath:['/_next/*'], preferStatic:true};
