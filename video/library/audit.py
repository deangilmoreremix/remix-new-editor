import subprocess, json, glob, os, struct, sys
def atoms(path):
    """top-level MP4 atom order: is 'moov' before 'mdat' (streamable / faststart)?"""
    order=[]; 
    with open(path,'rb') as f:
        size=os.path.getsize(path); pos=0
        while pos<size and len(order)<12:
            f.seek(pos); h=f.read(8)
            if len(h)<8: break
            sz,typ=struct.unpack('>I4s',h); typ=typ.decode('latin1')
            if sz==1: sz=struct.unpack('>Q',f.read(8))[0]
            order.append(typ)
            if sz==0: break
            pos+=sz
    return order
def probe(p):
    j=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',p]))
    v=[s for s in j['streams'] if s['codec_type']=='video'][0]; a=[s for s in j['streams'] if s['codec_type']=='audio']
    return dict(file=p,codec=v['codec_name'],profile=v.get('profile'),pix=v['pix_fmt'],w=v['width'],h=v['height'],fps=v['r_frame_rate'],
      dur=round(float(j['format']['duration']),2),size=int(j['format']['size']),audio=(a[0]['codec_name'] if a else None),
      faststart=None)
rows=[]
for p in sorted(glob.glob(sys.argv[1]+'/*.mp4'))+sorted(glob.glob(sys.argv[2]+'/*.mp4'))+glob.glob(sys.argv[1]+'/*.webm'):
    r=probe(p)
    if p.endswith('.mp4'):
        o=atoms(p); r['faststart']=('moov' in o and 'mdat' in o and o.index('moov')<o.index('mdat'))
    dec=subprocess.run(['ffmpeg','-v','error','-i',p,'-f','null','-'],capture_output=True,text=True)
    r['decode_errors']=len([l for l in dec.stderr.splitlines() if l.strip()])
    rows.append(r)
json.dump(rows,open(sys.argv[3],'w'),indent=1)
bad=[r for r in rows if r['file'].endswith('.mp4') and (r['codec']!='h264' or r['pix']!='yuv420p' or not r['faststart'] or r['w']%2 or r['h']%2 or r['decode_errors'])]
print(len(rows),'files audited'); print('codecs:',sorted({(r['codec'],r['pix']) for r in rows})); print('audio tracks:',[(os.path.basename(r['file']),r['audio']) for r in rows if r['audio']])
print('fps:',sorted({r['fps'] for r in rows})); print('NOT streamable (moov after mdat):',[os.path.basename(r['file']) for r in rows if r['file'].endswith('.mp4') and not r['faststart']])
print('problems:',[(os.path.basename(r['file']),r['codec'],r['pix'],r['faststart'],r['decode_errors']) for r in bad])
