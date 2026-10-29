import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
const origin = 'https://ehackerevan.github.io';
const cookie = (value, age) => `__Host-study_session=${value}; Path=/; Secure; HttpOnly; SameSite=None; Partitioned; Max-Age=${age}`;
const digest = value => createHash('sha256').update(value).digest('hex');
const courses = new Set(['trust-exam','fintech-exam-pack','consumer-finance-exam-pack','esg-sustainability-pack','aml-cft-exam-pack','financial-market-ethics-official-bank-113','financial-market-ethics-official-bank-116','investment-insurance-exam','derivatives-sales-exam']);
const codeValid = code => typeof code === 'string' && /^[A-Za-z0-9!@#$%^&*_.-]{12,64}$/.test(code) && /[A-Za-z]/.test(code) && /[0-9]/.test(code);
async function body(req) {
  if (!req.body) return null;
  const reader=req.body.getReader();let size=0, chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw Error('large');}chunks.push(value);}
  const bytes=new Uint8Array(size);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return null;}
}
export default {async fetch(req,env){
  if(req.method !== 'POST' || req.headers.get('Origin') !== origin) return new Response(null,{status:403});
  const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  const reply=(status,data,extra={})=>new Response(data===undefined?null:JSON.stringify(data),{status,headers:{...headers,...extra,...(data===undefined?{}:{'Content-Type':'application/json'})}});
  if (!env.SYNC_PEPPER || !req.headers.get('CF-Connecting-IP')) return reply(503);
  if (!(await env.RATE_LIMITER.limit({key:req.headers.get('CF-Connecting-IP')})).success) return reply(429);
  let data;try {data=await body(req);}catch{return reply(413);}
  if(!data || typeof data!=='object' || Array.isArray(data))return reply(400);
  const action=data.action;
  try {
    if(action==='register'||action==='login'){
      if (!(await env.AUTH_LIMITER.limit({key:req.headers.get('CF-Connecting-IP')})).success) return reply(429);
      if(!codeValid(data.code)||Object.keys(data).some(k=>!['action','code'].includes(k)))return reply(400);
      const lookup=createHmac('sha256',env.SYNC_PEPPER).update(data.code).digest('hex');
      let account=await env.DB.prepare('SELECT id, salt, verifier FROM sync_accounts WHERE lookup = ?').bind(lookup).first();
      if(action==='register'){
        if(account)return reply(409);
        const salt=randomBytes(16).toString('hex');const verifier=scryptSync(data.code,salt,32).toString('hex');const id=crypto.randomUUID();
        const result=await env.DB.prepare('INSERT OR IGNORE INTO sync_accounts (id,lookup,salt,verifier) VALUES (?,?,?,?)').bind(id,lookup,salt,verifier).run();
        if(!result.meta.changes)return reply(409);account={id};
      }else{
        if(!account)return reply(401);
        const actual=scryptSync(data.code,account.salt,32), expected=Buffer.from(account.verifier,'hex');
        if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply(401);
      }
      const token=randomBytes(32).toString('hex'),expires=Math.floor(Date.now()/1000)+60*60*24*30;
      await env.DB.prepare('INSERT INTO sync_sessions (token_hash,account_id,expires) VALUES (?,?,?)').bind(digest(token),account.id,expires).run();
      return reply(200,{account:account.id},{'Set-Cookie':cookie(token,60*60*24*30)});
    }
    const token=(req.headers.get('Cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-study_session='))?.slice('__Host-study_session='.length);
    if(!token||! /^[a-f0-9]{64}$/.test(token))return reply(401);
    const session=await env.DB.prepare('SELECT account_id FROM sync_sessions WHERE token_hash = ? AND expires > ?').bind(digest(token),Math.floor(Date.now()/1000)).first();
    if(!session)return reply(401);
    if(action==='session')return reply(200,{account:session.account_id});
    if(action==='logout'){
      await env.DB.prepare('DELETE FROM sync_sessions WHERE token_hash = ?').bind(digest(token)).run();return reply(200,{}, {'Set-Cookie':cookie('',0)});
    }
    if(action==='read-all'){
      const rows=await env.DB.prepare('SELECT course,revision,data FROM sync_progress WHERE account_id = ?').bind(session.account_id).all();
      return reply(200,{items:rows.results.map(row=>({course:row.course,revision:row.revision,data:JSON.parse(row.data)}))});
    }
    if(!courses.has(data.course))return reply(400);
    if(action==='read'){
      const row=await env.DB.prepare('SELECT revision,data FROM sync_progress WHERE account_id = ? AND course = ?').bind(session.account_id,data.course).first();
      return reply(200,row?{revision:row.revision,data:JSON.parse(row.data)}:{revision:0,data:null});
    }
    if(action==='write'){
      if(!Number.isSafeInteger(data.revision)||data.revision<0 || !data.progress || data.progress.format!=='study-pack-progress-v1'||data.progress.packId!==data.course)return reply(400);
      const value=JSON.stringify(data.progress);if(value.length>800000)return reply(413);
      const result=data.revision===0
       ? await env.DB.prepare('INSERT OR IGNORE INTO sync_progress (account_id,course,revision,data) VALUES (?,?,1,?)').bind(session.account_id,data.course,value).run()
       : await env.DB.prepare('UPDATE sync_progress SET revision=revision+1,data=? WHERE account_id=? AND course=? AND revision=?').bind(value,session.account_id,data.course,data.revision).run();
      return result.meta.changes ? reply(200,{revision:data.revision+1}) : reply(409);
    }
    return reply(404);
  }catch{return reply(503);}
}};
