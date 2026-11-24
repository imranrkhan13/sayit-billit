import {createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {reservation} from './client';
export type Env=Record<string,string|undefined>;
export const digest=(value:string,key:string)=>createHmac('sha256',key).update(value).digest('hex');
export function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function session(password:string,now=Date.now()){const payload=`${now+1800000}.${randomBytes(16).toString('hex')}`;return `${payload}.${digest(payload,password)}`;}
export function authorized(cookie:string,password:string,now=Date.now()){const token=cookie.split(';').map(x=>x.trim()).find(x=>x.startsWith('sib_owner='))?.slice(10)??'';const [expiry,nonce,signature,...extra]=token.split('.');return !extra.length&&/^\d+$/.test(expiry??'')&&Number(expiry)>now&&Number(expiry)<=now+1800000&&/^[a-f0-9]{32}$/.test(nonce??'')&&equal(signature??'',digest(`${expiry}.${nonce}`,password));}
export class RedisStore{
 constructor(private env:Env,private transport:typeof fetch=fetch){}
 async command(...args:unknown[]){const url=this.env.KV_REST_API_URL,token=this.env.KV_REST_API_TOKEN;if(!url||!token||!url.startsWith('https://'))throw Error('Durable storage unavailable');const response=await this.transport(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!response.ok)throw Error('Durable storage unavailable');const out=await response.json();if(out.error)throw Error('Durable storage rejected request');return out.result;}
 async eval(script:string,keys:string[],args:(string|number)[]=[]){return this.command('EVAL',script,keys.length,...keys,...args);}
}
// No expiry or eviction for budget/tombstones. Missing budget is a blocker, never a reset.
export const RESERVE=`local c=redis.call('GET',KEYS[2]); if c then return {'cached',c} end
local b=redis.call('GET',KEYS[1]); if not b then return {'blocked','Budget not initialized'} end
local x=cjson.decode(b); if x.halted then return {'blocked','Prior failure requires review'} end
if x.remainingCalls<1 or x.remainingNano<tonumber(ARGV[1]) then return {'blocked','Approved budget exhausted'} end
x.remainingCalls=x.remainingCalls-1; x.remainingNano=x.remainingNano-tonumber(ARGV[1]);x.halted=true;
redis.call('SET',KEYS[1],cjson.encode(x));redis.call('SET',KEYS[2],cjson.encode({error='Uncertain or in-flight request. No automatic retry.'}));return {'reserved'}`;
export const COMPLETE=`local b=redis.call('GET',KEYS[1]);if not b then return 0 end;local x=cjson.decode(b);x.halted=false;redis.call('SET',KEYS[1],cjson.encode(x));redis.call('SET',KEYS[2],ARGV[1]);return 1`;
export class HostedClient{
 constructor(private env:Env,private store:RedisStore,private transport:typeof fetch=fetch){}
 async call(inputHash:string,stage:string,body:object){const price=reservation(body);const key=`sib:v1:ocr:${inputHash}:${stage}`,budget='sib:v1:approved-budget';
 if(this.env.OCR_ENABLED!=='true'||!this.env.INTERFAZE_API_KEY)throw Error('Interfaze OCR is locked. No provider call made.');
 const state=await this.store.eval(RESERVE,[budget,key],[Math.ceil(price.reserveUsd*1e9)]);
 if(state[0]==='cached'){const cached=JSON.parse(state[1]);if(cached.error)throw Error(cached.error);return {...cached,cacheHit:true};}
 if(state[0]!=='reserved')throw Error(state[1]??'No approved budget');
 const started=performance.now();
 // Any failure after reservation leaves the budget halted and the input tombstoned.
 const response=await this.transport('https://api.interfaze.ai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${this.env.INTERFAZE_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(240000)});
 if(!response.ok)throw Error(`Provider HTTP ${response.status}. No retry; budget remains locked.`);const raw=await response.json();
 const u=raw.usage;if(!u||!Number.isSafeInteger(u.prompt_tokens)||u.prompt_tokens<0||!Number.isSafeInteger(u.completion_tokens)||u.completion_tokens<0)throw Error('Uncertain provider usage. Budget locked.');
 const tokens=u.prompt_tokens+u.completion_tokens,usd=(u.prompt_tokens*price.inputPrice+u.completion_tokens*price.outputPrice)/1e6;
 if(tokens>price.reserveTokens||usd>price.reserveUsd)throw Error('Usage exceeded reservation. Budget locked.');
 const result={raw,tokens,usd,latencyMs:performance.now()-started,cacheHit:false};
 if(await this.store.eval(COMPLETE,[budget,key],[JSON.stringify(result)])!==1)throw Error('Could not save result. Budget remains locked.');
 return result;
 }
}
