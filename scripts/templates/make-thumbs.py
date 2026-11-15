"""Thumbnails (320x180) for the template cards from the production-path stills. python3 scripts/templates/make-thumbs.py <stills dir>"""
import os,sys
from PIL import Image,ImageStat
src=sys.argv[1]; out='public/hyperframes/thumbs'; os.makedirs(out,exist_ok=True); n=0
for d in sorted(os.listdir(src)):
    if not d.startswith('tpl__') or '--' in d: continue
    best=None
    for f in sorted(os.listdir(f'{src}/{d}')):
        if f.endswith('.png'):
            im=Image.open(f'{src}/{d}/{f}').convert('RGB'); g=im.convert('L'); s=ImageStat.Stat(g).mean[0]+ImageStat.Stat(g).stddev[0]
            if best is None or s>best[0]: best=(s,im)
    if not best: continue
    im=best[1]; im.thumbnail((320,180)); c=Image.new('RGB',(320,180),(0,0,0)); c.paste(im,((320-im.width)//2,(180-im.height)//2)); c.save(f"{out}/{d.replace('__','-')}.jpg",quality=80); n+=1
print(n,'template thumbnails')
