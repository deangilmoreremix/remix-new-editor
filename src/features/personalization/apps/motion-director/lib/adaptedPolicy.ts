/**
 * remix-new-editor: running AI-adapted recipes is OFF unless a deployment opts in.
 *
 * "Adapted" recipes are source code the model rewrites from the captured site
 * and that the browser then executes with `new Function` (lib/shotAdapter.ts).
 * The static check and the shadowed globals there are not a security boundary:
 * adapted code can rebuild the string "constructor" at runtime and reach the
 * real `window` (and with it localStorage, where the user's API keys live, and
 * authenticated same-origin requests). Site content reaches the model, so a
 * hostile page could steer it into producing such code, and the result runs
 * automatically. Until adapted code runs in a real sandbox (a separate-origin
 * iframe or similar), it stays disabled: every shot plays its plain recipe,
 * exactly what already happens whenever adaptation fails.
 *
 * Set VITE_MOTION_ALLOW_ADAPTED_CODE=true only for a trusted environment.
 */
export const adaptedCodeEnabled = (): boolean => import.meta.env?.VITE_MOTION_ALLOW_ADAPTED_CODE === 'true';
