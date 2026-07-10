import { apiKeyManager } from '../lib/apiKeyManager.js';

/**
 * Build a self-contained settings form for a single provider.
 * Each provider gets its own <form> so the Muapi and OpenAI keys are
 * configured and saved completely independently.
 */
function buildProviderForm({ title, description, getKey, setKey, clearKey, placeholder }) {
    const form = document.createElement('form');
    form.className = 'w-full bg-black/30 border border-white/5 rounded-2xl p-5 mb-4';
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
    form.appendChild(input);
    form.appendChild(status);
    form.appendChild(btnRow);

    refreshStatus();
    return form;
}

export function SettingsModal(onClose) {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-6';

    const removeModal = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (onClose) onClose();
    };

    const modal = document.createElement('div');
    modal.className = 'w-full max-w-md bg-panel-bg border border-white/10 rounded-3xl p-8 shadow-3xl animate-fade-in-up';

    const title = document.createElement('h2');
    title.textContent = 'Settings';
    title.className = 'text-xl font-black text-white mb-1';

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Add your provider API keys to create content. Each key is stored separately on this device.';
    subtitle.className = 'text-[12px] text-muted mb-6';

    const muapiForm = buildProviderForm({
        title: 'Muapi API Key',
        description: 'Used for video generation and Muapi-powered effects.',
        getKey: () => apiKeyManager.getMuapiKey(),
        setKey: (k, p) => apiKeyManager.setMuapiKey(k, p),
        clearKey: () => apiKeyManager.clearMuapiKey(),
        placeholder: 'sk-... (Muapi key)',
    });

    const openaiForm = buildProviderForm({
        title: 'OpenAI API Key',
        description: 'Used for image and text generation via OpenAI models.',
        getKey: () => apiKeyManager.getOpenAIKey(),
        setKey: (k, p) => apiKeyManager.setOpenAIKey(k, p),
        clearKey: () => apiKeyManager.clearOpenAIKey(),
        placeholder: 'sk-... (OpenAI key)',
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'mt-2 w-full px-6 py-2.5 rounded-xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/5 transition-all';
    closeBtn.onclick = removeModal;

    modal.appendChild(title);
    modal.appendChild(subtitle);
    modal.appendChild(muapiForm);
    modal.appendChild(openaiForm);
    modal.appendChild(closeBtn);

    overlay.appendChild(modal);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) removeModal();
    });

    return overlay;
}
