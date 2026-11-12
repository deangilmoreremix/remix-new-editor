// Inter, loaded through @remotion/google-fonts.
//
// loadFont() returns a { fontFamily } handle and registers a promise that
// Remotion waits on before capturing frames, so text never renders in a
// fallback face mid-render. Importing this module once and reusing INTER keeps
// every template on the same typeface.
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const INTER = fontFamily;
