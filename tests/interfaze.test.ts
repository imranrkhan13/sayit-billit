import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {CachedClient} from '../src/client';import {extractInterfaze} from '../src/interfaze';import {rules} from '../src/baseline';
test('Interfaze adapter validates protocol, source grounding and output budget with labeled test transport',async()=>{
 let calls=0;const raw=rules([{id:'test',source:'image',confidence:.99,quote:'TOTAL 12.00',box:[1,2,30,10]}]);
 const client=new CachedClient({directory:await mkdtemp(join(tmpdir(),'sayit-adapter-')),key:'test-transport-only',freeConfirmed:true,tokenCap:132096,creditCap:.12},async(url,options)=>{
  calls++;assert.equal(url,'https://api.interfaze.ai/v1/chat/completions');const body=JSON.parse(options!.body as string);assert.equal(body.model,'interfaze-1.1-lite');assert.equal(body.max_tokens,4096);assert.ok(body.response_format.json_schema.strict);
  return new Response(JSON.stringify({usage:{prompt_tokens:100,completion_tokens:100},choices:[{message:{content:JSON.stringify(raw)}}],precontext:[{name:'ocr',result:{sections:[{lines:[{text:'TOTAL 12.00',average_confidence:.99,bounds:{top_left:{x:1,y:2},top_right:{x:31,y:2},bottom_left:{x:1,y:12},bottom_right:{x:31,y:12}}}]}]}}]}));
 });
 const out=await extractInterfaze(new Uint8Array([1,2,3]),'image/png',client);assert.equal(calls,1);assert.equal(out.record.total.value,'12.00');assert.deepEqual(out.record.total.evidence[0].box,[1,2,30,10]);assert.equal(out.record.total.review,true);assert.equal(out.usd,.000235);
 const cached=await extractInterfaze(new Uint8Array([1,2,3]),'image/png',client);assert.equal(cached.cacheHit,true);assert.equal(calls,1);
 await assert.rejects(extractInterfaze(new Uint8Array([4]),'image/png',client),/CAP_REACHED/);
});
test('Interfaze invalid and unapproved inputs make no calls',async()=>{let calls=0;const client=new CachedClient({directory:await mkdtemp(join(tmpdir(),'sayit-denied-')),key:'test',freeConfirmed:false,tokenCap:132096,creditCap:.2},async()=>{calls++;throw Error('never');});await assert.rejects(extractInterfaze(new Uint8Array([1]),'text/html',client),/INVALID_IMAGE/);await assert.rejects(extractInterfaze(new Uint8Array([1]),'image/png',client),/UNCONFIRMED/);assert.equal(calls,0);});
