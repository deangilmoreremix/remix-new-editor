import { cancelRender, continueRender, delayRender } from "remotion";
import { staticFile } from "../../studio-shim";

// Recorder Studio: fonts are self-hosted (public/recorder-studio/fonts, SIL OFL 1.1) instead of
// fetched from Google at runtime, so previews and exports also work offline / behind a firewall.
const regularFont = "Inter";
const monospaceFont = "Roboto Mono";
const endcardFont = "Inter";

const loadFace = (family: string, weight: string, file: string) => {
  const face = new FontFace(family, `url(${staticFile(`fonts/${file}`)}) format("woff2")`, {
    weight,
    style: "normal",
  });
  document.fonts.add(face);
  return face.load();
};

const regular = Promise.all([
  loadFace(regularFont, "600", "inter-latin-600-normal.woff2"),
  loadFace(regularFont, "700", "inter-latin-700-normal.woff2"),
]);
const monospace = loadFace(monospaceFont, "500", "roboto-mono-latin-500-normal.woff2");
const endcard = loadFace(endcardFont, "500", "inter-latin-500-normal.woff2");

export const waitForFonts = async () => {
  await regular;
  await monospace;
  await endcard;
};

export const REGULAR_FONT: React.CSSProperties = {
  fontFamily: regularFont,
  fontWeight: 600,
};

export const MONOSPACE_FONT: React.CSSProperties = {
  fontFamily: monospaceFont,
  fontWeight: 500,
  fontFeatureSettings: '"ss03" on',
};

export const TITLE_FONT: React.CSSProperties = {
  fontFamily: regularFont,
  fontWeight: 700,
};

export const ENDCARD_FONT: React.CSSProperties = {
  fontFamily: endcardFont,
  fontWeight: 500,
};

const delay = delayRender("Loading fonts");

waitForFonts()
  .then(() => continueRender(delay))
  .catch((err) => cancelRender(err));
