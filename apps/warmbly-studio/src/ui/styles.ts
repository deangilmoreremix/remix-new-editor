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
@media(max-width:760px){.wb{flex-direction:column}.wb-nav{width:auto;flex-direction:row;overflow:auto;border-right:0;border-bottom:1px solid var(--line)}.wb-brand{display:none}.wb-split{grid-template-columns:1fr}}
`;
