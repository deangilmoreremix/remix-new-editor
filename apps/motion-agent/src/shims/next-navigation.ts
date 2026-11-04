import { useMemo } from "react";
import { navigate, useLocation } from "./router";

export const useRouter = () =>
  useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, true),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => undefined,
      prefetch: () => undefined,
    }),
    [],
  );

export const useSearchParams = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

export const usePathname = () => useLocation().pathname;
