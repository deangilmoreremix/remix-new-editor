"""Render analysis for the template sweep (production-path stills): errors, blank, motion.
   python3 scripts/templates/analyse.py <stills dir> <prod-render log> <out.json>"""
import json,os,sys
from PIL import Image,ImageChops,ImageStat
R,LOG,OUT=sys.argv[1:4]; res={}
for l in open(LOG):
    if l.startswith('{'): r=json.loads(l); res[r['id']]=r
out={}
for i,r in res.items():
    errs=[e for e in (r.get('codeErrors') or []) if 'error]' in e]; d=f'{R}/{i}'; ims=[]
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.endswith('.png'): ims.append(Image.open(f'{d}/{f}').convert('RGB'))
    nb=[sum(1 for p in im.convert('L').tobytes() if p>12)/(im.width*im.height) for im in ims]
    motion=max([ImageStat.Stat(ImageChops.difference(ims[a],ims[b]).convert('L')).mean[0] for a in range(len(ims)) for b in range(a+1,len(ims))] or [0])
    out[i]={'errors':errs,'fatal':r.get('fatal'),'blank':(not ims) or max(nb)<0.0004,'motion':round(motion,2),'bodyText':(r.get('bodyText') or '')[:200]}
json.dump(out,open(OUT,'w'),indent=1); bad=[k for k,v in out.items() if v['errors'] or v['fatal'] or v['blank']]
print(len(out),'analysed;',len(bad),'with errors/blank')
for k in bad[:40]: print(' ',k,(out[k]['errors'] or [out[k]['fatal'] or 'blank'])[0][:100])
