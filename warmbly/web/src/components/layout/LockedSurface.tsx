import type { ReactNode } from "react";

// No feature here is locked behind a plan, so this only renders what it wraps.
// The props are kept so existing callers still compile.
export function LockedSurface({ children }: { children: ReactNode } & Record<string, unknown>) {
    return <>{children}</>;
}
