"""Original fictional receipts, CC0. No third-party receipt data or personal information."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path
import json,hashlib
root=Path(__file__).resolve().parents[1]
font=ImageFont.truetype('/System/Library/Fonts/Menlo.ttc',26)
# Split is fixed here before OCR; distinct merchants, values, and layouts.
cases=[
 ('dev-01','dev',['PAPER & PINE','2026-08-01','Currency USD','Notebook 8.00','Pens 4.00','TAX 1.20','TOTAL 13.20'],'clean'),
 ('dev-02','dev',['CEDAR COFFEE','2026-08-03','Currency GBP','Coffee 3.50','Cake 4.00','TAX 0.75','TOTAL 8.25'],'faded'),
 ('dev-03','dev',['NORTH HARDWARE','2026-08-05','Currency EUR','Nails 5.00','Tape 2.00','TAX 1.40','TOTAL 8.40'],'rotated'),
 ('test-01','held-out',['MAPLE PRINT','2026-09-01','Currency USD','Copies 12.00','Binding 6.00','TAX 1.80','TOTAL 19.80'],'clean'),
 ('test-02','held-out',['RIVER SUPPLIES','2026-09-02','Currency INR','Paper 180.00','Clips 40.00','TAX 11.00','TOTAL 231.00'],'faded'),
 ('test-03','held-out',['SMALL BATCH','2026-09-03','Currency EUR','Flour 6.00','Oil 8.00','TAX 0.70','TOTAL 14.70'],'rotated'),
 ('test-04','held-out',['CORNER TOOLS','03/09/26','Currency $','Brush 9.00','Tray 5.00','TOTAL 14.00'],'ambiguous'),
 ('test-05','held-out',['STUDIO MARKET','2026-09-06','Currency GBP','Ink 15.00','Card 7.00','TAX 2.20','BALANCE DUE 24.20'],'alternate-total'),
 ('test-06','held-out',['MOSS GROCER','2026-09-08','Currency USD','Tea 4.50','Oats 3.00','TAX 0.60','TOTAL 8.10'],'creased')]
(root/'data/images').mkdir(parents=True,exist_ok=True)
manifest=[]
for id,split,lines,condition in cases:
 im=Image.new('RGB',(640,650),'#f8f5ed');d=ImageDraw.Draw(im)
 for n,line in enumerate(lines):d.text((45,45+n*66),line,font=font,fill='#77756e' if condition=='faded' else '#242722')
 if condition=='rotated':im=im.rotate(3,resample=Image.Resampling.BICUBIC,fillcolor='#e8e5dc')
 if condition=='faded':im=im.filter(ImageFilter.GaussianBlur(1.0))
 if condition=='creased':ImageDraw.Draw(im).polygon([(260,0),(275,0),(315,650),(290,650)],fill='#f8f5ed')
 path=root/f'data/images/{id}.png';im.save(path)
 # Explicit transcription of authored content; ambiguous fields and absent tax abstain.
 labels={'merchant':lines[0],'date':None if condition=='ambiguous' else lines[1],'currency':None if condition=='ambiguous' else lines[2].split()[-1], 'items':[{'name':x.rsplit(' ',1)[0],'price':x.rsplit(' ',1)[1]} for x in lines[3:5]],'tax':None if condition=='ambiguous' else lines[5].split()[-1], 'total':lines[-1].split()[-1]}
 manifest.append({'id':id,'split':split,'condition':condition,'file':f'images/{id}.png','sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source':'Original fictional receipt authored for SayIt BillIt; scripts/make_data.py','license':'CC0-1.0','labels':labels})
(root/'data/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
