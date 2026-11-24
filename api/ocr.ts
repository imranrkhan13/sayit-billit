import type {IncomingMessage,ServerResponse} from 'node:http';
import {authorized,equal,session,digest,RedisStore,HostedClient,checkReservations} from '../src/hosted.js';
import {extractInterfazeOCR} from '../src/interfaze-ocr.js';
export const config={maxDuration:300};
export default async function handler(req:IncomingMessage & {body?:unknown},res:ServerResponse){
 const env=process.env,password=env.OCR_OWNER_PASSWORD??'';const reply=(status:number,data:object)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const url=new URL(req.url??'/api/ocr','https://sayit-billit.vercel.app');
 if(req.method==='GET'){reply(200,{authenticated:password.length>=20&&authorized(req.headers.cookie??'',password),enabled:env.OCR_ENABLED==='true'});return;}
 if(req.method!=='POST'){reply(405,{error:'Method not allowed'});return;}
 if(req.headers.origin!=='https://sayit-billit.vercel.app'||req.headers['x-sib-request']!=='1'){reply(403,{error:'Same-origin requests only'});return;}
 if(password.length<20){reply(503,{error:'Owner access not configured. No provider call made.'});return;}
 const store=new RedisStore(env);
 try{
 if(url.searchParams.get('action')==='logout'){res.setHeader('Set-Cookie','sib_owner=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0');reply(200,{authenticated:false});return;}
 if(url.searchParams.get('action')==='login'){
 const ip=String(req.headers['x-forwarded-for']??'unknown').split(',')[0];const bucket=Math.floor(Date.now()/900000);const key=`sib:v1:auth:${digest(ip,password)}:${bucket}`;
 const attempts=await store.eval("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],900) end;return n",[key]);if(attempts>5){reply(429,{error:'Too many attempts. Wait 15 minutes.'});return;}
 let text='';for await(const chunk of req){text+=chunk.toString();if(text.length>2048)throw Error('Invalid login');}const data=req.body&&typeof req.body==='object'?req.body as {password?:unknown}:JSON.parse(text);
 if(typeof data.password!=='string'||!equal(data.password,password)){reply(403,{error:'Invalid owner password'});return;}
 res.setHeader('Set-Cookie',`sib_owner=${session(password)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=1800`);reply(200,{authenticated:true,enabled:env.OCR_ENABLED==='true'});return;
 }
 if(!authorized(req.headers.cookie??'',password)){reply(401,{error:'Owner sign-in required. No provider call made.'});return;}
 if(url.searchParams.get('action')==='lock'){await store.eval("local b=redis.call('GET',KEYS[1]);if b then local x=cjson.decode(b);x.halted=true;x.remainingCalls=0;redis.call('SET',KEYS[1],cjson.encode(x));end;return 1",['sib:v1:approved-budget']);reply(200,{locked:true});return;}
 if(url.searchParams.get('action')==='arm-test'){if(env.OCR_APPROVED_TEST_ID!=='2026-11-24-155445'){reply(403,{error:'No approved one-time test'});return;}const n=await store.eval("if redis.call('EXISTS',KEYS[1])==1 or redis.call('EXISTS',KEYS[2])==1 then return 0 end;redis.call('SET',KEYS[1],'consumed');redis.call('SET',KEYS[2],ARGV[1]);return 1",['sib:v1:approval:2026-11-24-155445','sib:v1:approved-budget'],[JSON.stringify({remainingCalls:1,remainingNano:200000000,halted:false})]);reply(n===1?200:409,{armed:n===1,note:'Exactly one request. Cannot reset this approval.'});return;}
 if(url.searchParams.get('action')==='check-reservations'){reply(200,await checkReservations(store));return;}
 if(env.OCR_ENABLED!=='true'){reply(423,{error:'OCR spending is locked. No provider call made.'});return;}
 let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>3000000)throw Error('Use PNG/JPEG up to 3 MB');chunks.push(Buffer.from(chunk));}
 if(Buffer.isBuffer(req.body)){chunks.push(req.body);size+=req.body.length;}else if(typeof req.body==='string'){const b=Buffer.from(req.body);chunks.push(b);size+=b.length;}if(size>3000000)throw Error('Use PNG/JPEG up to 3 MB');const bytes=Buffer.concat(chunks),mime=req.headers['content-type']??'';
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!((mime==='image/png'&&png)||(mime==='image/jpeg'&&jpeg)))throw Error('Invalid PNG/JPEG');
 const result=await extractInterfazeOCR(bytes,mime,new HostedClient(env,store));
 // Return only reviewed record/usage. Keep raw OCR privately in the durable cache.
 const {record,engine,imageHash,inputHash,tokens,usd,cacheHit,latencyMs,note}=result;reply(200,{record,engine,imageHash,inputHash,tokens,usd,cacheHit,latencyMs,note});
 }catch{reply(503,{error:'OCR unavailable or request uncertain. No automatic retry. Owner must inspect the usage ledger before enabling another call.'});}
}
