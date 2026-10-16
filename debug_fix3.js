require('dotenv').config();
const BASE = 'http://localhost:3000';
async function main() {
  const UNIQUE = Date.now();
  let r = await fetch(BASE + '/api/auth/register', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({fullName:'T', email:'d'+UNIQUE+'@e.com', password:'ValidPass123'})});
  let cookie = null;
  for (let h of (r.headers.getSetCookie && r.headers.getSetCookie()) || []) { let p = h.split(';')[0]; if (p.startsWith('microbiz.sid=')) cookie = p; }
  if (!cookie && r.headers.get('set-cookie')) { let p = r.headers.get('set-cookie').split(';')[0]; if (p.startsWith('microbiz.sid=')) cookie = p; }
  if (!cookie) {
    r = await fetch(BASE + '/api/auth/login', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({email:'d'+UNIQUE+'@e.com', password:'ValidPass123'})});
    for (let h of (r.headers.getSetCookie && r.headers.getSetCookie()) || []) { let p = h.split(';')[0]; if (p.startsWith('microbiz.sid=')) cookie = p; }
    if (!cookie && r.headers.get('set-cookie')) { let p = r.headers.get('set-cookie').split(';')[0]; if (p.startsWith('microbiz.sid=')) cookie = p; }
  }
  r = await fetch(BASE + '/api/customers', {method:'POST', headers:{'content-type':'application/json', cookie}, body: JSON.stringify({name:'D'})});
  let d = await r.json();
  console.log(d);
}
main().catch(e=>{console.error(e);});
