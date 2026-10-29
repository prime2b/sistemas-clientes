import {sqliteTable,text,real,integer,index,primaryKey} from 'drizzle-orm/sqlite-core';
export const pilotRuns=sqliteTable('pilot_runs',{
 id:text('id').primaryKey(),startedAt:text('started_at').notNull(),finishedAt:text('finished_at'),status:text('status').notNull(),count:integer('count').notNull().default(0),error:text('error')
},t=>[index('pilot_runs_time_idx').on(t.startedAt)]);
export const pilotPoints=sqliteTable('pilot_points',{
 id:text('id').primaryKey(),name:text('name').notNull(),cpoId:text('cpo_id').notNull(),city:text('city').notNull(),uf:text('uf').notNull(),lat:real('lat').notNull(),lng:real('lng').notNull(),address:text('address').notNull(),raw:text('raw').notNull(),firstSeenAt:text('first_seen_at').notNull(),lastSeenAt:text('last_seen_at').notNull()
});
export const pilotSamples=sqliteTable('pilot_samples',{
 runId:text('run_id').notNull().references(()=>pilotRuns.id),pointId:text('point_id').notNull().references(()=>pilotPoints.id),observedAt:text('observed_at').notNull(),status:text('status').notNull()
},t=>[primaryKey({columns:[t.runId,t.pointId]}),index('pilot_samples_point_time_idx').on(t.pointId,t.observedAt)]);
