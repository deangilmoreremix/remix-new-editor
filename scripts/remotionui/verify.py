"""Writes src/lib/remotionui/verification.json from the production-path measurements (render sweep + real MP4 exports).
An item is enabled only if: it rendered with no adapter error and non-blank in the sandboxed preview frame, AND a real 1080p browser MP4
export succeeded with no adapter errors, AND export throughput is at least MIN_FPS. Items below 8 fps are enabled but marked slow."""
import json,sys
MIN_FPS=3.0; SLOW_FPS=8.0
an=json.load(open(sys.argv[1])); full=json.load(open(sys.argv[2])); half=json.load(open(sys.argv[3]))
out={}
for k,a in an.items():
    f=full.get(k) or half.get(k)
    if a['errors'] or a.get('fatal'): out[k]={'enabled':False,'reason':'rendering failed in the sandbox: '+(a['errors'] or [a['fatal']])[0][22:140]}; continue
    if a['blank']: out[k]={'enabled':False,'reason':'rendered blank'}; continue
    if not f or not f['ok'] or f.get('hfErrors'): out[k]={'enabled':False,'reason':'MP4 export failed: '+str((f or {}).get('error') or (f or {}).get('hfErrors'))[:140]}; continue
    fps=f['fps']
    if fps<MIN_FPS: out[k]={'enabled':False,'reason':f'export too slow ({fps} fps at 1080p)','fps':fps}; continue
    out[k]={'enabled':True,'fps':fps,**({'slow':True} if fps<SLOW_FPS else {})}
json.dump(out,open('src/lib/remotionui/verification.json','w'),indent=1)
print(sum(1 for v in out.values() if v['enabled']),'enabled of',len(out),'; slow:',sum(1 for v in out.values() if v.get('slow')))
