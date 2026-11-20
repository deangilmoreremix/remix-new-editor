// useUpgradeDialog() stays so existing callers compile, but this app has no plans to choose from:
// opening it does nothing and no dialog is mounted.

import React from "react";
import { UpgradeDialogContext } from "./context/upgrade";

export default function UpgradeDialogProvider({ children }: { children: React.ReactNode }) {
    const value = React.useMemo(() => ({ open: () => {}, close: () => {} }), []);
    return <UpgradeDialogContext.Provider value={value}>{children}</UpgradeDialogContext.Provider>;
}
