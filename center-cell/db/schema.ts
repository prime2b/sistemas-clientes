// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sqliteTable, text, integer, index, primaryKey } from 'drizzle-orm/sqlite-core';
export const settings = sqliteTable('settings', { key: text('key').primaryKey(), value: text('value').notNull() });
export const conversations = sqliteTable('conversations', {
 id: text('id').primaryKey(), name: text('name').notNull(), phone: text('phone').notNull().default(''), channel: text('channel').notNull().default('test'),
 profile: text('profile').notNull().default('nao_identificado'), status: text('status').notNull().default('bot'), assigned: text('assigned').notNull().default(''),
 notes: text('notes').notNull().default(''), updated: integer('updated').notNull(), lastInbound: integer('last_inbound').notNull().default(0), archivedAt: integer('archived_at').notNull().default(0),
 customerStatus: text('customer_status').notNull().default('unchecked'), customerId: integer('customer_id'),
 customerName: text('customer_name').notNull().default(''), customerCheckedAt: integer('customer_checked_at').notNull().default(0)
}, t=>[index('conversation_updated_idx').on(t.updated),index('conversation_phone_idx').on(t.phone)]);
export const messages = sqliteTable('messages', {id:text('id').primaryKey(), conversationId:text('conversation_id').notNull().references(()=>conversations.id), role:text('role').notNull(), body:text('body').notNull(), status:text('status').notNull().default('saved'), cardData:text('card_data').notNull().default(''), created:integer('created').notNull(), deletedAt:integer('deleted_at').notNull().default(0)},t=>[index('message_conversation_idx').on(t.conversationId,t.created)]);
export const products = sqliteTable('products', {id:integer('id').primaryKey(),name:text('name').notNull(),search:text('search').notNull(),category:text('category').notNull(),data:text('data').notNull(),synced:integer('synced').notNull(),type:text('type').notNull().default('outros'),brand:text('brand').notNull().default('Outras'),models:text('models').notNull().default('[]'),variant:text('variant').notNull().default(''),displayName:text('display_name').notNull().default(''),enriched:integer('enriched').notNull().default(0)},t=>[index('product_type_idx').on(t.type),index('product_brand_idx').on(t.brand)]);
export const quotes = sqliteTable('quotes', {id:text('id').primaryKey(),name:text('name').notNull(),profile:text('profile').notNull(),conversationId:text('conversation_id').notNull().default(''),data:text('data').notNull(),total:integer('total').notNull(),created:integer('created').notNull(),deletedAt:integer('deleted_at').notNull().default(0),supersededBy:text('superseded_by').notNull().default('')},t=>[index('quote_created_idx').on(t.created)]);

export const productStage = sqliteTable('product_stage', {
 runId:text('run_id').notNull(),id:integer('id').notNull(),name:text('name').notNull(),search:text('search').notNull(),category:text('category').notNull(),data:text('data').notNull(),synced:integer('synced').notNull(),type:text('type').notNull().default('outros'),brand:text('brand').notNull().default('Outras'),models:text('models').notNull().default('[]'),variant:text('variant').notNull().default(''),displayName:text('display_name').notNull().default(''),enriched:integer('enriched').notNull().default(0)
},t=>[primaryKey({columns:[t.runId,t.id]})]);
export const catalogActivity = sqliteTable('catalog_activity',{id:text('id').primaryKey(),day:integer('day').notNull(),kind:text('kind').notNull(),item:text('item').notNull(),count:integer('count').notNull().default(0)},t=>[index('catalog_activity_day_idx').on(t.day,t.kind)]);

export const attendantAccounts = sqliteTable('attendant_accounts', {
 slot:integer('slot').primaryKey(),
 email:text('email').notNull().unique(),
 userId:text('user_id'),
 created:integer('created').notNull()
});

export const appUsers = sqliteTable('app_users', {
 id:text('id').primaryKey(),role:text('role').notNull(),slot:integer('slot').unique(),username:text('username').notNull().unique(),email:text('email').notNull().unique(),
 displayName:text('display_name').notNull(),phone:text('phone').notNull().default(''),avatar:text('avatar').notNull().default(''),passwordHash:text('password_hash').notNull(),salt:text('salt').notNull(),
 active:integer('active').notNull().default(1),presence:text('presence').notNull().default('available'),mustChangePassword:integer('must_change_password').notNull().default(1),created:integer('created').notNull(),updated:integer('updated').notNull(),lastLogin:integer('last_login').notNull().default(0)
});
export const appSessions = sqliteTable('app_sessions', {
 tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>appUsers.id),created:integer('created').notNull(),expires:integer('expires').notNull()
},t=>[index('app_session_user_idx').on(t.userId)]);
export const loginThrottle = sqliteTable('login_throttle', {
 key:text('key').primaryKey(),failures:integer('failures').notNull(),windowStart:integer('window_start').notNull(),lockUntil:integer('lock_until').notNull().default(0)
});
