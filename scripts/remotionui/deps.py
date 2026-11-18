import json,re,os,sys,collections
L=json.load(open('src/lib/remotionui/registry.lock.json'))
pk=json.load(open('package.json')); have={**pk.get('dependencies',{}),**pk.get('devDependencies',{})}
by={i['name']:i for i in L['items']}
src={}
for i in L['items']:
    for f in i['files']: src[i['name']]=open(f['path']).read()
def pkgs(n,seen):
    if n in seen: return set()
    seen.add(n); s=set(by[n]['dependencies'])
    for d in by[n]['registryDependencies']:
        if d in by: s|=pkgs(d,seen)
    return s
out={}
for n,i in by.items():
    if i['type'] in('registry:lib','registry:hook'): continue
    out[n]=sorted(p for p in pkgs(n,set()) if p not in have and p!='react')
miss=collections.Counter(p for v in out.values() for p in v)
print('renderable',len(out),'needing missing pkgs',sum(1 for v in out.values() if v)); print(miss)
json.dump(out,open('/tmp/claude-0/-home-user-remix-new-editor/f3c003e3-63a9-54c1-b5f2-e6197d3da710/scratchpad/rui/missing.json','w'))
