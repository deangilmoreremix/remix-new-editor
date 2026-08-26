import {
  getSupplementalModelInputs,
  createModelParameterValues,
  buildSupplementalInputPayload,
} from "../../modelParameters.js";

const FIELD_CLASS =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white outline-none transition-colors focus:border-[#22d3ee]/50";

const CONTROL_LAYOUT_CLASS =
  "h-[38px] flex items-center gap-2 rounded-md transition-all border group whitespace-nowrap shadow-inner focus:outline-none focus-visible:border-[#22d3ee]/45 focus-visible:ring-1 focus-visible:ring-[#22d3ee]/30";

const CONTROL_IDLE_CLASS =
  "text-white bg-[#16161a]/60 hover:bg-[#202026]/80 border-white/[0.06]";

const CONTROL_ACTIVE_CLASS =
  "text-[#22d3ee] bg-[#22d3ee]/10 hover:bg-[#22d3ee]/15 border-[#22d3ee]/25";

const PROMPT_CONTROL_LABEL_CLASS =
  "text-xs font-semibold text-current opacity-70 group-hover:text-[#22d3ee] group-hover:opacity-100 transition-all";

function joinClasses(...classes) {
  return classes.filter(Boolean).join(" ");
}

function chevronIcon() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "10");
  svg.setAttribute("height", "10");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "3");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.className =
    "text-current opacity-[0.45] group-hover:opacity-100 flex-shrink-0 transition-opacity";
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "m6 9 6 6 6-6");
  svg.appendChild(path);
  return svg;
}

function createEmptyValue(schema = {}) {
  if (schema.default !== undefined) return schema.default;
  if (schema.type === "boolean") return false;
  if (schema.type === "array") return [];
  if (schema.type === "object") {
    return Object.fromEntries(
      Object.entries(schema.properties || {}).map(([key, property]) => [
        key,
        createEmptyValue(property),
      ]),
    );
  }
  if (["number", "integer", "int"].includes(schema.type)) return 0;
  return "";
}

function FieldLabel(schema, inputKey) {
  const wrapper = document.createElement("div");
  wrapper.className = "min-w-0";

  const title = document.createElement("div");
  title.className = "text-xs font-semibold text-white/75";
  title.textContent = schema.title || inputKey.replaceAll("_", " ");
  wrapper.appendChild(title);

  if (schema.description) {
    const desc = document.createElement("div");
    desc.className = "mt-0.5 text-[10px] leading-relaxed text-white/35";
    desc.textContent = schema.description;
    wrapper.appendChild(desc);
  }

  return wrapper;
}

function ScalarInput(schema, value, label, onChange) {
  if (schema.enum) {
    const select = document.createElement("select");
    select.className = FIELD_CLASS;
    select.setAttribute("aria-label", label);
    select.value = value ?? "";
    for (const option of schema.enum) {
      const opt = document.createElement("option");
      opt.value = String(option);
      opt.textContent = String(option);
      select.appendChild(opt);
    }
    select.addEventListener("change", (event) => {
      const selected = schema.enum.find(
        (option) => String(option) === event.target.value,
      );
      onChange(selected);
    });
    return select;
  }

  if (schema.type === "boolean") {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("role", "switch");
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-checked", String(!!value));
    btn.className = joinClasses(
      "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
      value
        ? "border-[#22d3ee]/50 bg-[#22d3ee]/30"
        : "border-white/10 bg-white/[0.06]",
    );
    const knob = document.createElement("span");
    knob.className = joinClasses(
      "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
      value ? "translate-x-5" : "translate-x-0",
    );
    btn.appendChild(knob);
    btn.addEventListener("click", () => {
      const next = !value;
      btn.setAttribute("aria-checked", String(next));
      btn.className = joinClasses(
        "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
        next
          ? "border-[#22d3ee]/50 bg-[#22d3ee]/30"
          : "border-white/10 bg-white/[0.06]",
      );
      knob.className = joinClasses(
        "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
        next ? "translate-x-5" : "translate-x-0",
      );
      onChange(next);
    });
    return btn;
  }

  const numeric = ["number", "integer", "int"].includes(schema.type);
  const input = document.createElement("input");
  input.className = FIELD_CLASS;
  input.setAttribute("aria-label", label);
  input.type = numeric ? "number" : "text";
  input.value = value ?? "";
  if ((schema.minValue ?? schema.minimum) !== undefined)
    input.min = String(schema.minValue ?? schema.minimum);
  if ((schema.maxValue ?? schema.maximum) !== undefined)
    input.max = String(schema.maxValue ?? schema.maximum);
  input.step = String(
    schema.step || (schema.type === "number" ? "any" : 1),
  );
  if (
    schema.examples?.[0] &&
    typeof schema.examples[0] !== "object"
  ) {
    input.placeholder = String(schema.examples[0]);
  }
  input.addEventListener("input", (event) => {
    onChange(event.target.value);
  });
  return input;
}

function ArrayInput(schema, value, label, onChange) {
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col gap-2";

  const items = Array.isArray(value) ? value : [];
  const itemSchema = schema.items || { type: "string" };
  const maxItems = schema.maxItems ?? schema.max_items ?? Infinity;

  const render = () => {
    wrapper.replaceChildren();
    items.forEach((item, index) => {
      const itemCard = document.createElement("div");
      itemCard.className =
        "rounded-lg border border-white/[0.07] bg-black/20 p-2.5";

      let inputEl;
      if (itemSchema.type === "object") {
        const objWrapper = document.createElement("div");
        objWrapper.className = "flex flex-col gap-2";
        for (const [key, property] of Object.entries(
          itemSchema.properties || {},
        )) {
          const fieldLabel = document.createElement("label");
          fieldLabel.className = "flex flex-col gap-1";
          const span = document.createElement("span");
          span.className = "text-[10px] font-semibold text-white/45";
          span.textContent = property.title || key.replaceAll("_", " ");
          fieldLabel.appendChild(span);
          const scalar = ScalarInput(
            property,
            item?.[key] ?? createEmptyValue(property),
            property.title || key.replaceAll("_", " "),
            (nextValue) => {
              const next = [...items];
              next[index] = { ...item, [key]: nextValue };
              onChange(next);
            },
          );
          fieldLabel.appendChild(scalar);
          objWrapper.appendChild(fieldLabel);
        }
        itemCard.appendChild(objWrapper);
      } else {
        inputEl = ScalarInput(
          itemSchema,
          item,
          `${label} ${index + 1}`,
          (nextValue) => {
            const next = [...items];
            next[index] = nextValue;
            onChange(next);
          },
        );
        itemCard.appendChild(inputEl);
      }

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "Remove";
      removeBtn.setAttribute("aria-label", `Remove ${label} ${index + 1}`);
      removeBtn.className =
        "mt-2 text-[10px] font-semibold text-red-300/70 hover:text-red-300";
      removeBtn.addEventListener("click", () => {
        onChange(items.filter((_, i) => i !== index));
      });
      itemCard.appendChild(removeBtn);

      wrapper.appendChild(itemCard);
    });

    if (items.length < maxItems) {
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.setAttribute("aria-label", `Add ${label}`);
      addBtn.textContent = "+ Add";
      addBtn.className =
        "rounded-lg border border-dashed border-white/10 px-3 py-2 text-xs font-semibold text-white/45 hover:border-[#22d3ee]/30 hover:text-[#22d3ee]";
      addBtn.addEventListener("click", () => {
        onChange([...items, createEmptyValue(itemSchema)]);
      });
      wrapper.appendChild(addBtn);
    }
  };

  render();
  wrapper._render = render;
  return wrapper;
}

/**
 * Vanilla JS ModelParameterControls
 * Factory function that creates a parameter controls panel.
 *
 * @param {object} options
 * @param {object} options.model - Model object from models.js (with .inputs)
 * @param {object} options.initialValues - Current parameter values
 * @param {function} options.onChange - Callback(key, value) when a parameter changes
 * @param {function} options.onPayloadChange - Callback(payload) when any param changes (receives full supplemental payload)
 * @returns {{ element: HTMLElement, getValues: () => object, setValues: (v) => void, destroy: () => void }}
 */
export function createModelParameterControls({
  model,
  initialValues,
  onChange,
  onPayloadChange,
}) {
  const inputs = getSupplementalModelInputs(model);
  const values = { ...createModelParameterValues(model, initialValues) };
  let open = false;
  let popover = null;
  const changeHandlers = new Map();

  const wrapper = document.createElement("div");
  wrapper.className = "relative";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = joinClasses(CONTROL_LAYOUT_CLASS, "px-4", CONTROL_IDLE_CLASS);

  const labelSpan = document.createElement("span");
  labelSpan.className = "text-[10px] font-black text-primary/80";
  labelSpan.textContent = "PARAMS";

  const badge = document.createElement("span");
  badge.className = PROMPT_CONTROL_LABEL_CLASS;
  badge.textContent = String(inputs.length);

  btn.appendChild(labelSpan);
  btn.appendChild(badge);
  btn.appendChild(chevronIcon());

  function emitChange(key, value) {
    values[key] = value;
    onChange?.(key, value);
    if (onPayloadChange) {
      const payload = buildSupplementalInputPayload(model, values);
      onPayloadChange(payload);
    }
  }

  function buildPopover() {
    popover = document.createElement("div");
    popover.className =
      "absolute bottom-[calc(100%+12px)] left-0 z-50 bg-[#0c0c0f]/95 rounded-xl p-3.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] border border-white/[0.08] backdrop-blur-2xl min-w-[160px] max-h-[40vh] overflow-y-auto custom-scrollbar w-[min(420px,calc(100vw-2rem))] max-h-[60vh]";
    popover.addEventListener("click", (event) => event.stopPropagation());

    const header = document.createElement("div");
    header.className =
      "text-[11px] font-semibold text-white/30 uppercase tracking-wider pb-2 border-b border-white/[0.05] mb-2 px-1";
    header.textContent = "Model parameters";
    popover.appendChild(header);

    const content = document.createElement("div");
    content.className = "flex flex-col gap-4";

    for (const { key, schema } of inputs) {
      const fieldWrapper = document.createElement("div");
      fieldWrapper.className = "flex flex-col gap-2";

      const row = document.createElement("div");
      row.className =
        schema.type === "boolean"
          ? "flex items-center justify-between gap-4"
          : "flex flex-col gap-2";

      const labelEl = FieldLabel(schema, key);
      row.appendChild(labelEl);

      if (schema.type === "array") {
        const arrayInput = ArrayInput(
          schema,
          values[key],
          schema.title || key.replaceAll("_", " "),
          (nextValue) => emitChange(key, nextValue),
        );
        changeHandlers.set(key, arrayInput);
        row.appendChild(arrayInput);
      } else {
        const scalarInput = ScalarInput(
          schema,
          values[key],
          schema.title || key.replaceAll("_", " "),
          (nextValue) => emitChange(key, nextValue),
        );
        changeHandlers.set(key, scalarInput);
        row.appendChild(scalarInput);
      }

      fieldWrapper.appendChild(row);
      content.appendChild(fieldWrapper);
    }

    popover.appendChild(content);

    const resetRow = document.createElement("div");
    resetRow.className = "mt-3 pt-3 border-t border-white/[0.05] flex justify-end";

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.textContent = "Reset to defaults";
    resetBtn.className =
      "text-[10px] font-semibold text-white/45 hover:text-[#22d3ee] transition-colors";
    resetBtn.addEventListener("click", () => {
      const defaults = createModelParameterValues(model);
      for (const { key } of inputs) {
        values[key] = defaults[key];
      }
      closePopover();
      onPayloadChange?.(buildSupplementalInputPayload(model, values));
      onChange?.("__reset__", values);
    });
    resetBtn.addEventListener("mouseenter", () => {
      resetBtn.classList.remove("text-white/45");
      resetBtn.classList.add("text-[#22d3ee]");
    });
    resetBtn.addEventListener("mouseleave", () => {
      resetBtn.classList.add("text-white/45");
      resetBtn.classList.remove("text-[#22d3ee]");
    });

    resetRow.appendChild(resetBtn);
    popover.appendChild(resetRow);

    return popover;
  }

  function openPopover() {
    if (popover) return;
    buildPopover();
    wrapper.appendChild(popover);
    open = true;
    btn.className = joinClasses(
      CONTROL_LAYOUT_CLASS,
      "px-4",
      CONTROL_ACTIVE_CLASS,
    );
  }

  function closePopover() {
    if (popover) {
      popover.remove();
      popover = null;
    }
    open = false;
    btn.className = joinClasses(
      CONTROL_LAYOUT_CLASS,
      "px-4",
      CONTROL_IDLE_CLASS,
    );
  }

  function toggle() {
    if (open) closePopover();
    else openPopover();
  }

  btn.addEventListener("click", toggle);

  function handleOutsideClick(event) {
    if (
      open &&
      popover &&
      !popover.contains(event.target) &&
      !btn.contains(event.target)
    ) {
      closePopover();
    }
  }

  document.addEventListener("click", handleOutsideClick);

  wrapper.appendChild(btn);

  return {
    element: wrapper,
    getValues: () => ({ ...values }),
    setValues: (next) => {
      for (const { key } of inputs) {
        if (Object.hasOwn(next, key)) {
          values[key] = next[key];
        }
      }
      if (open) {
        closePopover();
        openPopover();
      }
    },
    destroy: () => {
      document.removeEventListener("click", handleOutsideClick);
      closePopover();
      wrapper.remove();
    },
  };
}
