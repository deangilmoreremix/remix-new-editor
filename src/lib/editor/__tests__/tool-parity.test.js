import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const editorPath = resolve(__dirname, '../../../components/TimelineEditorPage.jsx');
const opsPath = resolve(__dirname, '../timeline-operations.js');
const typesPath = resolve(__dirname, '../../../types/timeline.js');

describe('Tool selection — CineGen parity (regression)', () => {
  it('renderTools buttons set lowercase tool ids that match the trim/slip/slide code', () => {
    // Extract the TOOL_DEFS array from the source and confirm the IDs are
    // lowercase, exactly the strings the rest of the editor compares against.
    const src = readFileSync(editorPath, 'utf8');
    const toolsMatch = src.match(/const TOOL_DEFS = \[([\s\S]*?)\];/);
    expect(toolsMatch, 'TOOL_DEFS array must exist in TimelineEditorPage.jsx').toBeTruthy();

    const required = ['select', 'blade', 'ripple', 'roll', 'slip', 'slide', 'music', 'fillGap', 'extend', 'mask'];
    for (const id of required) {
      expect(toolsMatch[1]).toMatch(new RegExp(`id:\\s*['"]${id}['"]`));
    }
  });

  it('keyboard shortcut map uses V/B/R/N/Y/U/M/E/X (Fill Gap has no default shortcut)', () => {
    const src = readFileSync(editorPath, 'utf8');
    const expected = {
      v: 'select', b: 'blade', r: 'ripple', n: 'roll', y: 'slip',
      u: 'slide', m: 'music', e: 'extend', x: 'mask',
    };
    for (const [key, id] of Object.entries(expected)) {
      // The toolMap block: '<key>': '<id>',
      const re = new RegExp(`['"]${key}['"]\\s*:\\s*['"]${id}['"]`);
      expect(src, `keyboard shortcut '${key}' -> '${id}' missing`).toMatch(re);
    }
    // Fill Gap MUST NOT be in the toolMap.
    const toolMapMatch = src.match(/const toolMap = \{([\s\S]*?)\};/);
    expect(toolMapMatch).toBeTruthy();
    expect(toolMapMatch[1]).not.toMatch(/['"]fill[Gg]ap['"]\s*:/);
  });

  it('renderTools click handler now uses selectTool() (no longer sets PascalCase label)', () => {
    const src = readFileSync(editorPath, 'utf8');
    // The buggy form was: state.selectedTool = label; (where label is "Ripple" etc.)
    // The fix: button.addEventListener('click', () => selectTool(def.id));
    expect(src).toMatch(/button\.addEventListener\('click', \(\) => selectTool\(def\.id\)\)/);
    // Confirm none of the legacy PascalCase assignments remain in renderTools.
    const renderToolsBlock = src.match(/function renderTools\(\)\s*\{([\s\S]*?)\n    \}/);
    expect(renderToolsBlock).toBeTruthy();
    expect(renderToolsBlock[1]).not.toMatch(/state\.selectedTool = label;/);
  });

  it('TOOL_DEFS id "fillGap" has no hint (no default shortcut, per ground truth)', () => {
    const src = readFileSync(editorPath, 'utf8');
    const fgMatch = src.match(/\{ id: 'fillGap'[\s\S]*?\},/);
    expect(fgMatch).toBeTruthy();
    expect(fgMatch[0]).toMatch(/hint:\s*''/);
  });
});

describe('Timeline types — CineGen field parity', () => {
  it('Clip has flipH, flipV, speed (0.25–4), opacity, volume, keyframes, linkedClipIds', () => {
    const src = readFileSync(typesPath, 'utf8');
    for (const field of ['flipH', 'flipV', 'speed', 'opacity', 'volume', 'keyframes', 'linkedClipIds']) {
      expect(src, `Clip.${field} missing`).toMatch(new RegExp(`@property[^/]*${field}\\b`));
    }
    // Speed range comment must read 0.25–4.
    expect(src).toMatch(/speed\s*-\s*0\.25[–-]4/);
  });

  it('Clip does NOT have a hard "muted" field — it is documented as a deliberate extension', () => {
    const src = readFileSync(typesPath, 'utf8');
    // Find the Clip typedef by capturing from "@typedef {Object} Clip" to the
    // next "@typedef" or end of typedefs section.
    const clipStart = src.indexOf('@typedef {Object} Clip');
    const afterClip = src.indexOf('@typedef', clipStart + 1);
    const clipBlock = afterClip > -1 ? src.slice(clipStart, afterClip) : src.slice(clipStart);
    expect(clipBlock.length, 'Clip typedef block not found').toBeGreaterThan(0);
    // The "muted" field (if present) must be optional AND labeled as our own concept.
    const mutedLines = [...clipBlock.matchAll(/@property\s+\{[^}]+\}\s+\[?muted\]?[^\n]*\n/g)];
    if (mutedLines.length > 0) {
      for (const m of mutedLines) {
        expect(m[0]).toMatch(/\[muted\]/); // optional
        expect(m[0]).toMatch(/our own concept/);
      }
    }
  });

  it('Track has muted, solo, locked, visible, volume', () => {
    const src = readFileSync(typesPath, 'utf8');
    for (const field of ['muted', 'solo', 'locked', 'visible', 'volume']) {
      expect(src, `Track.${field} missing`).toMatch(new RegExp(`@property[^/]*${field}\\b`));
    }
  });

  it('Timeline has tracks, clips, duration, transitions, markers (7 fields total)', () => {
    const src = readFileSync(typesPath, 'utf8');
    for (const field of ['id', 'name', 'tracks', 'clips', 'duration', 'transitions', 'markers']) {
      expect(src, `Timeline.${field} missing`).toMatch(new RegExp(`@property[^/]*${field}\\b`));
    }
  });

  it('Keyframe property is "opacity" | "volume" only', () => {
    const src = readFileSync(typesPath, 'utf8');
    expect(src).toMatch(/'opacity'\s*\|\s*'volume'/);
  });

  it('Transition types: dissolve | fadeToBlack | fadeFromBlack', () => {
    const src = readFileSync(typesPath, 'utf8');
    expect(src).toMatch(/'dissolve'\s*\|\s*'fadeToBlack'\s*\|\s*'fadeFromBlack'/);
  });
});

describe('timeline-operations.js — function parity with CineGen ground truth', () => {
  const required = [
    'getLinkedIds', 'calculateTimelineDuration', 'snapToHalfSecond',
    'addClipToTrack', 'removeClip', 'moveClip', 'trimClip', 'splitClip',
    'splitAllTracks', 'duplicateClip', 'duplicateClips', 'addTrack', 'removeTrack',
    'updateTrack', 'clipsOnTrack', 'clipAtTime', 'createDefaultTimeline',
    'rippleTrim', 'rollTrim', 'slipClip', 'slideClip', 'trackSelectForward',
    'interpolateProperty', 'addKeyframe', 'removeKeyframe', 'moveKeyframe',
    'addTransition', 'removeTransition', 'updateTransition', 'linkClips',
    'unlinkClips', 'unlinkAllFromClip', 'syncClips', 'createSyncedTimeline',
    'updateClipProperties',
  ];
  for (const fn of required) {
    it(`exports ${fn}()`, () => {
      const src = readFileSync(opsPath, 'utf8');
      const re = new RegExp(`export function ${fn}\\b`);
      expect(src, `${fn} not exported from timeline-operations.js`).toMatch(re);
    });
  }
});

describe('createDefaultTimeline — exactly 4 tracks V1/V2/A1/A2', () => {
  it('produces 4 default tracks (V1, V2, A1, A2) with the documented flags', async () => {
    const { createDefaultTimeline } = await import('../timeline-operations.js');
    const tl = createDefaultTimeline('parity');
    expect(tl.tracks).toHaveLength(4);
    const names = tl.tracks.map((t) => t.name);
    expect(names).toEqual(['V1', 'V2', 'A1', 'A2']);
    for (const t of tl.tracks) {
      expect(t.muted).toBe(false);
      expect(t.solo).toBe(false);
      expect(t.locked).toBe(false);
      expect(t.visible).toBe(true);
      expect(t.volume).toBe(1);
    }
  });
});
