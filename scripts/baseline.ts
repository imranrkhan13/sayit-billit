import {createWorker} from 'tesseract.js';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {hash} from '../src/client';
import {rules} from '../src/baseline';
import type {Evidence} from '../src/record';
const manifest=JSON.parse(await readFile('data/manifest.json','utf8'));
await mkdir('data/predictions',{recursive:true});
const worker=await createWorker('eng',1,{cachePath:'.private/tess',logger:()=>{}});
try{for(const entry of manifest){
 const path=`data/predictions/${entry.id}.tesseract.json`;
 try{await readFile(path);continue;}catch{}
 const image=await readFile(`data/${entry.file}`);if(hash(image)!==entry.sha256)throw new Error('Data hash mismatch');
 const start=performance.now();const result=await worker.recognize(image,{}, {text:true,blocks:true,tsv:true});const latencyMs=performance.now()-start;
 const lines:Evidence[]=[];
 for(const block of result.data.blocks??[])for(const paragraph of block.paragraphs)for(const line of paragraph.lines){const b=line.bbox;lines.push({id:`tess:${lines.length}`,source:'image',quote:line.text.trim(),confidence:line.confidence/100,box:[b.x0,b.y0,b.x1-b.x0,b.y1-b.y0]});}
 await writeFile(path,JSON.stringify({engine:'tesseract.js 6 / English',inputHash:entry.sha256,latencyMs,tokens:0,usd:0,raw:result.data,evidence:lines,record:rules(lines)},null,2));console.log(entry.id,Math.round(latencyMs)+'ms');
}}finally{await worker.terminate();}
