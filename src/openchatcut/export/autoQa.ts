// SPDX-License-Identifier: AGPL-3.0-or-later — OpenChatCut (apps/video-agent-studio/src/export/autoQa.ts), vendored.
// [remix] only their auto-QA preference helpers; their runExportQa posts to a server FFmpeg route (/api/export-qa) and is replaced by
// src/cinegen/lib/occ/export-qa.ts (browser analysis of the rendered blob feeding their assessExportQuality).

const STORAGE_KEY = 'cc.exportAutoQa.v1';
export const MAX_EXPORT_QA_ATTEMPTS = 3;

export interface ExportAutoQaPreference {
  enabled: boolean;
}

export const DEFAULT_EXPORT_AUTO_QA: ExportAutoQaPreference = { enabled: true };

export function loadExportAutoQaPreference(): ExportAutoQaPreference {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null') as Partial<ExportAutoQaPreference> | null;
    return { enabled: parsed?.enabled !== false };
  } catch {
    return { ...DEFAULT_EXPORT_AUTO_QA };
  }
}

export function saveExportAutoQaPreference(preference: ExportAutoQaPreference): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ enabled: preference.enabled }));
  } catch {
    // Export still works when storage is unavailable or full.
  }
}
