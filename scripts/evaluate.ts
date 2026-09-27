import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {ground,fields,type RawRecord,type Evidence} from '../src/record';
import {hash} from '../src/client';
const manifest:any[]=JSON.parse(await readFile('data/manifest.json','utf8'));
const predictions=new Map<string,any>();for(const d of manifest){if(hash(await readFile('data/'+d.file))!==d.sha256)throw new Error('Dataset hash mismatch');predictions.set(d.id,JSON.parse(await readFile(`data/predictions/${d.id}.tesseract.json`,'utf8')));}
function gold(d:any):Record<string,string|null>{return {...Object.fromEntries(['merchant','date','currency','total','tax'].map(k=>[k,d.labels[k]])),...Object.fromEntries(d.labels.items.flatMap((i:any,n:number)=>[[`items.${n}.name`,i.name],[`items.${n}.price`,i.price]]))};}
function rows(d:any,t:number){const p=predictions.get(d.id),f=Object.fromEntries(fields(ground(p.record as RawRecord,p.evidence as Evidence[],t,true))),g=gold(d);return [...new Set([...Object.keys(g),...Object.keys(f)])].map(k=>({id:d.id,key:k,gold:g[k]??null,pred:f[k]?.value??null,score:f[k]?.score??0,review:f[k]?.review??true,correct:(g[k]??null)===(f[k]?.value??null)}));}
// Tune only dev: minimum threshold with zero accepted errors; tie favors coverage.
const dev=manifest.filter((d:any)=>d.split==='dev');
const tuning=[0,.5,.7,.8,.9,.95,.98,1].map(t=>{const r=dev.flatMap((d:any)=>rows(d,t));return{threshold:t,accepted:r.filter(x=>!x.review).length,acceptedWrong:r.filter(x=>!x.review&&!x.correct).length};});
const config=tuning.filter(x=>x.acceptedWrong===0).sort((a,b)=>b.accepted-a.accepted||a.threshold-b.threshold)[0]??{threshold:1,accepted:0,acceptedWrong:0};
const test=manifest.filter((d:any)=>d.split==='held-out'),all=test.flatMap((d:any)=>rows(d,config.threshold));
const ratio=(a:number,b:number)=>b?a/b:null;
const perField=Object.fromEntries([...new Set(all.map(r=>r.key.replace(/items\.\d+\./,'items.')))].map(key=>{const r=all.filter(r=>r.key.replace(/items\.\d+\./,'items.')===key);const tp=r.filter(r=>r.correct&&r.pred!==null).length;return[key,{n:r.length,accuracy:ratio(r.filter(r=>r.correct).length,r.length),precision:ratio(tp,r.filter(r=>r.pred!==null).length),recall:ratio(tp,r.filter(r=>r.gold!==null).length)}];}));
let commit='uncommitted';try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const wrong=all.filter(r=>!r.correct),flagged=all.filter(r=>r.review);
const report={generatedAt:new Date().toISOString(),commit,manifestHash:hash(await readFile('data/manifest.json')),config:{engine:'tesseract.js 6',threshold:config.threshold,thresholdScope:'dev only; not transferable to Interfaze',tuning,matching:'exact normalized string; null abstentions included in accuracy; ordered items',split:'3 dev / 6 held-out'},n:test.length,fieldAccuracy:ratio(all.filter(r=>r.correct).length,all.length),perField,reviewRate:ratio(flagged.length,all.length),flagPrecision:ratio(flagged.filter(r=>!r.correct).length,flagged.length),errorFlagRecall:ratio(wrong.filter(r=>r.review).length,wrong.length),confidentWrong:all.filter(r=>!r.correct&&r.pred!==null&&r.score>=config.threshold),acceptedWrong:all.filter(r=>!r.correct&&!r.review),tokens:0,usd:0,meanLatencyMs:test.reduce((s:number,d:any)=>s+predictions.get(d.id).latencyMs,0)/test.length,documents:test.map((d:any)=>({id:d.id,inputHash:d.sha256,latencyMs:predictions.get(d.id).latencyMs,tokens:0,usd:0})),interfaze:{status:'not_run',reason:'No free-credit API key confirmed',documents:0},audio:{status:'not_run',reason:'No user-recorded audio supplied',documents:0},rows:all};
await mkdir('data/eval',{recursive:true});await writeFile('data/eval/report.json',JSON.stringify(report,null,2));
await mkdir('public/demo',{recursive:true});await cp('data/images','public/demo/images',{recursive:true});
await writeFile('public/demo/report.json',JSON.stringify(report));
await writeFile('public/demo/receipts.json',JSON.stringify(manifest.map((d:any)=>({id:d.id,split:d.split,condition:d.condition,image:`/demo/${d.file}`,engine:'Tesseract offline baseline',latencyMs:predictions.get(d.id).latencyMs,record:ground(predictions.get(d.id).record,predictions.get(d.id).evidence,config.threshold,true)}))));
console.log(JSON.stringify({n:report.n,accuracy:report.fieldAccuracy,threshold:config.threshold,flagPrecision:report.flagPrecision,errorFlagRecall:report.errorFlagRecall,confidentWrong:report.confidentWrong,meanLatencyMs:report.meanLatencyMs},null,2));
