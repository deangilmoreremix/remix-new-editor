import json,os,sys
from PIL import Image,ImageChops,ImageStat
import sys
R=sys.argv[1] if len(sys.argv)>1 else 'out/rui'; LOG=sys.argv[2] if len(sys.argv)>2 else 'out/rui.log'; OUTJ=sys.argv[3] if len(sys.argv)>3 else 'out/rui-analysis.json'; res=[]
if not res:
    for l in open(LOG):
        if l.startswith('{'): res.append(json.loads(l))
out={}
for r in res:
    i=r['id']; errs=[e for e in (r.get('codeErrors') or []) if 'error]' in e]
    fr=[]
    for t in sorted(os.listdir(f'{R}/{i}')) if os.path.isdir(f'{R}/{i}') else []:
        if not t.endswith('.png'): continue
        im=Image.open(f'{R}/{i}/{t}').convert('RGB'); g=im.convert('L'); st=ImageStat.Stat(g)
        nb=sum(1 for p in g.getdata() if p>12)/(g.width*g.height)
        fr.append((im,st.stddev[0],nb))
    blank=all(nb<0.0004 for _,_,nb in fr) if fr else True
    motion=0
    if len(fr)>1: motion=max(ImageStat.Stat(ImageChops.difference(fr[a][0],fr[b][0]).convert('L')).mean[0] for a in range(len(fr)) for b in range(a+1,len(fr)))
    out[i]={'errors':errs,'fatal':r.get('fatal'),'blank':blank,'motion':round(motion,2),'nonblank':[round(nb,3) for _,_,nb in fr]}
json.dump(out,open(OUTJ,'w'),indent=1)
bad=[k for k,v in out.items() if v['errors'] or v['fatal'] or v['blank']]
print(len(out),'analysed;',len(bad),'with errors/blank'); 
import collections; print(collections.Counter('error' if v['errors'] else 'fatal' if v['fatal'] else 'blank' for k,v in out.items() if k in bad))
