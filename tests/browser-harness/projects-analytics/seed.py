import json, random, sys
random.seed(7)
out=[]
w=out.append
def q(s): return "'" + s.replace("'", "''") + "'"

DUR=30
def clip(id,type,start,end,**kw):
    d={'id':id,'type':type,'left':start/DUR*100,'width':(end-start)/DUR*100}; d.update(kw); return d
video_track={'id':'v1','type':'video','name':'Video','items':[
  clip('sceneA','video',0,10,name='Kitchen Designs',src='http://127.0.0.1:8099/kitchen.mp4',trimIn=0),
  clip('sceneB','video',10,20,name='Cabinet Upgrades',src='http://127.0.0.1:8099/kitchen.mp4',trimIn=10),
  clip('sceneC','video',20,30,name='Pricing and Estimates',src='http://127.0.0.1:8099/kitchen.mp4',trimIn=20)]}
text_track={'id':'t1','type':'text','name':'Interactive','items':[
  clip('cta_price','click-to-call',21,28,buttonText='Get a quote',linkUrl='https://example.com/quote',style={}),
  clip('cta_book','click-to-call',12,19,buttonText='Book consultation',linkUrl='https://example.com/book',style={}),
  clip('cta_call','click-to-call',2,9,buttonText='Call us',phoneNumber='+15551234567',style={}),
  clip('form1','lead-form',24,29,heading='Request an estimate',ctaText='Send',fields=[{'id':'email','type':'email','label':'Email','required':True}],webhookUrl='https://hooks.example.com/private-owner-hook')]}
snapshot={'version':1,'title':'Kitchen Renovation Promo','timelineSeconds':DUR,'tracks':[video_track,text_track],'listBuilder':None,
 'interestMap':[
  {'id':'sceneA','title':'Kitchen Designs','start':0,'end':10,'interest':{'type':'product','label':'Kitchen designs'},'clipIds':['cta_call']},
  {'id':'sceneB','title':'Cabinet Upgrades','start':10,'end':20,'interest':{'type':'service','label':'Cabinet upgrades'},'clipIds':['cta_book']},
  {'id':'sceneC','title':'Pricing and Estimates','start':20,'end':30,'interest':{'type':'pricing','label':'Pricing'},'clipIds':['cta_price','form1']}]}
editor_state={'timelineSeconds':DUR,'projectTitle':'Kitchen Renovation Promo','tracks':[video_track,text_track]}

w("\\set ON_ERROR_STOP on")
w("set role authenticated; set request.jwt.claims = '{\"sub\":\"userA\"}';")
thumb="http://127.0.0.1:8099/thumb-kitchen.png"
def proj(var,name,pub=False,parent=None,state=editor_state,render='{}'):
    w(f"insert into timeline_projects(name,data,thumbnail_url,duration_s,aspect_ratio,render,parent_project_id,followup_context) values ({q(name)},{q(json.dumps(state))}::jsonb,{q(thumb)},30,'16:9',{q(render)}::jsonb,{parent or 'null'},{q(json.dumps({'interest':'Pricing','createdFrom':'retarget'})) +'::jsonb' if parent else 'null'}) returning id \\gset {var}_")
proj('p1','Kitchen Renovation Promo',render='{"status":"complete"}')
proj('p2','Roof Inspection Draft')
proj('p3','Spring Sale Teaser',render='{"status":"complete"}')
w("select :'p1_id' as parent \\gset")
proj('p4','Kitchen Renovation Promo: Pricing follow-up',parent=":'p1_id'")
def pubvideo(vid,title,pid):
    w(f"insert into published_videos(id,title,project,project_id) values ({q(vid)},{q(title)},{q(json.dumps(snapshot))}::jsonb,:'{pid}_id');")
pubvideo('kitchenAB12','Kitchen Renovation Promo','p1')
pubvideo('springSale01','Spring Sale Teaser','p3')
pubvideo('followupAB12','Kitchen Renovation Promo: Pricing follow-up','p4')
w("select claim_business_slug('example','Example Renovations');")
w("select set_video_slug('kitchenAB12','kitchen-renovation');")
w("select set_video_slug('springSale01','spring-sale-teaser');")
w("select set_video_slug('followupAB12','pricing-follow-up');")
# userB: another tenant's project + video
w("set request.jwt.claims = '{\"sub\":\"userB\"}';")
w("insert into timeline_projects(name,data) values ('Other tenant project','{}');")
w("insert into published_videos(id,title,project) values ('otherTenant1','Other tenant video',{}::jsonb);".format(q(json.dumps(snapshot))))
w("reset role;")

def seq_events(vid, n_sessions, viewers, bias):
    evs=[]
    for i in range(n_sessions):
        key=f"sess{vid[:6]}{i:05d}".ljust(22,'x')[:22]
        viewer=(f"{random.randrange(16**8):08x}"*4) if random.random()<0.72 and not (i%3==0 and viewers) else None
        if viewer is None and viewers: viewer=random.choice(viewers)
        age=int(random.random()**bias*58)   # days ago, weighted to recent
        dev=random.choice(['desktop','desktop','mobile','mobile','tablet'])
        evs.append((key,viewer,dev,age))
    return evs
pool=[f"{random.randrange(16**8):08x}"*4 for _ in range(28)]
def run_video(vid, n, bias, cta_boost=1.0):
    for key,viewer,dev,age in seq_events(vid,n,pool,bias):
        vh=f"{q(viewer)}" if viewer else 'null'
        w("set role service_role;")
        w(f"select ingest_video_events({q(vid)},{q(key)},{vh},null,{q(dev)},null,'[{{\"type\":\"page_open\",\"seq\":0}},{{\"type\":\"play\",\"seq\":1,\"t\":0}}]'::jsonb);")
        w("reset role;")
        w(f"update video_view_sessions set started_at = now() - interval '{age} days' - interval '{random.randint(1,1300)} minutes' - interval '5 minutes' where session_key={q(key)} and video_id={q(vid)};")
        # how far does this viewer get (seconds)
        r=random.random()
        reach = 30 if r<0.52 else (random.choice([4,7,9,12,15,18,21,24,27]) )
        events=[]; seq=2; t=0.0
        while t<reach-0.01:
            seg=min(reach-t, random.choice([3,5,8,10]))
            events.append({'type':'watch','seq':seq,'t0':round(t,2),'t1':round(t+seg,2)}); seq+=1; t+=seg
            for m,thr in ((25,7.5),(50,15),(75,22.5),(90,27)):
                if t>=thr and (t-seg)<thr+0.001 or (t>=thr and not any(e['type']==f'progress_{m}' for e in events)):
                    if not any(e['type']==f'progress_{m}' for e in events): events.append({'type':f'progress_{m}','seq':seq,'t':round(t,2)}); seq+=1
        if random.random()<0.14 and reach>=10:
            events.append({'type':'section_rewatch','seq':seq,'section':random.choice(['sceneA','sceneB']),'t':3.0}); seq+=1
        def maybe(p,typ,clip):
            nonlocal seq
            if random.random()<p*cta_boost: events.append({'type':typ,'seq':seq,'clip':clip,'t':round(random.uniform(1,reach),2)}); seq+=1
        if reach>=4: maybe(0.10,'call_click','cta_call')
        if reach>=15: maybe(0.15,'cta_click','cta_book')
        if reach>=21: maybe(0.32,'cta_click','cta_price')
        if reach>=24: maybe(0.13,'lead_submit','form1')
        if reach>=29.7: events.append({'type':'complete','seq':seq,'t':30.0}); seq+=1
        w("set role service_role;")
        for i in range(0,len(events),20):
            w(f"select ingest_video_events({q(vid)},{q(key)},null,null,null,null,{q(json.dumps(events[i:i+20]))}::jsonb);")
        w("reset role;")
run_video('kitchenAB12', 140, 1.6)
run_video('followupAB12', 24, 1.2, 1.5)
# spread raw events to their session time and rebuild the daily aggregates from what was really ingested
w("""update video_events e set created_at = s.started_at + make_interval(secs => least(e.seq,200)) from video_view_sessions s where s.id = e.session_id;
delete from video_analytics_daily; delete from video_daily_viewers;
insert into video_analytics_daily (video_id, day, page_visits, plays, sessions, completes, progress_25, progress_50, progress_75, progress_90, cta_clicks, call_clicks, overlay_clicks, product_selects, leads, returns, errors, watch_seconds)
select s.video_id, (s.started_at at time zone 'utc')::date,
  count(*) filter (where e.type='page_open'), count(*) filter (where e.type in ('play','replay')), count(distinct s.id) filter (where s.played),
  count(*) filter (where e.type='complete'), count(*) filter (where e.type='progress_25'), count(*) filter (where e.type='progress_50'),
  count(*) filter (where e.type='progress_75'), count(*) filter (where e.type='progress_90'), count(*) filter (where e.type='cta_click'),
  count(*) filter (where e.type='call_click'), count(*) filter (where e.type='overlay_click'), count(*) filter (where e.type='product_select'),
  count(*) filter (where e.type='lead_submit'), count(*) filter (where e.type='return'), count(*) filter (where e.type='error'), 0
from video_view_sessions s join video_events e on e.session_id=s.id group by s.video_id, (s.started_at at time zone 'utc')::date;
update video_analytics_daily d set watch_seconds = w.secs from (select video_id, (started_at at time zone 'utc')::date as day, sum(watch_seconds) as secs from video_view_sessions group by 1,2) w where w.video_id=d.video_id and w.day=d.day;
insert into video_daily_viewers select distinct video_id, (started_at at time zone 'utc')::date, viewer_hash from video_view_sessions where played and viewer_hash is not null;
update published_videos v set view_count = coalesce((select sum(page_visits) from video_analytics_daily a where a.video_id=v.id),0);
select 'sessions=' || count(*) || ' played=' || count(*) filter (where played) || ' returning=' || count(*) filter (where is_return) from video_view_sessions;
select 'events=' || count(*) from video_events;
select 'notifications=' || count(*) from owner_notifications;
select string_agg(type || ':' || n, ', ') from (select type, count(*) n from owner_notifications group by type order by type) x;""")
open('seed.sql','w').write("\n".join(out))
print(len(out),"statements")
