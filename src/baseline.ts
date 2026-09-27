import {type Candidate,type Evidence,type RawRecord} from './record';
// Deliberately small rules, frozen before inspecting held-out predictions.
export function rules(lines:Evidence[]):RawRecord{
 const empty=():Candidate=>({value:null,quote:null,confidence:0});
 const make=(e:Evidence|undefined,value?:string):Candidate=>e?{value:value??e.quote,quote:e.quote,confidence:e.confidence??0}:empty();
 const match=(re:RegExp)=>lines.find(l=>re.test(l.quote));
 const money=(re:RegExp)=>{const l=match(re);return make(l,l?.quote.match(/(\d+\.\d{2})\s*$/)?.[1]);};
 const date=match(/\b\d{4}-\d{2}-\d{2}\b/),currency=match(/\b(USD|GBP|EUR|INR)\b/);
 const items=lines.filter(l=>/\s\d+\.\d{2}$/.test(l.quote)&&! /\b(total|subtotal|tax|cash|change|paid|balance)\b/i.test(l.quote)).map(l=>({name:make(l,l.quote.replace(/\s+\d+\.\d{2}$/,'')),price:make(l,l.quote.match(/(\d+\.\d{2})$/)![1])}));
 return{schema_version:'expense.v1',merchant:make(lines[0]),date:make(date,date?.quote.match(/\d{4}-\d{2}-\d{2}/)?.[0]),currency:make(currency,currency?.quote.match(/\b(USD|GBP|EUR|INR)\b/)?.[0]),items,total:money(/^TOTAL\b/i),tax:money(/^TAX\b/i)};
}
