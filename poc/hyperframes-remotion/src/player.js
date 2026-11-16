// Dev-only: official <hyperframes-player> loading a (personalized) composition via srcdoc.
import '@hyperframes/player';
const params = new URLSearchParams(location.search);
const name = params.get('block') || 'sdk-lt-clean-bar-A';
const html = await (await fetch(`/blocks/${name}.html`)).text();
const p = document.createElement('hyperframes-player');
p.setAttribute('width', params.get('w') || '1920'); p.setAttribute('height', params.get('h') || '1080');
p.style.cssText = 'width:960px;height:540px;display:block';
p.setAttribute('srcdoc', html);
document.getElementById('holder').appendChild(p);
window.__player = p;
window.__ready = new Promise((res) => p.addEventListener('ready', () => res(true), { once: true }));
p.addEventListener('error', (e) => { window.__playerError = String(e.detail || e.message || 'error'); });
