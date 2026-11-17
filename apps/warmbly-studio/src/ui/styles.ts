// Styles are injected as a <style> tag so the package works unchanged in Vite and Next (no CSS loader needed).
export const CSS = `
.wb{--bg:#0b0d12;--panel:#12151c;--panel2:#171b24;--line:#232836;--text:#e8eaf0;--mute:#8b93a7;--acc:#6d8cff;--acc2:#4f6df0;--good:#34d399;--warn:#fbbf24;--bad:#f87171;
 display:flex;height:100%;min-height:600px;background:var(--bg);color:var(--text);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;border-radius:12px;overflow:hidden}
.wb *{box-sizing:border-box}
.wb a{color:var(--acc)}
.wb button{font:inherit;color:inherit;cursor:pointer}
.wb input,.wb select,.wb textarea{font:inherit;color:var(--text);background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:8px 10px;width:100%;outline:none}
.wb input:focus,.wb select:focus,.wb textarea:focus{border-color:var(--acc)}
.wb textarea{resize:vertical;min-height:90px}
.wb-nav{width:208px;flex:none;background:var(--panel);border-right:1px solid var(--line);padding:14px 10px;display:flex;flex-direction:column;gap:2px;overflow:auto}
.wb-brand{font-weight:700;font-size:16px;padding:6px 10px 14px;display:flex;gap:8px;align-items:center}
.wb-brand i{width:22px;height:22px;border-radius:6px;background:linear-gradient(135deg,var(--acc),#a78bfa);display:inline-block}
.wb-nav button{display:flex;gap:10px;align-items:center;background:none;border:0;padding:8px 10px;border-radius:8px;text-align:left;color:var(--mute)}
.wb-nav button:hover{background:var(--panel2);color:var(--text)}
.wb-nav button.on{background:rgba(109,140,255,.14);color:var(--text)}
.wb-nav .cnt{margin-left:auto;background:var(--acc2);color:#fff;border-radius:99px;font-size:11px;padding:0 7px}
.wb-main{flex:1;min-width:0;display:flex;flex-direction:column}
.wb-top{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--panel)}
.wb-top h1{font-size:16px;margin:0;flex:1}
.wb-body{flex:1;overflow:auto;padding:18px}
.wb-btn{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:7px 12px;display:inline-flex;gap:6px;align-items:center;white-space:nowrap}
.wb-btn:hover{border-color:var(--acc)}
.wb-btn.pri{background:var(--acc2);border-color:var(--acc2);color:#fff}
.wb-btn.dng{color:var(--bad)}
.wb-btn.sm{padding:3px 8px;font-size:12px}
.wb-btn:disabled{opacity:.5;cursor:not-allowed}
.wb-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px}
.wb-card h3{margin:0 0 10px;font-size:13px;color:var(--mute);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.wb-grid{display:grid;gap:12px}
.wb-g4{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.wb-g2{grid-template-columns:repeat(auto-fit,minmax(320px,1fr))}
.wb-stat b{display:block;font-size:24px}
.wb-stat span{color:var(--mute);font-size:12px}
.wb-badge{display:inline-block;border-radius:99px;padding:1px 9px;font-size:11px;border:1px solid var(--line);color:var(--mute)}
.wb-badge.good{color:var(--good);border-color:rgba(52,211,153,.4)} .wb-badge.warn{color:var(--warn);border-color:rgba(251,191,36,.4)} .wb-badge.bad{color:var(--bad);border-color:rgba(248,113,113,.4)} .wb-badge.acc{color:var(--acc);border-color:rgba(109,140,255,.4)}
.wb table{width:100%;border-collapse:collapse}
.wb th{text-align:left;color:var(--mute);font-weight:500;font-size:12px;padding:8px;border-bottom:1px solid var(--line)}
.wb td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
.wb tr.click:hover td{background:var(--panel2);cursor:pointer}
.wb-row{display:flex;gap:10px;align-items:center}.wb-row.wrap{flex-wrap:wrap}.wb-sp{flex:1}
.wb-mute{color:var(--mute)}.wb-sm{font-size:12px}
.wb-field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}.wb-field label{font-size:12px;color:var(--mute)}
.wb-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
.wb-modal{background:var(--panel);border:1px solid var(--line);border-radius:14px;width:min(640px,100%);max-height:90vh;overflow:auto;padding:18px}
.wb-modal h2{margin:0 0 12px;font-size:16px}
.wb-tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:14px}
.wb-tabs button{background:none;border:0;padding:8px 12px;color:var(--mute);border-bottom:2px solid transparent}
.wb-tabs button.on{color:var(--text);border-color:var(--acc)}
.wb-bar{height:8px;background:var(--panel2);border-radius:99px;overflow:hidden}.wb-bar>i{display:block;height:100%;background:var(--acc)}
.wb-empty{text-align:center;color:var(--mute);padding:30px}
.wb-toast{position:absolute;right:18px;bottom:18px;background:var(--panel2);border:1px solid var(--acc);border-radius:10px;padding:10px 14px;z-index:1100}
.wb-split{display:grid;grid-template-columns:340px 1fr;gap:12px;height:100%}
.wb-list{overflow:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.wb-item{padding:10px 12px;border-bottom:1px solid var(--line);cursor:pointer}.wb-item:hover,.wb-item.on{background:var(--panel2)}
.wb-item.unread b{color:#fff}.wb-item .dot{width:8px;height:8px;border-radius:50%;background:var(--acc);display:inline-block;margin-right:6px}
.wb-msg{border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:8px;background:var(--panel2);white-space:pre-wrap}
.wb-msg.out{border-color:rgba(109,140,255,.35)}
.wb-kan{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(220px,1fr);gap:12px;overflow:auto}
.wb-col{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px;min-height:240px}
.wb-col.over{border-color:var(--acc)}
.wb-deal{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px;margin-bottom:8px;cursor:grab}
.wb-step{display:flex;gap:10px;margin-bottom:10px}.wb-step .n{width:26px;height:26px;border-radius:50%;background:var(--acc2);display:grid;place-items:center;font-size:12px;flex:none}
.wb-step .box{flex:1;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px}
.wb-flow{display:flex;flex-direction:column;align-items:center;gap:0}
.wb-node{border:1px solid var(--line);background:var(--panel2);border-radius:10px;padding:10px 14px;min-width:260px;text-align:center}
.wb-node.trig{border-color:var(--acc)}.wb-link{width:2px;height:16px;background:var(--line)}
.wb-presence{display:flex}.wb-presence i{width:24px;height:24px;border-radius:50%;background:var(--acc2);display:grid;place-items:center;font-size:11px;font-style:normal;margin-left:-6px;border:2px solid var(--panel)}
.wb-cv{position:relative;flex:1;min-height:420px;overflow:hidden;background:var(--panel);background-image:radial-gradient(var(--line) 1px,transparent 1px);background-size:22px 22px;cursor:grab;border:1px solid var(--line);border-radius:12px}
.wb-cv.drag{cursor:grabbing}
.wb-cv-world{position:absolute;left:0;top:0;transform-origin:0 0}
.wb-cv svg.edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.wb-cv path.e{fill:none;stroke:var(--mute);stroke-opacity:.55;stroke-width:1.5}
.wb-cv path.e.dash{stroke-dasharray:4 4;stroke-opacity:.35}.wb-cv path.e.hot{stroke:var(--acc);stroke-opacity:1;stroke-width:2.5}
.wb-cn{position:absolute;display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--panel2);border:1px solid var(--line);border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.25);cursor:pointer;text-align:left;user-select:none}
.wb-cn:hover{border-color:var(--acc)}.wb-cn.sel{border-color:var(--acc);box-shadow:0 0 0 3px rgba(109,140,255,.25)}.wb-cn.hot{border-color:var(--good);box-shadow:0 0 0 3px rgba(52,211,153,.2)}.wb-cn.dim{opacity:.4}
.wb-cn .ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none;background:rgba(109,140,255,.14);color:var(--acc)}
.wb-cn .ic.warn{background:rgba(251,191,36,.14);color:var(--warn)}.wb-cn .ic.good{background:rgba(52,211,153,.14);color:var(--good)}.wb-cn .ic.purple{background:rgba(167,139,250,.16);color:#a78bfa}.wb-cn .ic.mute{background:var(--line);color:var(--mute)}
.wb-cn .t{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wb-cn .s{font-size:11px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wb-cn>div{min-width:0}
.wb-cn.pill{padding:0 12px;border-radius:99px;justify-content:center;gap:6px;font-size:12px;color:var(--mute);background:var(--panel);box-shadow:none}
.wb-pl{position:absolute;width:26px;height:26px;border-radius:50%;border:1px solid var(--line);background:var(--panel);color:var(--mute);display:grid;place-items:center;transform:translate(-50%,-50%);padding:0;cursor:pointer;z-index:2}
.wb-pl:hover{border-color:var(--acc);color:var(--acc)}.wb-pl.edge{opacity:0}.wb-cv:hover .wb-pl.edge{opacity:.55}.wb-pl.edge:hover,.wb-pl.edge.open{opacity:1}
.wb-lab{position:absolute;transform:translate(-50%,-50%);font-size:11px;padding:1px 9px;border-radius:99px;border:1px solid var(--line);background:var(--panel);color:var(--mute);z-index:1}
.wb-lab.yes{color:var(--good);border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.1)}
.wb-menu{position:absolute;z-index:30;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:6px;min-width:210px;box-shadow:0 10px 30px rgba(0,0,0,.45)}
.wb-menu button{display:flex;gap:10px;align-items:center;width:100%;background:none;border:0;padding:7px 9px;border-radius:8px;text-align:left}.wb-menu button:hover{background:var(--panel2)}.wb-menu .ic{color:var(--acc)}
.wb-cv-tools{position:absolute;left:12px;bottom:12px;display:flex;align-items:center;gap:2px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:3px;z-index:5}
.wb-cv-tools button{background:none;border:0;width:28px;height:28px;border-radius:7px;display:grid;place-items:center}.wb-cv-tools button:hover{background:var(--panel2)}.wb-cv-tools span{font-size:12px;min-width:44px;text-align:center}
.wb-ed{display:grid;grid-template-columns:1fr 330px;gap:12px;min-height:520px}.wb-ed.solo{grid-template-columns:1fr}
.wb-insp{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px;overflow:auto;max-height:70vh}
.wb-insp h3{margin:0 0 10px;font-size:13px}
@media(max-width:900px){.wb-ed{grid-template-columns:1fr}}
.wb-ib{display:grid;grid-template-columns:200px 370px 1fr;height:100%;min-height:560px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
.wb-ib-rail{border-right:1px solid var(--line);overflow:auto;padding:10px 8px;background:var(--panel)}
.wb-ib-rail .sec{font-size:11px;letter-spacing:.06em;color:var(--mute);margin:14px 8px 6px;display:flex;align-items:center;gap:6px;text-transform:uppercase}
.wb-ib-rail button.f{display:flex;gap:9px;align-items:center;width:100%;background:none;border:0;padding:6px 8px;border-radius:8px;color:var(--mute);text-align:left}
.wb-ib-rail button.f:hover{background:var(--panel2);color:var(--text)}.wb-ib-rail button.f.on{background:rgba(109,140,255,.14);color:var(--text)}
.wb-ib-rail .n{margin-left:auto;font-size:11px;color:var(--mute)}.wb-ib-rail .n.hot{color:var(--acc);font-weight:700}
.wb-ib-rail .dot{width:9px;height:9px;border-radius:50%;flex:none}
.wb-ib-rail input{padding:5px 8px;font-size:12px;margin:0 0 4px}
.wb-ib-list{border-right:1px solid var(--line);display:flex;flex-direction:column;min-width:0;background:var(--panel)}
.wb-ib-head{padding:10px 12px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:8px}
.wb-ib-scroll{overflow:auto;flex:1}
.wb-ib-grp{font-size:11px;letter-spacing:.06em;color:var(--mute);padding:10px 14px 4px;text-transform:uppercase}
.wb-ib-item{display:flex;gap:10px;padding:10px 14px;border-bottom:1px solid var(--line);cursor:pointer;position:relative}
.wb-ib-item:hover,.wb-ib-item.on{background:var(--panel2)}.wb-ib-item.on:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--acc)}
.wb-ib-item .main{min-width:0;flex:1}.wb-ib-item .top{display:flex;gap:8px;align-items:baseline}.wb-ib-item .nm{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-ib-item.read .nm{font-weight:500;color:var(--mute)}
.wb-ib-item .sub{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.wb-ib-item .pv{font-size:12px;color:var(--mute);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wb-ib-item .ud{width:8px;height:8px;border-radius:50%;background:var(--acc);flex:none;margin-top:6px}.wb-ib-item .ud.off{background:transparent}
.wb-ib-read{display:flex;flex-direction:column;min-width:0;background:var(--bg)}
.wb-ib-rh{padding:14px 18px;border-bottom:1px solid var(--line);background:var(--panel)}
.wb-ib-acts{display:flex;gap:2px;align-items:center;flex-wrap:wrap}.wb-ib-acts button{background:none;border:0;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--mute)}
.wb-ib-acts button:hover{background:var(--panel2);color:var(--text)}.wb-ib-acts button.on{color:var(--warn)}
.wb-av{width:30px;height:30px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);display:grid;place-items:center;font-size:11px;font-weight:700;flex:none;color:var(--mute)}
.wb-ib-body{padding:18px;overflow:auto;flex:1}
.wb-ib-msg{padding:14px 0;border-bottom:1px solid var(--line)}.wb-ib-msg .tx{white-space:pre-wrap;margin-top:10px}
.wb-ib-foot{padding:12px 18px;border-top:1px solid var(--line);background:var(--panel)}
.wb-chk{width:auto!important;margin-top:4px}
kbd{border:1px solid var(--line);border-radius:5px;padding:0 5px;font-size:11px;color:var(--mute);background:var(--panel2)}
@media(max-width:1100px){.wb-ib{grid-template-columns:170px 320px 1fr}}
@media(max-width:900px){.wb-ib{grid-template-columns:1fr;height:auto}.wb-ib-rail{display:none}.wb-ib-list{max-height:50vh}}
@media(max-width:760px){.wb{flex-direction:column}.wb-nav{width:auto;flex-direction:row;overflow:auto;border-right:0;border-bottom:1px solid var(--line)}.wb-brand{display:none}.wb-split{grid-template-columns:1fr}}
`;
