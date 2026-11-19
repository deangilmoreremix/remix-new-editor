// [remix] Excel (.xlsx) export of the Leads table. The writer (write-excel-file, MIT) is loaded only when someone clicks
// "Download Excel", so it never weighs on the main bundle.
import type { ExportRecord } from './leads';

type Cell = string | number | null | { value: string; fontWeight: 'bold' };
type Writer = (data: Cell[][], options?: { columns?: Array<{ width: number }> }) => { toFile: (name: string) => Promise<void> };

/** Header row (bold) then one row per record, columns in the order they first appear; a missing value is an empty cell. */
export function sheetFromRecords(records: ExportRecord[]): { data: Cell[][]; columns: Array<{ width: number }> } {
  const headers = [...new Set(records.flatMap((r) => Object.keys(r)))];
  const data: Cell[][] = [headers.map((h) => ({ value: h, fontWeight: 'bold' as const })), ...records.map((r) => headers.map((h) => r[h] ?? null))];
  const widest = (h: string) => Math.max(h.length, ...records.map((r) => String(r[h] ?? '').length));
  return { data, columns: headers.map((h) => ({ width: Math.min(40, Math.max(10, widest(h) + 2)) })) };
}

/** Save `records` as an .xlsx file. `load` is injectable for tests; by default the library is imported on demand. */
export async function downloadLeadsXlsx(
  records: ExportRecord[],
  fileName = 'leads.xlsx',
  load: () => Promise<{ default: Writer }> = () => import('write-excel-file/browser') as unknown as Promise<{ default: Writer }>,
): Promise<void> {
  const { data, columns } = sheetFromRecords(records);
  const { default: writeExcelFile } = await load();
  await writeExcelFile(data, { columns }).toFile(fileName);
}
