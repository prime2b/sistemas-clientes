import handler from 'vinext/server/fetch-handler';
import {runDueAutoSync} from './lib/erp/auto-sync';
import {secret} from './lib/server/core';

export default {
  fetch(request:Request,env:Record<string,unknown>,ctx:ExecutionContext){return handler.fetch(request,env,ctx);},
  scheduled(_event:ScheduledEvent,env:{DB:D1Database},ctx:ExecutionContext){ctx.waitUntil(runDueAutoSync(env.DB,()=>secret('MERCADOPHONE_API_KEY')));}
};
