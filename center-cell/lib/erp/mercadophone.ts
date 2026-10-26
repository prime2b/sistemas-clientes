/** Conector exclusivamente de leitura. Não envia operações POST ao ERP. */
export const STORE_ID = 4046;
const ORIGIN = 'https://platform.mercadophone.tech';
export type RawItem = Record<string, unknown>;
export type Page = { items: RawItem[]; total: number; page: number; limit: number };
export type CustomerMatch = { id: number; name: string };
export class ErpError extends Error {
  code: string;
  status: number | undefined;
  retryAfter: string | null;
  constructor(code: string, status?: number, retryAfter: string | null = null) {
    super(code); this.name = 'ErpError'; this.code = code;
    this.status = status; this.retryAfter = retryAfter;
  }
}
function object(value: unknown): value is RawItem {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function positive(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
export function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}
function nationalPhone(value: unknown) {
  const digits = normalizePhone(value);
  return digits.startsWith('55') && (digits.length === 12 || digits.length === 13) ? digits.slice(2) : digits;
}
export function samePhone(left: unknown, right: unknown) {
  const a = nationalPhone(left), b = nationalPhone(right);
  return a.length >= 10 && b.length >= 10 && a === b;
}
export class MercadoPhone {
  #key: string;
  #fetch: typeof fetch;
  #connected = false;
  constructor(key: string, fetchImpl: typeof fetch = fetch) {
    if (!key?.trim()) throw new ErpError('API_KEY_REQUIRED');
    this.#key = key.trim(); this.#fetch = fetchImpl;
  }
  async #get(path: string, query: Record<string, string | number> = {}): Promise<RawItem> {
    const url = new URL(path, ORIGIN);
    for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
    let response: Response;
    try {
      response = await this.#fetch(url, {
        // Sites runs on Cloudflare Workers. Use the runtime-compatible default
        // redirect behavior; every allowed path still starts from the fixed ERP origin.
        method: 'GET', signal: AbortSignal.timeout(30000),
        headers: { 'X-API-Key': this.#key, 'X-Unit-Id': String(STORE_ID), Accept: 'application/json' }
      });
    } catch (error) {
      const detail = error instanceof Error
        ? {name:error.name, message:error.message.split(this.#key).join('[REDACTED]').slice(0,240)}
        : {name:'UnknownError', message:'unknown'};
      console.error('mercadophone_request_failed', JSON.stringify(detail));
      throw new ErpError('ERP_NETWORK_ERROR');
    }
    if (!response.ok) throw new ErpError('ERP_HTTP_ERROR', response.status, response.headers.get('retry-after'));
    let data: unknown;
    try { data = await response.json(); } catch { throw new ErpError('ERP_INVALID_JSON'); }
    if (!object(data)) throw new ErpError('ERP_INVALID_RESPONSE');
    return data;
  }
  async connect(): Promise<{ id: number; name: string }> {
    this.#connected = false;
    const data = await this.#get('/api/v1/stores');
    if (!Array.isArray(data.stores)) throw new ErpError('ERP_INVALID_STORES');
    const store = data.stores.find((s: unknown) => object(s) && s.system_unit_id === STORE_ID);
    if (!object(store) || typeof store.name !== 'string') throw new ErpError('CENTER_CELL_ACCESS_REQUIRED');
    this.#connected = true;
    return { id: STORE_ID, name: store.name };
  }
  async #page(path: string, query: Record<string, string | number>): Promise<Page> {
    if (!this.#connected) throw new ErpError('CONNECT_FIRST');
    const data = await this.#get(path, query);
    if (!Array.isArray(data.items) || !data.items.every(object)
      || !Number.isSafeInteger(data.total) || Number(data.total) < 0
      || !positive(data.page) || !positive(data.limit)
      || data.page !== query.page || data.limit !== query.limit || data.items.length > Number(query.limit)) {
      throw new ErpError('ERP_INVALID_PAGE');
    }
    return data as Page;
  }
  async inventory(options: { page?: number; limit?: number; codigoProduto?: string; tipoProdutoId?: number } = {}): Promise<Page> {
    const { page = 1, limit = 100, codigoProduto, tipoProdutoId } = options;
    if (!positive(page) || !positive(limit) || limit > 300) throw new ErpError('INVALID_PAGINATION');
    const query: Record<string, string | number> = { page, limit };
    if (codigoProduto !== undefined) {
      if (typeof codigoProduto !== 'string' || !codigoProduto.trim() || codigoProduto.length > 100) throw new ErpError('INVALID_PRODUCT_FILTER');
      query.codigoProduto = codigoProduto;
    }
    if (tipoProdutoId !== undefined) {
      if (!positive(tipoProdutoId)) throw new ErpError('INVALID_PRODUCT_TYPE');
      query.tipoProdutoId = tipoProdutoId;
    }
    return this.#page('/api/v1/inventory', query);
  }
  async customers(options: { page?: number; limit?: number; telefone?: string } = {}): Promise<Page> {
    const { page = 1, limit = 20, telefone } = options;
    if (!positive(page) || !positive(limit) || limit > 300) throw new ErpError('INVALID_PAGINATION');
    const query: Record<string, string | number> = { page, limit };
    if (telefone !== undefined) {
      const digits = normalizePhone(telefone);
      if (digits.length < 10 || digits.length > 15) throw new ErpError('INVALID_CUSTOMER_PHONE');
      query.telefone = digits;
    }
    return this.#page('/api/v1/customers', query);
  }
  /** Consulta direcionada por telefone e devolve somente a identidade mínima necessária. */
  async findCustomerByPhone(phone: string): Promise<CustomerMatch | null> {
    const digits = normalizePhone(phone);
    if (digits.length < 10 || digits.length > 15) throw new ErpError('INVALID_CUSTOMER_PHONE');
    const candidates = [...new Set([digits, nationalPhone(digits)])];
    const matches = new Map<number, CustomerMatch>();
    for (const candidate of candidates) {
      const page = await this.customers({ telefone: candidate, limit: 20 });
      for (const item of page.items) {
        if (!samePhone(item.telefone, digits) || !positive(item.id)) continue;
        const name = typeof item.nome === 'string' ? item.nome.trim().slice(0,100) : '';
        matches.set(item.id, {id:item.id,name});
      }
    }
    if (matches.size > 1) throw new ErpError('AMBIGUOUS_CUSTOMER_PHONE');
    return matches.values().next().value ?? null;
  }
  /** Filtro por ID observado na Center Cell. Confere também o ID retornado. */
  async product(id: number): Promise<{ item: RawItem; checkedAt: number } | null> {
    if (!positive(id)) throw new ErpError('INVALID_PRODUCT_ID');
    const data = await this.inventory({ codigoProduto: String(id), limit: 100 });
    const matches = data.items.filter(item => item.id === id);
    if (matches.length > 1) throw new ErpError('DUPLICATE_PRODUCT_ID');
    return matches.length === 1 ? { item: matches[0], checkedAt: Date.now() } : null;
  }
  /** Índice para descoberta. Não usar este snapshot para emitir preços sem reconsulta. */
  async scanInventory(maxPages = 60): Promise<RawItem[]> {
    if (!positive(maxPages) || maxPages > 1000) throw new ErpError('INVALID_SCAN_LIMIT');
    const result: RawItem[] = [], ids = new Set<number>();
    for (let page = 1; page <= maxPages; page++) {
      const data = await this.inventory({ page, limit: 300 });
      for (const item of data.items) {
        if (!positive(item.id) || ids.has(item.id)) throw new ErpError('UNSTABLE_INVENTORY_PAGINATION');
        ids.add(item.id); result.push(item);
      }
      // A API retorna total global mesmo quando os itens estão filtrados.
      if (data.items.length < 300) return result;
    }
    throw new ErpError('INCOMPLETE_INVENTORY_SCAN');
  }
  /** Retorna somente metadados; não entrega dados pessoais ao log ou à IA. */
  async diagnostic(resource: 'inventory' | 'customers' | 'estimates' | 'salespeople' | 'availability' | 'product-types' | 'payment-methods') {
    const paths: Record<string, string> = {
      inventory: '/api/v1/inventory', customers: '/api/v1/customers', estimates: '/api/v1/estimates',
      salespeople: '/api/v1/catalog/salespeople', availability: '/api/v1/catalog/availability',
      'product-types': '/api/v1/catalog/product-types', 'payment-methods': '/api/v1/finance/payment-methods'
    };
    if (!Object.hasOwn(paths, resource)) throw new ErpError('RESOURCE_NOT_ALLOWED');
    const data = await this.#page(paths[resource], { page: 1, limit: 1 });
    return { resource, totalReportedByErp: data.total, sampleCount: data.items.length,
      fields: [...new Set(data.items.flatMap(item => Object.keys(item)))].sort() };
  }
}
