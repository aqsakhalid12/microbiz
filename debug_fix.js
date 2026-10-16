require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const BASE = 'http://localhost:3000';
  const UNIQUE = Date.now();
  let r = await fetch(BASE + '/api/auth/register', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({fullName:'T', email:'d'+UNIQUE+'@e.com', password:'ValidPass123'})});
  let cookie = null;
  let s = r.headers.getSetCookie();
  for (let h of s||[]) { let p = h.split(';')[0]; if (p.startsWith('microbiz.sid=')) cookie = p; }
  if (!cookie) {
    r = await fetch(BASE + '/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({email:'d'+UNIQUE+'@e.com', password:'ValidPass123'})});
    s = r.headers.getSetCookie();
    for (let h of s||[]) { let p = h.split(';')[0]; if (p.startsWith('microbiz.sid=')) cookie = p; }
  }
  r = await fetch(BASE + '/api/customers', {method:'POST', headers:{'content-type':'application/json', cookie}, body: JSON.stringify({name:'D'})});
  let d = await r.json();
  const cid = d.data.id;
  r = await fetch(BASE + '/api/customers/' + cid, {method:'DELETE', headers:{cookie}});
  try { d = await r.json(); } catch(e) { d = {err:'nojson'}; }
  console.log(r.status, d);
  await pool.end();
}
main().catch(e=>{console.error('err'); console.error(e); process.exit(1);});
