/** Bounded diagnostics: no upstream messages, request bodies, credentials or SQL values. */
export function automaticErrorCode(error:unknown){
 const text=error instanceof Error?error.message:'';
 if(/Too many (?:API requests|subrequests|SQL queries)/i.test(text))return 'AUTO_REQUEST_LIMIT';
 if(/malformed JSON|JSON.*(?:parse|unexpected)/i.test(text))return 'AUTO_INVALID_JSON';
 if(/D1_ERROR|SQLITE|database/i.test(text))return 'AUTO_STORAGE_ERROR';
 if(/not a function/.test(text))return 'AUTO_FUNCTION_ERROR';
 if(/before initialization/.test(text))return 'AUTO_INITIALIZATION_ERROR';
 if(/undefined|null/.test(text))return 'AUTO_MISSING_STATE';
 if(/^(?:AUTO_|CECI_|ERP_)[A-Z_]+$/.test(text))return text;
 return 'AUTO_EXECUTION_ERROR';
}
export function logAutomaticError(error:unknown,stage:string,id:string){const code=automaticErrorCode(error);console.error('playground_automatic_error',JSON.stringify({code,stage,id,name:error instanceof Error?error.name:'Unknown',frames:error instanceof Error?error.stack?.split('\n').slice(1,4).map(s=>s.trim()):[]}));return code;}
