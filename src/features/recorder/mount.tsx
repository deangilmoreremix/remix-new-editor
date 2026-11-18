// Mount the browser Remotion Recorder studio into a DOM node (the app's studios are vanilla DOM).
import React from "react";
import { createRoot } from "react-dom/client";
import { RecorderStudio, type RecorderStudioProps } from "./studio/RecorderStudio";

export const mountRecorderStudio = (container: HTMLElement, props: RecorderStudioProps = {}) => {
  const root = createRoot(container);
  root.render(<RecorderStudio {...props} />);
  return () => root.unmount();
};

/** Full-screen Recorder over the current page; resolves when it closes. */
export const openRecorderStudio = (props: Omit<RecorderStudioProps, "onClose"> = {}) => {
  const overlay = document.createElement("div");
  overlay.setAttribute("data-recorder-overlay", "");
  overlay.style.cssText = "position:fixed;inset:0;z-index:9990;background:#050505;display:flex;flex-direction:column;";
  document.body.appendChild(overlay);
  let unmount = () => {};
  const close = () => {
    unmount();
    overlay.remove();
  };
  unmount = mountRecorderStudio(overlay, {
    ...props,
    onClose: close,
    onUseVideo: props.onUseVideo
      ? (v) => {
          props.onUseVideo?.(v);
          close();
        }
      : undefined,
  });
  return close;
};
