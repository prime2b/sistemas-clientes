import assert from 'node:assert/strict';
import {MercadoPhone,normalizePhone,samePhone} from '../lib/erp/mercadophone.ts';

const requests=[];
const mockFetch=async(url,options)=>{
  requests.push({url:String(url),options});
  const body=String(url).includes('/stores')
    ? {stores:[{system_unit_id:4046,name:'Center Cell'}]}
    : String(url).includes('/customers')
      ? {items:[{id:77,nome:'Loja Cliente',telefone:'(11) 99999-1234',cpfCnpj:'não deve sair do conector'}],total:1,page:1,limit:20}
    : {items:[{id:1}],total:1,page:1,limit:1};
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
};

const erp=new MercadoPhone('local-test-only-key',mockFetch);
await erp.connect();
const result=await erp.diagnostic('inventory');
const customer=await erp.findCustomerByPhone('5511999991234');

assert.equal(result.totalReportedByErp,1);
assert.deepEqual(customer,{id:77,name:'Loja Cliente'});
assert.equal('cpfCnpj' in customer,false);
assert.equal(normalizePhone('+55 (11) 99999-1234'),'5511999991234');
assert.equal(samePhone('+55 (11) 99999-1234','11999991234'),true);
assert.equal(requests.length,4);
for(const request of requests){
  assert.equal(request.options.method,'GET');
  assert.equal('redirect' in request.options,false,'Use runtime-compatible redirect handling');
  assert.equal(request.options.body,undefined,'ERP connector must remain read-only');
  assert.equal(request.options.headers['X-Unit-Id'],'4046');
}

console.log('PASS: MercadoPhone uses read-only, runtime-compatible requests for unit 4046');
