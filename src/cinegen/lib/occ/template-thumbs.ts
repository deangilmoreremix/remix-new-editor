// [remix] Where the real still thumbnails of the editor's animation libraries live (made by scripts/generate-template-generator-thumbs.mjs
// with the editor's own renderer). One naming rule shared by the Animations modal, the Template Generator and the generator script.
export const thumbSlug = (id: string): string => id.replace(/[^A-Za-z0-9_-]+/g, '-');
/** HyperFrames + RemotionUI items ("bar-chart-race", "rui:name"): the path the Animations modal has always used. */
export const hfThumb = (id: string): string => `/hyperframes/thumbs/${thumbSlug(id)}.jpg`;
/** Motion-graphics templates (OpenChatCut pack). */
export const mgThumb = (id: string): string => `/occ-templates/thumbs/${thumbSlug(id)}.jpg`;
/** End screens / lead forms. */
export const tplThumb = (id: string): string => `/overlay-templates/thumbs/${thumbSlug(id)}.jpg`;
