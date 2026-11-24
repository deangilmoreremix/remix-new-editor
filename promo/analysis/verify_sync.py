import subprocess, numpy as np, json, re, sys
from scipy.signal import fftconvolve
SR=48000
def dec(path, ss=None, t=None):
    cmd=['ffmpeg','-v','error']+(['-ss',str(ss)] if ss is not None else [])+['-i',path]+(['-t',str(t)] if t else [])+['-ac','1','-ar',str(SR),'-f','f32le','-']
    return np.frombuffer(subprocess.run(cmd,capture_output=True).stdout,dtype=np.float32)
import sys
args=sys.argv[1:] or ['out/v1-hero-nobgm.mp4','out/v1-hero.mp4','analysis/sfx_table.json','0.30']
nob=dec(args[0]); bg=dec(args[1])
src=open('src/timeline.ts').read()
# SFX table rows by parsing the evaluated values via node-free regexp is brittle: take values from remotion-side json
sfx=json.load(open(args[2]))
peak=json.load(open('analysis/sfx_peaks.json'))
res=[]
for s in sfx:
    a=dec('public/audio/sfx/'+s['src'], t=(s.get('durationInFrames') or 120)/30)
    a=a*s['volume']
    exp=int(s['from']/30*SR)
    lo=max(0,exp-6000); hi=min(len(nob),exp+len(a)+6000)
    seg=nob[lo:hi]
    c=fftconvolve(seg,a[::-1],mode='valid')
    k=int(np.argmax(np.abs(c)))
    off=(lo+k-exp)/SR*30
    res.append((s['src'],s['from'],round(off,2)))
print('SFX offsets (frames, +=late):',res)
# BGM: bg - nob ~= bgm segment
d=bg[:len(nob)]-nob[:len(bg)]
t0=7.9356
dur=len(nob)/SR
end=min(9.5, dur-0.7)
ref=dec('public/audio/bgm.mp3', ss=t0, t=end+1)
ref=ref*float(args[3])
# search small window
ref2=ref[int(0.5*SR):int((end-1)*SR)]
c=fftconvolve(d[int(0.2*SR):int(end*SR)],ref2[::-1],mode='valid')
k=int(np.argmax(c))
print('BGM offset frames:', round((k-(int(0.5*SR)-int(0.2*SR)))/SR*30,2))
