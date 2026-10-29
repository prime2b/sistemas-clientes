import {getDatabase} from '@netlify/database';
import {createWeChargePilot} from '../../worker/pilot-service.mjs';
import {postgresDB} from '../../worker/postgres-db.mjs';
const pilot=createWeChargePilot();
export default async()=>{await pilot.collect(postgresDB(getDatabase().pool));return new Response(null,{status:204});};
export const config={schedule:'*/5 * * * *'};
