"""Thumbnails (320x180 JPEG) for the RemotionUI library cards, from the production-path render stills (sandboxed preview frame).
Usage: python3 scripts/remotionui/make-thumbs.py <stills dir containing <name>/t*.png> [out dir]"""
import os,sys
from PIL import Image,ImageStat
src=sys.argv[1]; out=sys.argv[2] if len(sys.argv)>2 else 'public/hyperframes/thumbs'; os.makedirs(out,exist_ok=True); n=0
for name in sorted(os.listdir(src)):
    d=os.path.join(src,name)
    if not os.path.isdir(d): continue
    best=None
    for f in sorted(os.listdir(d)):
        if not f.endswith('.png'): continue
        im=Image.open(os.path.join(d,f)).convert('RGB'); g=im.convert('L'); s=ImageStat.Stat(g).mean[0]+ImageStat.Stat(g).stddev[0]
        if best is None or s>best[0]: best=(s,im)
    if not best: continue
    im=best[1]; im.thumbnail((320,180)); canvas=Image.new('RGB',(320,180),(0,0,0)); canvas.paste(im,((320-im.width)//2,(180-im.height)//2))
    canvas.save(os.path.join(out,f'rui-{name}.jpg'),quality=80); n+=1
print(n,'thumbnails ->',out)
