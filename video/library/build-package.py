#!/usr/bin/env python3
"""Build a portable bundle of every SmartVideo demo video: universal H.264 (yuv420p, limited range, BT.709, faststart),
true silent files without an audio track, WebP + JPG posters, and a manifest with checksums."""
import subprocess, json, os, shutil, hashlib, sys
from PIL import Image
SP=sys.argv[1]; OUT=os.path.join(SP,'pkg','smartvideo-videos')
SRC_LANDING=f'{SP}/vw/video/out'; SRC_STUDIO=f'{SP}/vw/video/out/studio'
shutil.rmtree(OUT,ignore_errors=True)
for d in ('landing','studio'): os.makedirs(f'{OUT}/{d}')
VF='scale=in_range=auto:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p'
COLOR=['-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709']
def enc(src,dst,keep_audio,cap_mb):
    for crf in (22,24,26,28,30,32):
        cmd=['ffmpeg','-v','error','-y','-i',src,'-vf',VF,'-c:v','libx264','-preset','slow','-crf',str(crf),'-profile:v','high','-level','4.1','-pix_fmt','yuv420p',*COLOR,'-r','30']
        cmd+=(['-c:a','aac','-b:a','128k','-ar','48000'] if keep_audio else ['-an'])
        cmd+=['-movflags','+faststart',dst]; subprocess.run(cmd,check=True)
        if os.path.getsize(dst)<=cap_mb*1048576: return crf
    return crf
def poster(src_webp,dst_base):
    shutil.copy(src_webp,dst_base+'.poster.webp'); Image.open(src_webp).convert('RGB').save(dst_base+'.poster.jpg',quality=86)
def sha(p):
    h=hashlib.sha256(); h.update(open(p,'rb').read()); return h.hexdigest()
def info(p):
    j=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',p]))
    v=[s for s in j['streams'] if s['codec_type']=='video'][0]; a=[s for s in j['streams'] if s['codec_type']=='audio']
    return dict(width=v['width'],height=v['height'],fps=30,duration_s=round(float(j['format']['duration']),2),size_bytes=int(j['format']['size']),video_codec=v['codec_name'],pixel_format=v['pix_fmt'],audio=(a[0]['codec_name'] if a else None))
items=[]
LANDING=[('a-hero-loop','A-hero-loop','Hero loop','mixed',True,4),('b-feature-reel','B-feature-reel','Feature reel','mixed',True,12),('d-social-9x16','D-social-9x16','Social cut (9:16)','mixed',True,6),
 ('c01-hero-prompt','C01-hero-prompt','Typing a prompt in Video Studio','real-screen-recording',False,2),('c02-apps-hub','C02-apps-hub','Apps hub','screenshots-with-camera-moves',False,2),
 ('c03-model-picker','C03-model-picker','Model picker','real-screen-recording',False,2),('c04-image-studio','C04-image-studio','Image Studio','screenshots-with-camera-moves',False,2),
 ('c05-cinema-studio','C05-cinema-studio','Cinema Studio','screenshots-with-camera-moves',False,2),('c06-director','C06-director','Director','screenshots-with-camera-moves',False,2),
 ('c07-edit-tools','C07-edit-tools','Edit tools (built-in before/after gallery)','screenshots-with-camera-moves',False,2),('c08-character','C08-character','Character Studio','screenshots-with-camera-moves',False,2),
 ('c09-avatar','C09-avatar','Avatar Studio','screenshots-with-camera-moves',False,2),('c10-lip-sync','C10-lip-sync','Lip Sync Studio','screenshots-with-camera-moves',False,2),
 ('c11-vfx-effects','C11-vfx-effects','AI VFX and Effects','screenshots-with-camera-moves',False,2),('c12-templates','C12-templates','Templates','screenshots-with-camera-moves',False,2)]
for slug,srcname,title,kind,audio,cap in LANDING:
    dst=f'{OUT}/landing/{slug}.mp4'; crf=enc(f'{SRC_LANDING}/{srcname}.mp4',dst,audio,cap); poster(f'{SRC_LANDING}/{srcname}.poster.webp',f'{OUT}/landing/{slug}')
    e=dict(id=slug,group='landing',title=title,file=f'landing/{slug}.mp4',poster_webp=f'landing/{slug}.poster.webp',poster_jpg=f'landing/{slug}.poster.jpg',source=kind,captions_burned_in=True,has_music=audio,quality='ok',crf=crf,**info(dst),sha256=sha(dst))
    if audio:   # music-free twin: same picture, no audio track (avoids the music licence question)
        d2=f'{OUT}/landing/{slug}-nomusic.mp4'; subprocess.run(['ffmpeg','-v','error','-y','-i',dst,'-an','-c:v','copy','-movflags','+faststart',d2],check=True)
        e['music_free_variant']=f'landing/{slug}-nomusic.mp4'; items.append(dict(e)); items.append(dict(id=slug+'-nomusic',group='landing',title=title+' (no music)',file=f'landing/{slug}-nomusic.mp4',poster_webp=e['poster_webp'],poster_jpg=e['poster_jpg'],source=kind,captions_burned_in=True,has_music=False,quality='ok',**info(d2),sha256=sha(d2)))
    else: items.append(e)
# hero WebM (VP9, silent) for browsers that prefer it
shutil.copy(f'{SRC_LANDING}/A-hero-loop.webm',f'{OUT}/landing/a-hero-loop.webm')
items.append(dict(id='a-hero-loop-webm',group='landing',title='Hero loop (WebM/VP9)',file='landing/a-hero-loop.webm',poster_webp='landing/a-hero-loop.poster.webp',poster_jpg='landing/a-hero-loop.poster.jpg',source='mixed',captions_burned_in=True,has_music=False,quality='ok',**{**info(f'{OUT}/landing/a-hero-loop.webm')},sha256=sha(f'{OUT}/landing/a-hero-loop.webm')))
clips=json.load(open(f'{SP}/studio-motion/clips.json'))
WEAK={'asset-edit','brand-dna','campaign','content-library','library','smart-video-scheduler','media-hub','timeline','personalizer'}
slugs={c['route']:c for c in clips}
for c in clips:
    s=c['slug']; dst=f'{OUT}/studio/{s}.mp4'; crf=enc(f'{SRC_STUDIO}/{s}.mp4',dst,False,2); poster(f'{SRC_STUDIO}/{s}.poster.webp',f'{OUT}/studio/{s}')
    items.append(dict(id=s,group='studio',title=c['name'],route=c['route'],file=f'studio/{s}.mp4',poster_webp=f'studio/{s}.poster.webp',poster_jpg=f'studio/{s}.poster.jpg',source='real-screen-recording',captions_burned_in=True,has_music=False,
        quality=('weak: page is empty or shows "Brand not found" without data' if c['route'] in WEAK else 'ok'),motion_seconds=c['motionS'],end_hold_seconds=c['padS'],crf=crf,**info(dst),sha256=sha(dst)))
json.dump(dict(generated='2026-11-25',total_videos=len(items),format='H.264 High, yuv420p, limited range, BT.709, 30 fps CBR-free CRF, +faststart; AAC 128k only where has_music is true',items=items),open(f'{OUT}/manifest.json','w'),indent=1)
print(len(items),'manifest items;',sum(i['size_bytes'] for i in items)//1048576,'MB')
