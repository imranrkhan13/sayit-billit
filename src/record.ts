import { z } from 'zod';
export const candidate = z.object({value:z.string().nullable(),quote:z.string().nullable(),confidence:z.number().min(0).max(1)}).strict();
export const recordSchema = z.object({schema_version:z.literal('expense.v1'),merchant:candidate,date:candidate,currency:candidate,items:z.array(z.object({name:candidate,price:candidate}).strict()),total:candidate,tax:candidate}).strict();
export type Candidate = z.infer<typeof candidate>;
export type RawRecord = z.infer<typeof recordSchema>;
export type Evidence = {id:string;quote:string;confidence:number|null;box?:[number,number,number,number];span?:[number,number];source:'image'|'transcript'};
export type Field = Candidate & {evidence:Evidence[];score:number;review:boolean;reasons:string[]};
export type Expense = {schema_version:'expense.v1';merchant:Field;date:Field;currency:Field;items:{name:Field;price:Field}[];total:Field;tax:Field};
export const keys = ['merchant','date','currency','total','tax'] as const;
export function fields(r:Expense):[string,Field][] {return [...keys.map(k=>[k,r[k]] as [string,Field]),...r.items.flatMap((i,n)=>[[`items.${n}.name`,i.name],[`items.${n}.price`,i.price]] as [string,Field][])];}
export function ground(raw:RawRecord,evidence:Evidence[],threshold:number,calibrated=false):Expense {
 const field=(f:Candidate):Field=>{
  const hits=f.quote?evidence.filter(e=>e.quote===f.quote):[];
  const score=hits.length===1&&hits[0].confidence!==null?Math.min(f.confidence,hits[0].confidence):0;
  const reasons:string[]=[];
  if(f.value===null)reasons.push('Missing value');
  if(hits.length!==1)reasons.push(hits.length?'Ambiguous source':'No verified source');
  if(hits.length===1&&hits[0].confidence===null)reasons.push('Source confidence unavailable');
  if(score<threshold)reasons.push('Below review threshold');
  if(!calibrated)reasons.push('Gate not calibrated for this engine');
  if(f.value!==null&&f.quote&&!f.quote.toLowerCase().includes(f.value.toLowerCase()))reasons.push('Normalized value needs verification');
  return {...f,evidence:hits,score,review:reasons.length>0,reasons};
 };
 const result:Expense={schema_version:'expense.v1',merchant:field(raw.merchant),date:field(raw.date),currency:field(raw.currency),total:field(raw.total),tax:field(raw.tax),items:raw.items.map(i=>({name:field(i.name),price:field(i.price)}))};
 for(const k of ['tax','total'] as const)if(result[k].value!==null&&!/^\d+\.\d{2}$/.test(result[k].value!)){result[k].review=true;result[k].reasons.push('Invalid decimal amount');}
 if(result.date.value&&!/^\d{4}-\d{2}-\d{2}$/.test(result.date.value)){result.date.review=true;result.date.reasons.push('Ambiguous date');}
 if(result.currency.value&&!/^[A-Z]{3}$/.test(result.currency.value)){result.currency.review=true;result.currency.reasons.push('Ambiguous currency');}
 return result;
}
export function ocrEvidence(precontext:unknown):Evidence[] {
 const point=z.object({x:z.number().finite(),y:z.number().finite()});
 const line=z.object({text:z.string(),average_confidence:z.number().min(0).max(1).optional(),bounds:z.object({top_left:point,top_right:point,bottom_left:point,bottom_right:point})});
 const parser=z.array(z.object({name:z.string(),result:z.unknown()})); const parsed=parser.safeParse(precontext); if(!parsed.success)return [];
 const out:Evidence[]=[];
 for(const [p,entry] of parsed.data.entries()){
  if(entry.name!=='ocr')continue;
  const result=z.object({sections:z.array(z.object({lines:z.array(z.unknown())}))}).safeParse(entry.result);if(!result.success)continue;
  result.data.sections.forEach((s,si)=>s.lines.forEach((l,li)=>{const v=line.safeParse(l);if(!v.success)return;const pts=Object.values(v.data.bounds),xs=pts.map(x=>x.x),ys=pts.map(x=>x.y);const x=Math.min(...xs),y=Math.min(...ys);out.push({id:`ocr:${p}:${si}:${li}`,source:'image',quote:v.data.text,confidence:v.data.average_confidence??null,box:[x,y,Math.max(...xs)-x,Math.max(...ys)-y]});}));
 }return out;
}
export function transcriptEvidence(text:string):Evidence[]{let offset=0;return text.split(/(?<=\n)/).filter(Boolean).map((quote,i)=>{const start=offset;offset+=quote.length;return{id:`transcript:${i}`,source:'transcript',quote:quote.trimEnd(),confidence:null,span:[start,start+quote.trimEnd().length]};});}
