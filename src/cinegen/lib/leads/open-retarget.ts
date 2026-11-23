// [remix] Opens the Analytics tab's Retarget view from anywhere (the header's Retarget button). The Analytics tab may not be
// mounted yet, so the request is left in sessionStorage for it to read on mount; when it is already open it hears the event.
export const OPEN_RETARGET_EVENT = 'remix:open-retarget';
export const OPEN_VIEW_FLAG = 'remix_open_projects'; // the same key the header bell uses; its value says which view to open

export function requestRetarget(): void {
  try { sessionStorage.setItem(OPEN_VIEW_FLAG, 'retarget'); } catch { /* storage unavailable: the event below still reaches a mounted tab */ }
  window.dispatchEvent(new Event(OPEN_RETARGET_EVENT));
}
