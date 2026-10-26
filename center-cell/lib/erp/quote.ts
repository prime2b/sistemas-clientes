import { MercadoPhone, ErpError, STORE_ID } from './mercadophone.ts';
import type { RawItem } from './mercadophone.ts';

export type PriceField = 'valorVenda' | 'valorVenda2' | 'valorVenda3' | 'valorPrazo';
export type CustomerProfile = 'lojista' | 'consumidor_final' | 'nao_identificado';
export type QuotePolicy = { priceField: PriceField; approvedBy: string }
  | { customerProfile: CustomerProfile; approvedBy: string };
const PRICE_FIELDS = new Set(['valorVenda', 'valorVenda2', 'valorVenda3', 'valorPrazo']);
const PROFILES = new Set(['lojista', 'consumidor_final', 'nao_identificado']);
export function assertPolicy(policy: QuotePolicy | null): asserts policy is QuotePolicy {
  if (!policy || typeof policy.approvedBy !== 'string' || !policy.approvedBy.trim()
    || ('priceField' in policy && 'customerProfile' in policy)
    || !('priceField' in policy ? PRICE_FIELDS.has(policy.priceField)
      : 'customerProfile' in policy && PROFILES.has(policy.customerProfile))) {
    throw new ErpError('PRICE_POLICY_REQUIRED');
  }
}
/** Perfil deve vir do contexto comercial do backend; não liberar tabela por palpite da IA. */
export function centerCellPolicy(customerProfile: CustomerProfile): QuotePolicy {
  const policy = { customerProfile, approvedBy: 'Orientação da cliente encaminhada por Fred em 2026-09-21' };
  assertPolicy(policy);
  return Object.freeze(policy);
}

export function priceFieldForItem(item: RawItem, policy: QuotePolicy | null): PriceField {
  assertPolicy(policy);
  // Compatibilidade com integrações administrativas que escolhem uma tabela explicitamente.
  if ('priceField' in policy) return policy.priceField;
  if (policy.customerProfile === 'lojista') return 'valorVenda';
  const type = String(item.tipoProdutoId ?? '');
  const accessory = truthyFlag(item.snAcessorio) || ['51875', '78020'].includes(type);
  const other = truthyFlag(item.snPeca) || truthyFlag(item.snServico)
    || ['60419', '51876', '71747'].includes(type);
  if ((accessory && other) || (!accessory && !other)) throw new ErpError('PRODUCT_CLASSIFICATION_REVIEW');
  if (accessory) {
    if (policy.customerProfile === 'nao_identificado') throw new ErpError('CUSTOMER_PROFILE_REQUIRED');
    // Não substituir valorVenda2 vazio pelo preço do lojista.
    return 'valorVenda2';
  }
  // A cliente restringiu a explicação de preço duplo a acessórios. Outros casos exigem revisão.
  if (item.valorVenda2 !== null && item.valorVenda2 !== undefined) throw new ErpError('SECOND_PRICE_SCOPE_REVIEW');
  return 'valorVenda';
}
/** Valores monetários tratados em centavos; null nunca vira zero. */
export function cents(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  const n = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(n) ? n : null;
}
function truthyFlag(value: unknown): boolean { return value === true || value === 1 || value === '1'; }
function falseFlag(value: unknown): boolean { return value === false || value === 0 || value === '0'; }
/** Projeção com campos permitidos. Exclui custos, fornecedores, fiscais e dados pessoais. */
export function productForQuote(item: RawItem, policy: QuotePolicy | null) {
  assertPolicy(policy);
  const priceField = priceFieldForItem(item, policy);
  const price = cents(item[priceField]);
  const name = typeof item.nome === 'string' && item.nome.trim() ? item.nome.trim()
    : typeof item.aparelhoDescricao === 'string' ? item.aparelhoDescricao.trim() : '';
  const stock = typeof item.quantidade === 'number' && Number.isFinite(item.quantidade) ? item.quantidade : null;
  const eligible = falseFlag(item.excluido) && truthyFlag(item.snExibirCatalogo)
    && (item.produtoDisponibilidadeId === 1 || item.produtoDisponibilidadeId === '1')
    && stock !== null && stock > 0;
  if (!Number.isSafeInteger(item.id) || Number(item.id) < 1 || !name) throw new ErpError('INVALID_PRODUCT');
  return { id: Number(item.id), name, stock, eligible, priceCents: price, priceField,
    canQuote: eligible && price !== null && price > 0 };
}
export type QuoteLine = { productId: number; name: string; quantity: number; unitCents: number; totalCents: number; priceField: PriceField };
export type QuoteDraft = { storeId: number; checkedAt: number; priceField: PriceField | 'mixed'; lines: QuoteLine[]; totalCents: number; reserved: false };

/** Uso interno pelo backend, após o cliente identificar o produto desejado.
 * A confirmação de compatibilidade é uma etapa anterior, não inferida pelo nome. */
export async function prepareQuote(erp: Pick<MercadoPhone, 'product'>,
  requested: { productId: number; quantity: number }[], policy: QuotePolicy | null): Promise<QuoteDraft> {
  assertPolicy(policy);
  if (!Array.isArray(requested) || requested.length === 0 || requested.length > 30) throw new ErpError('INVALID_QUOTE_ITEMS');
  const aggregated = new Map<number, number>();
  for (const row of requested) {
    if (!Number.isSafeInteger(row.productId) || row.productId < 1 || !Number.isSafeInteger(row.quantity) || row.quantity < 1) throw new ErpError('INVALID_QUANTITY_OR_ID');
    const quantity = (aggregated.get(row.productId) ?? 0) + row.quantity;
    if (!Number.isSafeInteger(quantity)) throw new ErpError('INVALID_QUANTITY_OR_ID');
    aggregated.set(row.productId, quantity);
  }
  const lines: QuoteLine[] = [];
  let checkedAt = Date.now();
  for (const [id, quantity] of aggregated) {
    const found = await erp.product(id);
    if (!found) throw new ErpError('PRODUCT_NOT_FOUND');
    if (!Number.isFinite(found.checkedAt) || found.checkedAt > Date.now() || Date.now() - found.checkedAt > 60000) throw new ErpError('STALE_INVENTORY');
    checkedAt = Math.min(checkedAt, found.checkedAt);
    const product = productForQuote(found.item, policy);
    if (product.id !== id) throw new ErpError('PRODUCT_ID_MISMATCH');
    if (!product.eligible || product.stock === null || product.stock < quantity) throw new ErpError('INSUFFICIENT_OR_UNAVAILABLE_STOCK');
    if (!product.canQuote || product.priceCents === null) throw new ErpError('PRICE_UNAVAILABLE');
    const totalCents = product.priceCents * quantity;
    if (!Number.isSafeInteger(totalCents)) throw new ErpError('INVALID_TOTAL');
    lines.push({ productId: id, name: product.name, quantity, unitCents: product.priceCents, totalCents, priceField: product.priceField });
  }
  if (Date.now() - checkedAt > 60000) throw new ErpError('STALE_INVENTORY');
  const totalCents = lines.reduce((total, line) => total + line.totalCents, 0);
  if (!Number.isSafeInteger(totalCents)) throw new ErpError('INVALID_TOTAL');
  const priceField = lines.every(line => line.priceField === lines[0].priceField) ? lines[0].priceField : 'mixed';
  return { storeId: STORE_ID, checkedAt, priceField, lines, totalCents, reserved: false };
}

/** Única projeção do orçamento destinada ao modelo e ao cliente; omite metadados internos. */
export function customerQuoteView(draft: QuoteDraft) {
  return { items: draft.lines.map(line => ({ name: line.name, quantity: line.quantity,
    unitCents: line.unitCents, totalCents: line.totalCents, requestedQuantityAvailable:true })),
    totalCents: draft.totalCents, availabilityCheckedAt:draft.checkedAt, reserved: draft.reserved,
    note:'Disponibilidade confirmada para as quantidades solicitadas. O orçamento não reserva estoque.' };
}

function brl(valueCents: number) {
  if (!Number.isSafeInteger(valueCents) || valueCents < 0) throw new ErpError('INVALID_TOTAL');
  return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(valueCents/100);
}

/** Resposta financeira montada no backend. O modelo não reescreve nem calcula valores. */
export function customerQuoteText(draft: QuoteDraft) {
  if (!draft.lines.length || draft.priceField !== 'valorVenda') throw new ErpError('UNVERIFIED_PRICE_SOURCE');
  const items=draft.lines.flatMap((line,index)=>[
    ...(index?['']:[]),
    `${index+1}. ${line.name}`,
    `Quantidade: ${line.quantity}`,
    `Valor unitário: ${brl(line.unitCents)}`,
    `Subtotal: ${brl(line.totalCents)}`
  ]);
  return [
    'Conferi agora no nosso sistema:',
    '',
    ...items,
    '',
    `Total: ${brl(draft.totalCents)}`,
    '',
    'Os valores e a disponibilidade foram confirmados agora no sistema da CenterCell. O orçamento não reserva estoque.',
    'Quer acrescentar outro item ou falar com a equipe para concluir?'
  ].join('\n');
}

/** Prepara payload documentado; não grava no ERP. IDs vêm do backend autenticado. */
export function estimatePayload(draft: QuoteDraft, customerId: number, salespersonId: number) {
  if (!Number.isSafeInteger(customerId) || customerId < 1 || !Number.isSafeInteger(salespersonId) || salespersonId < 1) throw new ErpError('CUSTOMER_AND_SALESPERSON_REQUIRED');
  if (draft.storeId !== STORE_ID || !Number.isFinite(draft.checkedAt) || draft.checkedAt > Date.now()
    || Date.now() - draft.checkedAt > 60000) throw new ErpError('STALE_OR_INVALID_DRAFT');
  return { clienteId: customerId, vendedorId: salespersonId,
    itens: draft.lines.map(line => ({ produtoId: line.productId, quantidade: line.quantity,
      valor: line.unitCents / 100, desconto: 0, produtoDescricao: line.name })) };
}
