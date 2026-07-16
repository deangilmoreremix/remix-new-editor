import { apiKeyManager } from '../lib/apiKeyManager.js';

/**
 * Build a self-contained settings form for a single provider.
 * Each provider gets its own <form> so the Muapi, OpenAI and VideoDB keys are
 * configured and saved completely independently. Every form also exposes a
 * "Grab API Key" link that opens the provider's key dashboard in a new tab.
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} opts.description
 * @param {string} opts.grabUrl   - URL the "Grab API Key" link points to
 * @param {() => string|null} opts.getKey
 * @param {(k: string, persist?: boolean) => Promise<void>} opts.setKey
 * @param {() => void} opts.clearKey
 * @param {string} opts.placeholder
 */
function buildProviderForm({ title, description, grabUrl, getKey, setKey, clearKey, placeholder }) {
    const form = document.createElement('form');
    form.className = 'w-full bg-black/30 border border-white/5 rounded-xl p-4 mb-3';
    form.autocomplete = 'off';

    const heading = document.createElement('h3');
    heading.textContent = title;
    heading.className = 'text-sm font-black text-white mb-1';

    const desc = document.createElement('p');
    desc.textContent = description;
    desc.className = 'text-[11px] text-muted mb-3';

    const input = document.createElement('input');
    input.type = 'password';
    input.name = title.toLowerCase().replace(/\s+/g, '_') + '_key';
    input.className = 'w-full mb-2 bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors shadow-inner';
    input.value = getKey() || '';
    input.placeholder = placeholder;

    const grabLink = document.createElement('a');
    grabLink.href = grabUrl;
    grabLink.target = '_blank';
    grabLink.rel = 'noopener noreferrer';
    grabLink.textContent = 'Grab API Key';
    grabLink.className = 'inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 hover:underline transition-colors mb-3';

    const status = document.createElement('p');
    status.className = 'text-[11px] text-muted mb-3';

    const btnRow = document.createElement('div');
    btnRow.className = 'flex items-center gap-2';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.textContent = 'Save ' + title;
    saveBtn.className = 'px-4 py-2 rounded-xl bg-primary text-black font-black text-xs hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all';

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear';
    clearBtn.className = 'px-3 py-2 rounded-xl text-xs font-bold text-white/50 hover:text-white hover:bg-white/5 transition-all';

    const refreshStatus = () => {
        const key = getKey();
        status.textContent = key ? `${title} is configured.` : `No ${title} configured.`;
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const value = input.value.trim();
        try {
            if (value) {
                if (value.length < 10) {
                    throw new Error(`${title} appears too short. Please check it and try again.`);
                }
                await setKey(value, true);
            } else {
                clearKey();
            }
            refreshStatus();
            saveBtn.textContent = 'Saved ✓';
            setTimeout(() => { saveBtn.textContent = 'Save ' + title; }, 1500);
        } catch (err) {
            alert('Failed to save ' + title + ': ' + err.message);
        }
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        clearKey();
        refreshStatus();
    });

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(clearBtn);

    form.appendChild(heading);
    form.appendChild(desc);
    form.appendChild(grabLink);
    form.appendChild(input);
    form.appendChild(status);
    form.appendChild(btnRow);

    refreshStatus();
    return form;
}

/**
 * Provider API key popup. Shown once when the user lands in the app so they
 * can wire up the providers they want to use before creating content.
 *
 * @param {(typeof import('../lib/apiKeyManager.js').apiKeyManager)['hasAnyKey'] extends () => boolean ? (() => void) | undefined : never} onClose
 */
export function SettingsModal(onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6';

    const removeModal = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (onClose) onClose();
    };

    const modal = document.createElement('div');
    modal.className = 'relative w-full max-w-sm bg-panel-bg border border-white/10 rounded-2xl p-5 shadow-3xl animate-fade-in-up max-h-[90vh] overflow-y-auto';

    // Top-right close (X) button
    const closeX = document.createElement('button');
    closeX.setAttribute('aria-label', 'Close');
    closeX.innerHTML = '&times;';
    closeX.className = 'absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-2xl leading-none transition-all';
    closeX.onclick = removeModal;

    const title = document.createElement('h2');
    title.textContent = 'Welcome — set up your API keys';
    title.className = 'text-lg font-black text-white mb-1 pr-8';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Add your provider API keys to create content. Each key is stored separately on this device. You can change these anytime from Settings.';
    subtitle.className = 'text-[12px] text-muted mb-4';

    const muapiForm = buildProviderForm({
        title: 'Muapi API Key',
        description: 'Used for video generation and Muapi-powered effects.',
        grabUrl: 'https://muapi.ai/access-keys',
        getKey: () => apiKeyManager.getMuapiKey(),
        setKey: (k, p) => apiKeyManager.setMuapiKey(k, p),
        clearKey: () => apiKeyManager.clearMuapiKey(),
        placeholder: 'sk-... (Muapi key)',
    });

    const openaiForm = buildProviderForm({
        title: 'OpenAI API Key',
        description: 'Used for image and text generation via OpenAI models.',
        grabUrl: 'https://platform.openai.com/login',
        getKey: () => apiKeyManager.getOpenAIKey(),
        setKey: (k, p) => apiKeyManager.setOpenAIKey(k, p),
        clearKey: () => apiKeyManager.clearOpenAIKey(),
        placeholder: 'sk-... (OpenAI key)',
    });

    const videodbForm = buildProviderForm({
        title: 'VideoDB API Key',
        description: 'Used for video indexing, search and retrieval via VideoDB.',
        grabUrl: 'https://console.videodb.io/auth?utm_source=docs_videodb_io&utm_medium=docs_link&utm_campaign=console_auth&utm_content=docs:/pages/getting-started/quickstart&id=docs:/pages/getting-started/quickstart&referrer=https://docs.videodb.io/pages/getting-started/quickstart',
        getKey: () => apiKeyManager.getVideoDBKey(),
        setKey: (k, p) => apiKeyManager.setVideoDBKey(k, p),
        clearKey: () => apiKeyManager.clearVideoDBKey(),
        placeholder: 'VideoDB access token',
    });

    const closeRow = document.createElement('div');
    closeRow.className = 'mt-2 flex items-center justify-between gap-3';

    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip for now';
    skipBtn.className = 'px-4 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all';
    skipBtn.onclick = removeModal;

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Done';
    closeBtn.className = 'px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-black hover:shadow-glow hover:scale-[1.02] active:scale-[0.98] transition-all';
    closeBtn.onclick = removeModal;

    closeRow.appendChild(skipBtn);
    closeRow.appendChild(closeBtn);

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(muapiForm);
    modal.appendChild(openaiForm);
    modal.appendChild(videodbForm);
    modal.appendChild(closeRow);
    modal.appendChild(closeX);

    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) removeModal();
    });

    return overlay;
}
