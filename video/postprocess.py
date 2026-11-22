#!/usr/bin/env python3
"""Shrink renders to their size caps, make posters (webp) and the hero WebM, run black/freeze detection."""
import subprocess, os, glob, shutil
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')); os.makedirs('raw', exist_ok=True)
CAP = {'A-hero-loop': 4.0, 'B-feature-reel': 12.0, 'D-social-9x16': 6.0}  # MB; clips default 2.0
sh = lambda *a: subprocess.run(a, check=True)
for f in sorted(glob.glob('*.mp4')):
    n = f[:-4]; lim = CAP.get(n, 2.0) * 1048576; sz = os.path.getsize(f)
    if sz > lim:
        raw = f'raw/{n}.mp4'; shutil.move(f, raw)
        for crf in (27, 29, 31, 33, 35):
            sh('ffmpeg','-v','error','-y','-i',raw,'-c:v','libx264','-preset','slow','-crf',str(crf),'-pix_fmt','yuv420p','-c:a','copy','-movflags','+faststart',f)
            if os.path.getsize(f) <= lim: break
    d = float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',f]))
    sh('ffmpeg','-v','error','-y','-ss',str(round(d*0.4,2)),'-i',f,'-frames:v','1','-c:v','libwebp','-quality','82',f'{n}.poster.webp')
    bl = subprocess.run(['ffmpeg','-v','info','-i',f,'-vf','blackdetect=d=0.2:pix_th=0.04','-an','-f','null','-'],capture_output=True,text=True).stderr.count('black_start')
    fz = subprocess.run(['ffmpeg','-v','info','-i',f,'-vf','freezedetect=n=-60dB:d=3','-an','-f','null','-'],capture_output=True,text=True).stderr.count('freeze_start')
    print(f'{n}\t{d:.2f}s\t{os.path.getsize(f)/1e6:.2f}MB\tcap {lim/1048576:.0f}MB\tblack={bl} freeze>=3s={fz}')
sh('ffmpeg','-v','error','-y','-i','A-hero-loop.mp4','-an','-c:v','libvpx-vp9','-crf','36','-b:v','0','-row-mt','1','-pix_fmt','yuv420p','A-hero-loop.webm')
print('A-hero-loop.webm', round(os.path.getsize('A-hero-loop.webm')/1e6,2), 'MB')
