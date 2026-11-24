import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {CachedClient} from '../src/client';
import {extractInterfazeOCR as extractInterfaze} from '../src/interfaze-ocr';
const port=Number(process.env.PORT??4174),host='127.0.0.1';
const client=new CachedClient({directory:'.private/cache',key:process.env.INTERFAZE_API_KEY??'',freeConfirmed:process.env.FREE_CREDIT_CONFIRMED==='true',tokenCap:Number(process.env.TOKEN_CAP??0),creditCap:Number(process.env.CREDIT_CAP_USD??0)});
const types:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.wasm':'application/wasm','.gz':'application/gzip'};
createServer(async(req,res)=>{
 const reply=(status:number,value:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(req.headers.host!==`${host}:${port}`){reply(403,{error:'Invalid host'});return;}
 if(req.url==='/api/extract'&&req.method==='POST'){
  if(req.headers.origin!==`http://${host}:${port}`){reply(403,{error:'Local same-origin requests only'});return;}
  try{let size=0;const chunks:Buffer[]=[];for await(const chunk of req){size+=chunk.length;if(size>10000000)throw Error('IMAGE_TOO_LARGE');chunks.push(chunk);}
   const result=await extractInterfaze(Buffer.concat(chunks),req.headers['content-type']??'',client);
   await mkdir('.private',{recursive:true,mode:0o700});await writeFile(`.private/${result.imageHash}.expense.json`,JSON.stringify(result,null,2),{mode:0o600});reply(200,result);
  }catch(error){const message=error instanceof Error?error.message:'Extraction failed';reply(400,{error:message.slice(0,400),note:'No automatic retry. Inspect private cache before another attempt.'});}return;
 }
 if(req.method!=='GET'){reply(405,{error:'Method not allowed'});return;}
 try{const path=resolve('dist','.'+(req.url?.split('?')[0]==='/'?'/index.html':req.url?.split('?')[0]??''));if(!path.startsWith(resolve('dist')+'/'))throw Error();const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]??'application/octet-stream','Content-Security-Policy':"default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'});res.end(data);}catch{reply(404,{error:'Not found'});}
}).listen(port,host,()=>console.log(`Private extraction runner: http://${host}:${port}. Every uncached request requires explicit credit caps. No public inference endpoint.`));
