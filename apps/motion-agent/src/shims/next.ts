import type React from "react";

/** Type-only stand-ins for `import type { NextPage, Metadata, Viewport } from "next"`. */
export type NextPage<P = object> = React.FC<P>;
export type Metadata = Record<string, unknown>;
export type Viewport = Record<string, unknown>;
