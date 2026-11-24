import {mkdir,copyFile,writeFile} from 'node:fs/promises';
const dir='public/ocr';await mkdir(dir,{recursive:true});
await copyFile('node_modules/tesseract.js/dist/worker.min.js',dir+'/worker.min.js');
for(const name of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js'])await copyFile('node_modules/tesseract.js-core/'+name,dir+'/'+name);
const response=await fetch('https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz');if(!response.ok)throw Error('OCR language download failed');await writeFile(dir+'/eng.traineddata.gz',new Uint8Array(await response.arrayBuffer()));
