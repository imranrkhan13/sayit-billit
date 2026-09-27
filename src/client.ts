import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,open} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
export const hash=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const reserveTokens=1_032_000,reserveUsd=1.612;
export type Config={directory:string;key:string;freeConfirmed:boolean;tokenCap:number;creditCap:number;gateway?:boolean};
export class CachedClient {
 constructor(private config:Config,private transport:typeof fetch=fetch){}
 async call(inputHash:string,stage:string,body:object):Promise<{raw:any;latencyMs:number;tokens:number;usd:number;cacheHit:boolean}>{
  const c=this.config;await mkdir(c.directory,{recursive:true,mode:0o700});
  // Key is input+stage only: schema/prompt changes never silently spend again.
  const path=join(c.directory,hash(inputHash+':'+stage)+'.json');
  const cached=await readFile(path,'utf8').then(JSON.parse).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return null;throw e;});
  if(cached){if(cached.error)throw new Error(cached.error);return {...cached,cacheHit:true};}
  if(!c.key||!c.freeConfirmed)throw new Error('FREE_ACCESS_UNCONFIRMED: configure a key and confirm available free credits. No call made.');
  if(!Number.isFinite(c.tokenCap)||!Number.isFinite(c.creditCap)||c.creditCap<=0||c.creditCap>5)throw new Error('Invalid free-credit/token caps');
  const lock=await open(join(c.directory,'runner.lock'),'wx').catch(()=>{throw new Error('Runner locked. Another call or an unresolved crash exists; no retry.');});
  try{
   const ledgerPath=join(c.directory,'ledger.json');
   const ledger=await readFile(ledgerPath,'utf8').then(JSON.parse).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ENOENT')return{tokens:0,usd:0,halted:false};throw e;});
   if(ledger.halted)throw new Error('HALTED: prior API failure or uncertain usage. Inspect private ledger.');
   if(ledger.tokens+reserveTokens>c.tokenCap||ledger.usd+reserveUsd>c.creditCap)throw new Error('CAP_REACHED: insufficient budget for worst-case token reservation. No call made.');
   // Durable tombstone before transport. A crash can never replay an uncertain call.
   await writeFile(path,JSON.stringify({error:'UNCERTAIN_CALL: reserved; automatic replay prohibited'}),{flag:'wx',mode:0o600});
   await writeFile(ledgerPath,JSON.stringify({...ledger,halted:true,reservedTokens:reserveTokens,reservedUsd:reserveUsd}));
   const started=performance.now();
   try{
    const response=await this.transport(c.gateway?'https://ai-gateway.vercel.sh/v1/chat/completions':'https://api.interfaze.ai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${c.key}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(300_000)});
    const responseText=await response.text();
    await writeFile(path+'.raw',responseText,{mode:0o600});
    if(!response.ok)throw new Error(`HTTP_${response.status}: provider rejected ${stage}; raw response saved privately`);
    const raw=JSON.parse(responseText);
    const usage=z.object({prompt_tokens:z.number().int().nonnegative(),completion_tokens:z.number().int().nonnegative()}).parse(raw.usage);
    const tokens=usage.prompt_tokens+usage.completion_tokens,usd=(usage.prompt_tokens*1.5+usage.completion_tokens*3.5)/1e6;
    const result={raw,latencyMs:performance.now()-started,tokens,usd,cacheHit:false,requestHash:hash(JSON.stringify(body)),inputHash,stage};
    await writeFile(path+'.tmp',JSON.stringify(result,null,2),{mode:0o600});await rename(path+'.tmp',path);
    await writeFile(ledgerPath,JSON.stringify({tokens:ledger.tokens+tokens,usd:ledger.usd+usd,halted:tokens>reserveTokens||usd>reserveUsd}));
    // 1 request/sec, substantially below the documented 50 req/sec.
    await new Promise(r=>setTimeout(r,1000));return result;
   }catch(error){const message=error instanceof Error?error.message:'Unknown API failure';await writeFile(path,JSON.stringify({error:message,inputHash,stage}));throw new Error(message);}
  }finally{await lock.close();const {unlink}=await import('node:fs/promises');await unlink(join(c.directory,'runner.lock'));}
 }
}
