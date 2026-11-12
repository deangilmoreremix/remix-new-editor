"""Applies every gate to the imported templates and writes src/lib/templates/{fields,verification}.json.
   python3 scripts/templates/finalize.py --analysis a.json --effect eff.json --exports exports.json
Gates: renders with no adapter error and not blank; a real full-length 1080p browser MP4 export succeeded (>= 3 fps; < 8 fps = slower export);
only fields whose change visibly changes the picture are offered; an item with no effective field AND visible text is dropped (the customer could not change it);
a template that duplicates a better-featured one (same name in free-remotion-templates) is not offered twice."""
import argparse,json
ap=argparse.ArgumentParser(); ap.add_argument('--analysis',required=True); ap.add_argument('--effect',required=True); ap.add_argument('--exports',required=True); a=ap.parse_args()
cat=json.load(open('src/lib/templates/catalog.json'))['items']; an=json.load(open(a.analysis)); eff=json.load(open(a.effect)); ex={r['id']:r for r in json.load(open(a.exports))}
safe=lambda i:i.replace(':','__'); free={i['name'] for i in cat if i['repo']=='free'}
fields={}; ver={}
for it in cat:
    k=safe(it['id']); r=an.get(k,{}); e=ex.get(k); fx=eff.get(k,{})
    keys=[x['key'] for x in it['editables'] if fx.get(x['key'],{}).get('effective')]; fields[it['id']]=keys
    text=(r.get('bodyText') or '').strip()
    if it['repo']=='rve' and it['name'] in free: ver[it['id']]={'enabled':False,'reason':f"duplicate of tpl:free:{it['name']} (the version with typed props)"}; continue
    if r.get('errors') or r.get('fatal'): ver[it['id']]={'enabled':False,'reason':'rendering failed in the sandbox: '+(r.get('errors') or [r.get('fatal')])[0][22:140]}; continue
    if r.get('blank'): ver[it['id']]={'enabled':False,'reason':'rendered blank'}; continue
    if not e or not e.get('ok') or e.get('hfErrors'): ver[it['id']]={'enabled':False,'reason':'MP4 export failed: '+str((e or {}).get('error') or (e or {}).get('hfErrors') or 'not run')[:140]}; continue
    if e['fps']<3: ver[it['id']]={'enabled':False,'reason':f"export too slow ({e['fps']} fps at 1080p)"}; continue
    if not keys and text: ver[it['id']]={'enabled':False,'reason':'shows text that a customer cannot change (no field visibly changes it)'}; continue
    ver[it['id']]={'enabled':True,'fps':e['fps'],**({'slow':True} if e['fps']<8 else {})}
json.dump(fields,open('src/lib/templates/fields.json','w'),indent=1); json.dump(ver,open('src/lib/templates/verification.json','w'),indent=1)
import collections
print('enabled',sum(1 for v in ver.values() if v['enabled']),'of',len(ver),'| slow',sum(1 for v in ver.values() if v.get('slow')))
print(collections.Counter(v.get('reason','ok')[:48] for v in ver.values() if not v['enabled']).most_common(8))
