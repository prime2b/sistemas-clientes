export const CECI_DEFAULT_MODEL='gpt-5.6-terra';
const revision='ceci:modelUpdate:terra-20261025';
/** Apply the requested model once; future explicit model choices remain editable. */
export async function adoptCeciModel(db:D1Database){
  if(await db.prepare('SELECT key FROM settings WHERE key=?').bind(revision).first())return;
  const claim=crypto.randomUUID();
  await db.batch([
    db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').bind(revision,claim),
    db.prepare("UPDATE settings SET value=json_set(value,'$.model',?) WHERE key='config' AND json_valid(value) AND EXISTS (SELECT 1 FROM settings WHERE key=? AND value=?)").bind(CECI_DEFAULT_MODEL,revision,claim)
  ]);
}
