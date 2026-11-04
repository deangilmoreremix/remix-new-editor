import React, { Suspense } from "react";

/** next/dynamic → React.lazy (everything is client-side in the SPA). */
export default function dynamic<P extends object>(
  loader: () => Promise<{ default: React.ComponentType<P> } | React.ComponentType<P>>,
  opts: { ssr?: boolean; loading?: () => React.ReactNode } = {},
) {
  const Lazy = React.lazy(async () => {
    const mod = await loader();
    return "default" in (mod as object) ? (mod as { default: React.ComponentType<P> }) : { default: mod as React.ComponentType<P> };
  });
  const Dynamic = (props: P) => (
    <Suspense fallback={opts.loading ? opts.loading() : null}>
      <Lazy {...(props as P & React.JSX.IntrinsicAttributes)} />
    </Suspense>
  );
  return Dynamic;
}
