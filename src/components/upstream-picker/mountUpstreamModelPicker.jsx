// Mounts upstream Open-Generative-AI's own model picker (ModelDropdown inside
// PromptPopover, copied verbatim into this folder) from the vanilla-JS
// studios. Upstream renders the popover inside the button's wrapper; here it
// lives in a fixed host so it can open up or down depending on the room
// around the trigger, and so it is never clipped by the studio layout.
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { PromptPopover, PromptPopoverHeader } from "./PromptPopover.jsx";
import ImageModelDropdown from "./ImageModelDropdown.jsx";
import VideoModelDropdown from "./VideoModelDropdown.jsx";
import { imageCopy, videoCopy } from "./copy.js";

// Upstream's popover sizing for the model picker (ImageStudio.jsx /
// VideoStudio.jsx, "Model button").
const MODEL_POPOVER_CLASS =
  "w-[calc(100vw-2rem)] md:w-[480px] max-w-md md:max-w-none max-h-[70vh]";
const GAP = 8;
const MARGIN = 16;
// Open upward whenever at least this much room is above the trigger.
const MIN_ROOM_ABOVE = 240;

function topLimit() {
  const header = document.querySelector("header");
  const headerBottom = header ? header.getBoundingClientRect().bottom : 0;
  return Math.max(MARGIN, headerBottom > 0 ? headerBottom + GAP : 0);
}

/**
 * @param {Object} options
 * @param {'image'|'video'} options.kind
 * @param {HTMLElement} options.anchor - The model button.
 * @param {string} options.selectedModelId - Current model variant id.
 * @param {(entry: object, category: string) => void} options.onSelect
 *   Upstream's onSelect(pickerEntry, categoryId).
 * @param {() => void} [options.onClose]
 */
export function mountUpstreamModelPicker({ kind, anchor, selectedModelId, onSelect, onClose }) {
  const isVideo = kind === "video";
  const copy = isVideo ? videoCopy : imageCopy;
  const Dropdown = isVideo ? VideoModelDropdown : ImageModelDropdown;

  const host = document.createElement("div");
  host.className = "upstream-model-picker fixed z-[300]";
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-label", "Select model");

  let root = null;
  let isOpen = false;
  let connectionTimer = null;
  let currentId = selectedModelId;

  function render() {
    if (!root) return;
    flushSync(() => {
      root.render(
        <PromptPopover
          positionClassName=""
          onClick={(e) => e.stopPropagation()}
          className={MODEL_POPOVER_CLASS}
        >
          <PromptPopoverHeader>
            {isVideo ? copy.dropdowns.model : copy.popovers.model}
          </PromptPopoverHeader>
          <Dropdown
            key={currentId || "none"}
            selectedModel={currentId}
            onSelect={(entry, category) => onSelect?.(entry, category)}
            onClose={close}
            copy={copy}
          />
        </PromptPopover>,
      );
    });
  }

  function place() {
    if (!isOpen) return;
    if (!anchor || !anchor.isConnected) {
      // The trigger left the page (route change): close instead of floating.
      close();
      return;
    }
    const popover = host.firstElementChild;
    if (!popover) return;
    const body = popover.querySelector(".min-h-\\[350px\\]");
    const header = popover.firstElementChild;

    popover.style.maxHeight = "";
    if (body) {
      body.style.maxHeight = "";
      body.style.minHeight = "";
    }

    const rect = anchor.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const naturalHeight = popover.scrollHeight;
    const spaceAbove = rect.top - GAP - topLimit();
    const spaceBelow = viewportHeight - rect.bottom - GAP - MARGIN;
    const openAbove =
      spaceAbove >= naturalHeight || spaceAbove >= MIN_ROOM_ABOVE || spaceAbove >= spaceBelow;
    const available = Math.max(
      160,
      Math.min(viewportHeight * 0.7, openAbove ? spaceAbove : spaceBelow),
    );

    popover.style.maxHeight = `${available}px`;
    if (body) {
      // Popover padding (p-3.5) plus the "Model" header.
      const chrome = 28 + (header && header !== body ? header.offsetHeight + 8 : 0);
      const bodyMax = Math.max(120, available - chrome);
      body.style.maxHeight = `${bodyMax}px`;
      body.style.minHeight = `${Math.min(350, bodyMax)}px`;
    }

    if (openAbove) {
      host.style.top = "auto";
      host.style.bottom = `${viewportHeight - rect.top + GAP}px`;
    } else {
      host.style.bottom = "auto";
      host.style.top = `${rect.bottom + GAP}px`;
    }
    const width = popover.getBoundingClientRect().width;
    const left = Math.max(MARGIN, Math.min(rect.left, viewportWidth - width - MARGIN));
    host.style.left = `${left}px`;
    host.dataset.flipped = openAbove ? "1" : "0";
  }

  function onDocumentClick(e) {
    const path = typeof e.composedPath === "function" ? e.composedPath() : [];
    if (path.includes(host) || path.includes(anchor)) return;
    close();
  }

  function onKeydown(e) {
    if (e.key === "Escape") close();
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    document.body.appendChild(host);
    root = createRoot(host);
    render();
    place();
    // Upstream scrolls the selected row into view on mount; the height cap
    // above is applied afterwards, so do it once more now.
    host
      .querySelector("svg polyline")
      ?.closest(".cursor-pointer")
      ?.scrollIntoView({ block: "nearest" });
    // Register after the opening click has finished bubbling.
    setTimeout(() => {
      if (isOpen) document.addEventListener("click", onDocumentClick);
    }, 0);
    document.addEventListener("keydown", onKeydown);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, { capture: true, passive: true });
    // The router swaps pages with pushState (no event), so watch for the
    // trigger leaving the document and close with it.
    connectionTimer = setInterval(() => {
      if (!anchor || !anchor.isConnected) close();
    }, 500);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeydown);
    window.removeEventListener("resize", place);
    window.removeEventListener("scroll", place, { capture: true });
    clearInterval(connectionTimer);
    connectionTimer = null;
    const r = root;
    root = null;
    // Unmount outside the click handler that triggered the close.
    setTimeout(() => {
      r?.unmount();
      host.remove();
    }, 0);
    onClose?.();
  }

  function refresh(nextSelectedId) {
    currentId = nextSelectedId;
    render();
    place();
  }

  return { open, close, refresh, panel: host };
}
