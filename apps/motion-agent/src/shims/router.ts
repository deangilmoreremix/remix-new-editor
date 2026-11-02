import { useSyncExternalStore } from "react";

/** Hash router for the embedded SPA: "#/generate?prompt=…" ↔ path + query. The iframe's
 *  own hash, so it never touches SmartVid's router. */
const read = () => {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathname, query = ""] = raw.split("?");
  return { pathname: pathname || "/", search: query };
};
let snapshot = read();
const listeners = new Set<() => void>();
const emit = () => {
  snapshot = read();
  listeners.forEach((l) => l());
};
window.addEventListener("hashchange", emit);

export const navigate = (href: string, replace = false) => {
  const target = `#${href.startsWith("/") ? href : `/${href}`}`;
  if (replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);
  emit();
};

export const useLocation = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
  );
