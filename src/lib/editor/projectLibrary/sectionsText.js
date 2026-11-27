// Typed sections ("0:45 Pricing", one per line) -> back-to-back sections. Used where a video has no scenes to read them from
// (a video made elsewhere, a one-clip page): the Retarget view and the "add a video from elsewhere" form.
export const MAX_SECTIONS = 12; // the Retarget mapping holds at most this many

/** "1:05", "01:02:03" or "75" -> seconds, or null. */
export function parseTimestamp(raw) {
  const parts = String(raw).trim().split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d{1,3}(\.\d+)?$/.test(p))) return null;
  return parts.reduce((total, p) => total * 60 + Number(p), 0);
}

/** One section per line, "m:ss Title". Each runs until the next one starts (the last until the end). */
export function parseSections(text, duration) {
  const rows = String(text).split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = /^(\S+)\s*[-–—:]?\s*(.*)$/.exec(line);
    return { start: m ? parseTimestamp(m[1]) : null, title: (m?.[2] || '').trim(), line };
  });
  const bad = rows.find((r) => r.start == null);
  if (bad) return { sections: [], error: `"${bad.line}" does not start with a time like 1:05` };
  if (rows.length > MAX_SECTIONS) return { sections: [], error: `Use at most ${MAX_SECTIONS} sections` };
  const sorted = [...rows].sort((a, b) => a.start - b.start);
  if (sorted.some((r, i) => i > 0 && r.start === sorted[i - 1].start)) return { sections: [], error: 'Two sections start at the same time' };
  if (sorted.some((r) => r.start >= duration)) return { sections: [], error: `A section starts after the video ends (${Math.floor(duration)}s)` };
  if (sorted.length && sorted[0].start > 0) sorted.unshift({ start: 0, title: 'Intro' });
  return { sections: sorted.map((r, i) => ({ title: r.title.slice(0, 60) || `Section ${i + 1}`, start: r.start, end: i + 1 < sorted.length ? sorted[i + 1].start : duration })) };
}
