// Licensing / attribution compliance audit for the Minimax H3 style presets.
//
// Read-only: this script never writes, patches or generates anything. It is the
// Workstream E (QA) gate for roadmap §4 ("licensing — derive style, watermark
// credit") and §5.4-E ("export of a non-redistributable clip carries credit").
//
// Run:
//   node scripts/check-minimax-licensing.js
//   node scripts/check-minimax-licensing.js --strict   # warnings become failures
//   node scripts/check-minimax-licensing.js --json     # machine-readable report
//
// Hard checks (always fail the run):
//   1. public/media/minimax-h3/presets.json parses to a non-empty array.
//   2. Every preset has a non-empty `author`.
//   3. Every preset has a non-empty `rightsNote`.
//   4. Every preset's `rightsNote` names its `author` (credit text is usable).
//   5. Every preset's `sourceClipUrl` points inside /media/minimax-h3/videos/.
//   6. The "Create This Style" entry point (src/lib/minimax/createThisStyle.js)
//      exists and handles rights (`derivativeOnly` / `rightsNote` / `watermark`).
//
// Advisory checks (warn by default, fail under --strict) — these answer the
// question "will an exported derivative actually carry author credit?":
//   A. createThisStyle forwards the author/credit fields to the studio.
//   B. some module in the export/render path reads derivativeOnly/rightsNote/
//      author so the rendered file can be stamped.
//   C. presets agree with ATTRIBUTION.json (author + source URL).
//   D. the referenced .webm exists locally.

import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const argv = process.argv.slice(2);
const STRICT = argv.includes("--strict");
const AS_JSON = argv.includes("--json");

const PRESETS_JSON = resolve(root, "public/media/minimax-h3/presets.json");
const ATTRIBUTION_JSON = resolve(root, "public/media/minimax-h3/ATTRIBUTION.json");
const PUBLIC_DIR = resolve(root, "public");
const CREATE_THIS_STYLE = resolve(root, "src/lib/minimax/createThisStyle.js");

const VIDEOS_URL_PREFIX = "/media/minimax-h3/videos/";

// Rights vocabulary the audit greps for.
const RIGHTS_TOKENS = ["derivativeOnly", "rightsNote", "watermark"];
const CREDIT_TOKENS = ["author", "credit", "attribution"];

// Modules that participate in "Create This Style" → studio → export.
// `required: true` means the file itself must exist.
const PATH_FILES = [
  { label: "create-this-style", file: "src/lib/minimax/createThisStyle.js", required: true, stage: "entry" },
  { label: "style-template-store", file: "src/stores/styleTemplateStore.js", stage: "state" },
  { label: "studio-prefill", file: "src/lib/studioPrefill.js", stage: "state" },
  { label: "backend-template-service", file: "backend/services/templateService.js", stage: "backend" },
  { label: "demo-card", file: "src/components/demos/DemoCard.jsx", stage: "ui" },
  { label: "demo-detail-modal", file: "src/components/demos/DemoDetailModal.jsx", stage: "ui" },
  { label: "export-pipeline", file: "src/lib/editor/exportPipeline.js", stage: "export" },
  { label: "export-to-video", file: "src/lib/editor/exportToVideo.js", stage: "export" },
  { label: "export-worker", file: "src/lib/editor/exportWorker.js", stage: "export" },
  { label: "render-export-worker", file: "src/lib/editor/renderExportWorker.js", stage: "export" },
  { label: "render-actions", file: "src/lib/editor/renderActions.js", stage: "export" },
  { label: "generation-service", file: "src/lib/editor/generationService.js", stage: "export" },
];

const errors = [];
const warnings = [];
const notes = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function readIfPresent(absPath) {
  try {
    if (!existsSync(absPath)) return null;
    return readFileSync(absPath, "utf8");
  } catch (e) {
    return null;
  }
}

function tokensIn(source, tokens) {
  if (!source) return [];
  return tokens.filter((t) => new RegExp(`\\b${t}\\b`, "i").test(source));
}

/* ------------------------------------------------------------------ presets */

let presets = [];
const raw = readIfPresent(PRESETS_JSON);
if (raw == null) {
  fail(`presets.json not found at ${PRESETS_JSON}`);
} else {
  try {
    presets = JSON.parse(raw);
  } catch (e) {
    fail(`presets.json is not valid JSON: ${e.message}`);
  }
}
if (!Array.isArray(presets)) {
  fail("presets.json did not parse to an array");
  presets = [];
} else if (presets.length === 0) {
  fail("presets.json is an empty array — nothing to audit");
}

/* ------------------------------------------------------- ATTRIBUTION.json */

let attributionBySlug = new Map();
let attributionMeta = null;
const attrRaw = readIfPresent(ATTRIBUTION_JSON);
if (attrRaw == null) {
  warn(`ATTRIBUTION.json not found at ${ATTRIBUTION_JSON} — cannot cross-check credit`);
} else {
  try {
    const parsed = JSON.parse(attrRaw);
    attributionMeta = {
      attribution: parsed.attribution || "",
      promptLicense: parsed.promptLicense || "",
      mediaRights: parsed.mediaRights || "",
    };
    const clips = Array.isArray(parsed.clips) ? parsed.clips : [];
    for (const c of clips) if (c && c.slug) attributionBySlug.set(c.slug, c);
    notes.push(`ATTRIBUTION.json: ${clips.length} clip credit rows, prompt license "${attributionMeta.promptLicense}"`);
  } catch (e) {
    warn(`ATTRIBUTION.json is not valid JSON: ${e.message}`);
  }
}

/* --------------------------------------------------------- per-preset audit */

const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";
let clipsOnDisk = 0;
let clipsMissing = 0;
let creditedInRightsNote = 0;
let sourceUrlInRightsNote = 0;

for (const p of presets) {
  const slug = nonEmpty(p && p.slug) ? p.slug : "<missing-slug>";

  // 2. author
  if (!nonEmpty(p.author)) {
    fail(`${slug}: 'author' is missing or empty — derivative cannot credit a source`);
  }

  // 3. rightsNote
  if (!nonEmpty(p.rightsNote)) {
    fail(`${slug}: 'rightsNote' is missing or empty`);
  }

  // 4. rightsNote must name the author so the credit string is usable verbatim
  if (nonEmpty(p.author) && nonEmpty(p.rightsNote)) {
    if (p.rightsNote.includes(p.author)) {
      creditedInRightsNote++;
    } else {
      fail(`${slug}: 'rightsNote' does not name the author (${p.author})`);
    }
  }

  // 5. sourceClipUrl must reference the local Minimax video folder
  if (!nonEmpty(p.sourceClipUrl)) {
    fail(`${slug}: 'sourceClipUrl' is missing or empty`);
  } else if (!p.sourceClipUrl.startsWith(VIDEOS_URL_PREFIX)) {
    fail(`${slug}: 'sourceClipUrl' must start with ${VIDEOS_URL_PREFIX} (got "${p.sourceClipUrl}")`);
  } else {
    // D. advisory — the referenced clip should exist locally
    const abs = join(PUBLIC_DIR, p.sourceClipUrl.replace(/^\//, ""));
    let ok = false;
    try {
      ok = existsSync(abs) && statSync(abs).isFile();
    } catch {
      ok = false;
    }
    if (ok) clipsOnDisk++;
    else {
      clipsMissing++;
      warn(`${slug}: sourceClipUrl "${p.sourceClipUrl}" has no file on disk`);
    }
  }

  // C. advisory — cross-check the credit against ATTRIBUTION.json
  if (attributionBySlug.size) {
    const credit = attributionBySlug.get(p.slug);
    if (!credit) {
      warn(`${slug}: no ATTRIBUTION.json row (credit is only asserted by the preset)`);
    } else {
      if (nonEmpty(credit.author) && credit.author !== p.author) {
        warn(`${slug}: author mismatch — preset "${p.author}" vs ATTRIBUTION "${credit.author}"`);
      }
      if (nonEmpty(credit.url)) {
        if (nonEmpty(p.rightsNote) && p.rightsNote.includes(credit.url)) sourceUrlInRightsNote++;
        else warn(`${slug}: rightsNote does not carry the source URL (${credit.url})`);
      }
    }
  }
}

/* ---------------------------------------------- code-path (export) analysis */

const pathReport = [];
for (const entry of PATH_FILES) {
  const abs = resolve(root, entry.file);
  const source = readIfPresent(abs);
  if (source == null) {
    if (entry.required) {
      fail(`${entry.file} not found — "Create This Style" entry point is missing`);
    } else {
      notes.push(`absent (not yet implemented): ${entry.file}`);
    }
    pathReport.push({ ...entry, present: false, rights: [], credit: [] });
    continue;
  }
  pathReport.push({
    ...entry,
    present: true,
    rights: tokensIn(source, RIGHTS_TOKENS),
    credit: tokensIn(source, CREDIT_TOKENS),
  });
}

const entryReport = pathReport.find((r) => r.label === "create-this-style");

// 6. hard — the entry point must handle rights in some form.
if (entryReport && entryReport.present && entryReport.rights.length === 0) {
  fail(
    "src/lib/minimax/createThisStyle.js has no rights handling " +
      `(expected one of: ${RIGHTS_TOKENS.join(", ")})`
  );
}

// A. advisory — does the entry point hand the credit fields to the studio?
let entryCarriesCredit = false;
if (entryReport && entryReport.present) {
  entryCarriesCredit = entryReport.credit.length > 0;
  if (!entryCarriesCredit) {
    warn(
      "createThisStyle.js flags the derivative (" +
        entryReport.rights.join(", ") +
        ") but never forwards `author`/`rightsNote` to the studio prefill — the studio " +
        "has no credit string to stamp on an export"
    );
  }
}

// B. advisory — does anything in the export/render path read the rights fields?
const exportStage = pathReport.filter((r) => r.stage === "export" && r.present);
const exportAware = exportStage.filter((r) => r.rights.length > 0 || r.credit.length > 0);
const exportCarriesCredit = exportAware.length > 0;
if (!exportCarriesCredit) {
  warn(
    "no module in the export/render path (" +
      exportStage.map((r) => r.file).join(", ") +
      ") references derivativeOnly/rightsNote/author/watermark — exported derivatives " +
      "will NOT carry author credit"
  );
}

const exportsCredited = entryCarriesCredit && exportCarriesCredit;

/* ------------------------------------------------------------------ report */

const summary = {
  presets: presets.length,
  presetsWithAuthor: presets.filter((p) => nonEmpty(p.author)).length,
  presetsWithRightsNote: presets.filter((p) => nonEmpty(p.rightsNote)).length,
  presetsWithLocalSourceClip: presets.filter(
    (p) => nonEmpty(p.sourceClipUrl) && p.sourceClipUrl.startsWith(VIDEOS_URL_PREFIX)
  ).length,
  rightsNoteNamesAuthor: creditedInRightsNote,
  rightsNoteCarriesSourceUrl: sourceUrlInRightsNote,
  clipsOnDisk,
  clipsMissing,
  entryRightsTokens: entryReport && entryReport.present ? entryReport.rights : [],
  entryForwardsCredit: entryCarriesCredit,
  exportPathCreditAware: exportCarriesCredit,
  exportedDerivativesCarryAuthorCredit: exportsCredited,
  strict: STRICT,
  errors,
  warnings,
};

if (AS_JSON) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log("\nMinimax H3 licensing / attribution audit");
  console.log("=".repeat(56));
  console.log(`presets.json                : ${PRESETS_JSON.replace(root + "/", "")}`);
  console.log(`presets audited             : ${summary.presets}`);
  console.log(`  with author               : ${summary.presetsWithAuthor}/${summary.presets}`);
  console.log(`  with rightsNote           : ${summary.presetsWithRightsNote}/${summary.presets}`);
  console.log(`  rightsNote names author   : ${summary.rightsNoteNamesAuthor}/${summary.presets}`);
  console.log(`  rightsNote has source URL : ${summary.rightsNoteCarriesSourceUrl}/${summary.presets}`);
  console.log(`  sourceClipUrl under videos: ${summary.presetsWithLocalSourceClip}/${summary.presets}`);
  console.log(`  clips present on disk     : ${summary.clipsOnDisk} (missing: ${summary.clipsMissing})`);
  if (attributionMeta) {
    console.log(`prompt license              : ${attributionMeta.promptLicense}`);
    console.log(`media rights                : ${attributionMeta.mediaRights}`);
  }

  console.log("\nCode path (rights / credit tokens found):");
  for (const r of pathReport) {
    const state = r.present
      ? `rights=[${r.rights.join(",") || "-"}] credit=[${r.credit.join(",") || "-"}]`
      : "absent";
    console.log(`  ${r.stage.padEnd(8)} ${r.file.padEnd(46)} ${state}`);
  }

  console.log("\nExported derivative credit:");
  console.log(`  entry flags derivative      : ${summary.entryRightsTokens.join(", ") || "NO"}`);
  console.log(`  entry forwards author credit: ${entryCarriesCredit ? "YES" : "NO"}`);
  console.log(`  export path reads credit    : ${exportCarriesCredit ? "YES" : "NO"}`);
  console.log(
    `  => exports carry author credit: ${exportsCredited ? "YES" : "NO — credit is dropped before render/export"}`
  );

  if (notes.length) {
    console.log("\nNotes:");
    notes.forEach((n) => console.log(`  - ${n}`));
  }
  if (warnings.length) {
    console.log(`\n${STRICT ? "WARNINGS (fatal under --strict)" : "WARNINGS (advisory)"}: ${warnings.length}`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
  }
  if (errors.length) {
    console.log(`\nERRORS: ${errors.length}`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }
}

const failed = errors.length > 0 || (STRICT && warnings.length > 0);
if (!AS_JSON) {
  console.log(
    failed
      ? `\nFAIL: ${errors.length} error(s)${STRICT ? `, ${warnings.length} warning(s)` : ""}.\n`
      : `\nPASS: preset licensing metadata is complete${warnings.length ? ` (${warnings.length} advisory warning(s))` : ""}.\n`
  );
}
process.exit(failed ? 1 : 0);
