// src/lib/controls/renderers.js
// DOM renderers for each control type.
// Each renderer returns { element, value, onChange, destroy }.

export function renderTextInput(config, state) {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = state.getValue(config.key, config.metadata.default ?? '');
  el.placeholder = config.metadata.placeholder || '';
  el.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';

  el.oninput = () => {
    state.setValue(config.key, el.value);
    config.onChange?.(el.value);
  };

  return {
    element: el,
    value: () => state.getValue(config.key, config.metadata.default),
    onChange: (v) => { el.value = v; state.setValue(config.key, v); },
    destroy: () => { el.oninput = null; },
  };
}

export function renderTextarea(config, state) {
  const el = document.createElement('textarea');
  el.value = state.getValue(config.key, config.metadata.default ?? '');
  el.rows = config.metadata.rows || 4;
  el.placeholder = config.metadata.placeholder || '';
  el.className = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-y';

  el.oninput = () => {
    state.setValue(config.key, el.value);
    config.onChange?.(el.value);
  };

  return {
    element: el,
    value: () => state.getValue(config.key, config.metadata.default),
    onChange: (v) => { el.value = v; state.setValue(config.key, v); },
    destroy: () => { el.oninput = null; },
  };
}

export function renderPromptInput(config, state) {
  const el = document.createElement('textarea');
  el.value = state.getValue(config.key, config.metadata.default ?? '');
  el.rows = 5;
  el.placeholder = config.metadata.placeholder || 'Describe what you want to create...';
  el.className = 'w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors resize-y';

  el.oninput = () => {
    state.setValue(config.key, el.value);
    config.onChange?.(el.value);
  };

  return {
    element: el,
    value: () => state.getValue(config.key, config.metadata.default),
    onChange: (v) => { el.value = v; state.setValue(config.key, v); },
    destroy: () => { el.oninput = null; },
  };
}

export function renderNumberInput(config, state) {
  const el = document.createElement('input');
  el.type = 'number';
  el.value = state.getValue(config.key, config.metadata.default ?? 0);
  if (config.metadata.min != null) el.min = config.metadata.min;
  if (config.metadata.max != null) el.max = config.metadata.max;
  if (config.metadata.step != null) el.step = config.metadata.step;
  el.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';

  el.oninput = () => {
    const num = parseFloat(el.value);
    state.setValue(config.key, isNaN(num) ? 0 : num);
    config.onChange?.(state.getValue(config.key));
  };

  return {
    element: el,
    value: () => parseFloat(state.getValue(config.key, config.metadata.default ?? 0)),
    onChange: (v) => { el.value = v; state.setValue(config.key, v); },
    destroy: () => { el.oninput = null; },
  };
}

export function renderIntegerInput(config, state) {
  const el = document.createElement('input');
  el.type = 'number';
  el.step = '1';
  el.value = state.getValue(config.key, config.metadata.default ?? 0);
  if (config.metadata.min != null) el.min = config.metadata.min;
  if (config.metadata.max != null) el.max = config.metadata.max;
  el.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';

  el.oninput = () => {
    const num = parseInt(el.value, 10);
    state.setValue(config.key, isNaN(num) ? 0 : num);
    config.onChange?.(state.getValue(config.key));
  };

  return {
    element: el,
    value: () => parseInt(state.getValue(config.key, config.metadata.default ?? 0), 10),
    onChange: (v) => { el.value = v; state.setValue(config.key, v); },
    destroy: () => { el.oninput = null; },
  };
}

export function renderSlider(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center gap-3';

  const slider = document.createElement('input');
  slider.type = 'range';
  slider.value = state.getValue(config.key, config.metadata.default ?? 0);
  if (config.metadata.min != null) slider.min = config.metadata.min;
  if (config.metadata.max != null) slider.max = config.metadata.max;
  if (config.metadata.step != null) slider.step = config.metadata.step;
  slider.className = 'flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary';

  const display = document.createElement('span');
  display.className = 'text-xs font-bold text-primary min-w-[3rem] text-right';
  display.textContent = slider.value;

  slider.oninput = () => {
    display.textContent = slider.value;
    state.setValue(config.key, parseFloat(slider.value));
    config.onChange?.(parseFloat(slider.value));
  };

  wrapper.appendChild(slider);
  wrapper.appendChild(display);

  return {
    element: wrapper,
    value: () => parseFloat(state.getValue(config.key, config.metadata.default ?? 0)),
    onChange: (v) => { slider.value = v; display.textContent = v; state.setValue(config.key, v); },
    destroy: () => { slider.oninput = null; },
  };
}

export function renderBooleanToggle(config, state) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('role', 'switch');
  btn.setAttribute('aria-checked', String(state.getValue(config.key, config.metadata.default ?? false)));

  const isActive = state.getValue(config.key, config.metadata.default ?? false);
  btn.className = `w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-primary' : 'bg-white/10'} relative`;

  const dot = document.createElement('span');
  dot.className = `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : ''}`;
  btn.appendChild(dot);

  btn.onclick = () => {
    const next = !state.getValue(config.key, false);
    state.setValue(config.key, next);
    btn.setAttribute('aria-checked', String(next));
    btn.className = `w-11 h-6 rounded-full transition-colors ${next ? 'bg-primary' : 'bg-white/10'} relative`;
    dot.className = `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${next ? 'translate-x-5' : ''}`;
    config.onChange?.(next);
  };

  return {
    element: btn,
    value: () => !!state.getValue(config.key, config.metadata.default ?? false),
    onChange: (v) => { btn.setAttribute('aria-checked', String(v)); btn.click(); },
    destroy: () => { btn.onclick = null; },
  };
}

export function renderSelect(config, state) {
  const el = document.createElement('select');
  el.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';

  const options = config.metadata.options || [];
  const current = state.getValue(config.key, config.metadata.default ?? options[0] ?? '');

  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (String(opt) === String(current)) option.selected = true;
    el.appendChild(option);
  });

  el.onchange = () => {
    state.setValue(config.key, el.value);
    config.onChange?.(el.value);
  };

  return {
    element: el,
    value: () => state.getValue(config.key, config.metadata.default ?? options[0]),
    onChange: (v) => { el.value = v; state.setValue(config.key, v); },
    destroy: () => { el.onchange = null; },
  };
}

export function renderEnumGroup(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-wrap gap-2';

  const options = config.metadata.options || [];
  const current = state.getValue(config.key, config.metadata.default ?? options[0] ?? '');

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt;
    const isActive = String(opt) === String(current);
    btn.className = `px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      isActive ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-secondary border border-transparent hover:border-white/5'
    }`;

    btn.onclick = () => {
      state.setValue(config.key, opt);
      config.onChange?.(opt);
      wrapper.querySelectorAll('button').forEach(b => {
        b.classList.remove('bg-primary/20', 'text-primary', 'border-primary/30');
        b.classList.add('bg-white/5', 'text-secondary', 'border-transparent');
      });
      btn.classList.remove('bg-white/5', 'text-secondary', 'border-transparent');
      btn.classList.add('bg-primary/20', 'text-primary', 'border-primary/30');
    };

    wrapper.appendChild(btn);
  });

  return {
    element: wrapper,
    value: () => state.getValue(config.key, config.metadata.default ?? options[0]),
    onChange: (v) => {
      state.setValue(config.key, v);
      Array.from(wrapper.children).forEach(btn => {
        const isActive = btn.textContent === String(v);
        btn.classList.toggle('bg-primary/20', isActive);
        btn.classList.toggle('text-primary', isActive);
        btn.classList.toggle('border-primary/30', isActive);
        btn.classList.toggle('bg-white/5', !isActive);
        btn.classList.toggle('text-secondary', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
      });
    },
    destroy: () => { wrapper.querySelectorAll('button').forEach(b => b.onclick = null); },
  };
}

export function renderImageUpload(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-2';

  const dropzone = document.createElement('div');
  dropzone.className = 'border-2 border-dashed border-white/10 rounded-2xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors';
  dropzone.innerHTML = '<span class="text-xs text-muted">Click or drop an image here</span>';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.className = 'hidden';

  dropzone.onclick = () => input.click();

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result;
      state.setValue(config.key, url);
      dropzone.innerHTML = `<img src="${url}" class="max-h-40 mx-auto rounded-xl border border-white/10" />`;
      config.onChange?.(url);
    };
    reader.readAsDataURL(file);
  };

  wrapper.appendChild(dropzone);
  wrapper.appendChild(input);

  return {
    element: wrapper,
    value: () => state.getValue(config.key),
    onChange: (v) => { state.setValue(config.key, v); },
    destroy: () => { dropzone.onclick = null; input.onchange = null; },
  };
}

export function renderImageArrayUpload(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid grid-cols-3 gap-3';

  const images = state.getValue(config.key, []);
  const refresh = () => {
    wrapper.innerHTML = '';
    (images.length === 0 ? [null] : images).forEach((url, idx) => {
      const cell = document.createElement('div');
      cell.className = 'aspect-square border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors relative overflow-hidden';

      if (url) {
        cell.innerHTML = `<img src="${url}" class="w-full h-full object-cover rounded-xl" />`;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '✕';
        remove.className = 'absolute top-1 right-1 w-6 h-6 bg-black/60 text-white text-xs rounded-full flex items-center justify-center';
        remove.onclick = (e) => {
          e.stopPropagation();
          images.splice(idx, 1);
          state.setValue(config.key, [...images]);
          config.onChange?.([...images]);
          refresh();
        };
        cell.appendChild(remove);
      } else {
        cell.innerHTML = '<span class="text-[10px] text-muted">+</span>';
        cell.onclick = () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.className = 'hidden';
          document.body.appendChild(input);
          input.onchange = () => {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              images.push(reader.result);
              state.setValue(config.key, [...images]);
              config.onChange?.([...images]);
              refresh();
              document.body.removeChild(input);
            };
            reader.readAsDataURL(file);
          };
          input.click();
        };
      }

      wrapper.appendChild(cell);
    });
  };

  refresh();

  return {
    element: wrapper,
    value: () => state.getValue(config.key, []),
    onChange: (v) => { state.setValue(config.key, v); },
    destroy: () => { wrapper.innerHTML = ''; },
  };
}

export function renderVideoUpload(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-2';

  const dropzone = document.createElement('div');
  dropzone.className = 'border-2 border-dashed border-white/10 rounded-2xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors';
  dropzone.innerHTML = '<span class="text-xs text-muted">Click or drop a video here</span>';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'video/*';
  input.className = 'hidden';

  dropzone.onclick = () => input.click();

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    state.setValue(config.key, url);
    dropzone.innerHTML = `<video src="${url}" class="max-h-40 mx-auto rounded-xl border border-white/10" controls />`;
    config.onChange?.(url);
  };

  wrapper.appendChild(dropzone);
  wrapper.appendChild(input);

  return {
    element: wrapper,
    value: () => state.getValue(config.key),
    onChange: (v) => { state.setValue(config.key, v); },
    destroy: () => { dropzone.onclick = null; input.onchange = null; },
  };
}

export function renderAudioUpload(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-2';

  const dropzone = document.createElement('div');
  dropzone.className = 'border-2 border-dashed border-white/10 rounded-2xl p-6 text-center cursor-pointer hover:border-primary/40 transition-colors';
  dropzone.innerHTML = '<span class="text-xs text-muted">Click or drop audio here</span>';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'audio/*';
  input.className = 'hidden';

  dropzone.onclick = () => input.click();

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    state.setValue(config.key, url);
    dropzone.innerHTML = `<audio src="${url}" class="max-h-40 mx-auto rounded-xl border border-white/10" controls />`;
    config.onChange?.(url);
  };

  wrapper.appendChild(dropzone);
  wrapper.appendChild(input);

  return {
    element: wrapper,
    value: () => state.getValue(config.key),
    onChange: (v) => { state.setValue(config.key, v); },
    destroy: () => { dropzone.onclick = null; input.onchange = null; },
  };
}

export function renderColorInput(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center gap-2';

  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = state.getValue(config.key, config.metadata.default ?? '#ffffff');
  picker.className = 'w-8 h-8 rounded-lg overflow-hidden cursor-pointer border border-white/10';

  const text = document.createElement('input');
  text.type = 'text';
  text.value = state.getValue(config.key, config.metadata.default ?? '#ffffff');
  text.className = 'w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white uppercase';

  const sync = (val) => {
    picker.value = val;
    text.value = val;
    state.setValue(config.key, val);
    config.onChange?.(val);
  };

  picker.oninput = () => sync(picker.value);
  text.onchange = () => sync(text.value);

  wrapper.appendChild(picker);
  wrapper.appendChild(text);

  return {
    element: wrapper,
    value: () => state.getValue(config.key, config.metadata.default),
    onChange: (v) => sync(v),
    destroy: () => { picker.oninput = null; text.onchange = null; },
  };
}

export function renderAspectRatioGrid(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid grid-cols-4 gap-2';

  const options = config.metadata.options || [];
  const current = state.getValue(config.key, config.metadata.default ?? options[0] ?? '');

  options.forEach(ratio => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = ratio;
    const isActive = ratio === current;
    btn.className = `px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
      isActive ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-white/5 text-secondary border border-transparent hover:border-white/5'
    }`;

    btn.onclick = () => {
      state.setValue(config.key, ratio);
      config.onChange?.(ratio);
      wrapper.querySelectorAll('button').forEach(b => {
        b.classList.remove('bg-primary/20', 'text-primary', 'border-primary/30');
        b.classList.add('bg-white/5', 'text-secondary', 'border-transparent');
      });
      btn.classList.remove('bg-white/5', 'text-secondary', 'border-transparent');
      btn.classList.add('bg-primary/20', 'text-primary', 'border-primary/30');
    };

    wrapper.appendChild(btn);
  });

  return {
    element: wrapper,
    value: () => state.getValue(config.key, config.metadata.default ?? options[0]),
    onChange: (v) => {
      state.setValue(config.key, v);
      Array.from(wrapper.children).forEach(btn => {
        const isActive = btn.textContent === String(v);
        btn.classList.toggle('bg-primary/20', isActive);
        btn.classList.toggle('text-primary', isActive);
        btn.classList.toggle('border-primary/30', isActive);
        btn.classList.toggle('bg-white/5', !isActive);
        btn.classList.toggle('text-secondary', !isActive);
        btn.classList.toggle('border-transparent', !isActive);
      });
    },
    destroy: () => { wrapper.querySelectorAll('button').forEach(b => b.onclick = null); },
  };
}

export function renderSeedInput(config, state) {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex items-center gap-2';

  const input = document.createElement('input');
  input.type = 'number';
  input.value = state.getValue(config.key, config.metadata.default ?? -1);
  if (config.metadata.min != null) input.min = config.metadata.min;
  if (config.metadata.max != null) input.max = config.metadata.max;
  input.className = 'flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-primary/50 transition-colors';

  const randomBtn = document.createElement('button');
  randomBtn.type = 'button';
  randomBtn.textContent = '🎲';
  randomBtn.title = 'Randomize seed';
  randomBtn.className = 'px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors';

  randomBtn.onclick = () => {
    const seed = Math.floor(Math.random() * 999999999);
    input.value = seed;
    state.setValue(config.key, seed);
    config.onChange?.(seed);
  };

  input.oninput = () => {
    const num = parseInt(input.value, 10);
    state.setValue(config.key, isNaN(num) ? -1 : num);
    config.onChange?.(state.getValue(config.key));
  };

  wrapper.appendChild(input);
  wrapper.appendChild(randomBtn);

  return {
    element: wrapper,
    value: () => parseInt(state.getValue(config.key, config.metadata.default ?? -1), 10),
    onChange: (v) => { input.value = v; state.setValue(config.key, v); },
    destroy: () => { input.oninput = null; randomBtn.onclick = null; },
  };
}

export function renderModelSelector(config, state) {
  // This is a placeholder; studios usually have their own model selector UI.
  // We return a simple select if options are provided.
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-1';

  const label = document.createElement('label');
  label.className = 'text-xs font-bold text-secondary uppercase tracking-wider';
  label.textContent = config.metadata.description || config.label || 'Model';
  wrapper.appendChild(label);

  const select = document.createElement('select');
  select.className = 'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors';

  const options = config.metadata.options || [];
  const current = state.getValue(config.key, config.metadata.default ?? options[0] ?? '');

  options.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt;
    option.textContent = opt;
    if (String(opt) === String(current)) option.selected = true;
    select.appendChild(option);
  });

  select.onchange = () => {
    state.setValue(config.key, select.value);
    config.onChange?.(select.value);
  };

  wrapper.appendChild(select);

  return {
    element: wrapper,
    value: () => state.getValue(config.key, config.metadata.default ?? options[0]),
    onChange: (v) => { select.value = v; state.setValue(config.key, v); },
    destroy: () => { select.onchange = null; },
  };
}
