export function getPath(obj: unknown, path: string): unknown;
export function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown>;
export interface AddonEditorOptions {
  fields?: unknown[];
  options: Record<string, unknown>;
  idPrefix?: string;
  onChange?: (next: Record<string, unknown>, info?: { structural?: boolean }) => void;
  fieldsFor?: (options: Record<string, unknown>) => unknown[];
  onFieldChange?: unknown;
  services?: Record<string, unknown>;
}
export function renderAddonEditor(
  container: HTMLElement,
  opts: AddonEditorOptions,
): { destroy(): void; setOptions(next: Record<string, unknown>): void };
