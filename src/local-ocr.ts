import {createWorker} from 'tesseract.js';
import {rules} from './baseline';
import {ground,type Evidence} from './record';
export async function extractLocal(image:Blob, progress:(message:string)=>void){
 const worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr',langPath:'/ocr',workerBlobURL:false,logger:m=>progress(m.status+(m.progress?' '+Math.round(m.progress*100)+'%':''))});
 try{
  const {data}=await worker.recognize(image,{}, {blocks:true});
  const evidence:Evidence[]=[];
  for(const block of data.blocks??[])for(const paragraph of block.paragraphs)for(const line of paragraph.lines){const b=line.bbox;evidence.push({id:'local:'+evidence.length,quote:line.text.trim(),source:'image',confidence:line.confidence/100,box:[b.x0,b.y0,b.x1-b.x0,b.y1-b.y0]});}
  return ground(rules(evidence),evidence,1,false);
 }finally{await worker.terminate();}
}
