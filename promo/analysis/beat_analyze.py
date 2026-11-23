import sys, json, numpy as np, librosa
from scipy.signal import butter, sosfilt
name=sys.argv[1]
y,sr=librosa.load(f"public/audio/bgm/{name}.mp3",sr=None,mono=True)
yh,yp=librosa.effects.hpss(y)
tempo,beats=librosa.beat.beat_track(y=yp,sr=sr,tightness=400,units="time")
def fit(b):
    i=np.arange(len(b));A=np.vstack([i,np.ones_like(i)]).T
    (T,t0),*_=np.linalg.lstsq(A,b,rcond=None);return T,t0,b-(t0+i*T)
T,t0,res=fit(beats)
def env(lo,hi):
    sos=butter(4,[lo,hi],btype="band",fs=sr,output="sos")
    e=librosa.onset.onset_strength(y=sosfilt(sos,yp),sr=sr);return e,librosa.times_like(e,sr=sr)
ke,kt=env(40,160); se,st=env(1000,3000); he,ht=env(6000,14000)
# onset times from kick env for coverage
on=librosa.onset.onset_detect(onset_envelope=ke,sr=sr,units="time",backtrack=False)
def score(Tc,t0c):
    n=int((len(y)/sr-t0c)/Tc); g=t0c+np.arange(n)*Tc
    d=np.array([np.min(np.abs(on-t)) for t in g]); 
    return float(np.mean(d<0.04)),float(np.mean(d)*1000)
out={}
for k,(Tc) in {"0.5x":T*2,"1x":T,"2x":T/2}.items():
    out[k]=dict(bpm=60/Tc,zip=dict(zip(("match","mean_abs_ms"),score(Tc,t0))))
sd=np.polyfit(np.arange(len(beats)),res,1)[0]*1000*len(beats)
print(name,"BPM",60/T,"t0",t0,"T",T,"maxres_ms",np.abs(res).max()*1000,"drift_total_ms",sd)
print(json.dumps(out,indent=1))
# per-beat energies
n=int((len(y)/sr-t0)/T); rows=[]
rms=librosa.feature.rms(y=y)[0]; rt=librosa.times_like(rms,sr=sr)
for b in range(n):
    t=t0+b*T
    rows.append(dict(n=b,t=round(float(t),4),kick=float(ke[np.argmin(abs(kt-t))]),snare=float(se[np.argmin(abs(st-t))]),hat=float(he[np.argmin(abs(ht-t))]),rms=float(rms[np.argmin(abs(rt-t))])))
json.dump(dict(bpm=60/T,t0=t0,T=T,maxres_ms=float(np.abs(res).max()*1000),beats=rows,candidates=out),open(f"analysis/beat_data_{name}.json","w"))
top=sorted(rows[:100],key=lambda r:-r["kick"])[:8]
print("top kick beats <100:",[(r["n"],round(r["kick"],1)) for r in top])
# first full-energy beat
r=[x["rms"] for x in rows]; print("rms by 8-beat block:",[round(float(np.mean(r[i:i+8])),3) for i in range(0,64,8)])
