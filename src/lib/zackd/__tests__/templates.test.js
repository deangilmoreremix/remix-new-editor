import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { TEMPLATES, getTemplate, templateToProject } from '../templates.js';
import { allShots, totalDuration } from '../../../../netlify/functions/_shared/zackdPrompts.js';

const publicFile = (p) => resolve(process.cwd(), 'public', p.replace(/^\//, ''));

describe('zackd templates', () => {
  it('offers one finished demo and two script-only templates', () => {
    expect(TEMPLATES.map((t) => [t.id, t.kind])).toEqual([['swallow-gum-demo', 'finished'], ['swallow-gum-script', 'script'], ['mosquito-bite-script', 'script']]);
  });

  it('every template normalizes into a valid 3-beat, 5-shot project with described character sheets', () => {
    for (const t of TEMPLATES) {
      const p = templateToProject(t);
      expect(p.map.beats).toHaveLength(3);
      expect(allShots(p.map)).toHaveLength(5);
      expect(p.map.beats[0].hook).toBe(true);
      expect(totalDuration(p.map)).toBe(15);
      expect(p.map.character_sheets).toHaveLength(2);
      expect(p.map.character_sheets.every((s) => s.description.length > 20)).toBe(true);
      expect(p.stage).toBe('script');
      expect(p.narration).toBeNull();
    }
  });

  it('the finished demo carries a keyframe and a clip for every shot, with absolute URLs when given an origin', () => {
    const p = templateToProject(getTemplate('swallow-gum-demo'), 'https://app.example.com');
    const ids = allShots(p.map).map((s) => s.shot_id);
    expect(Object.keys(p.shots).sort()).toEqual([...ids].sort());
    for (const id of ids) {
      expect(p.shots[id].clip).toBe(`https://app.example.com/zackd/templates/swallow-gum/clips/${id}.mp4`);
      expect(p.shots[id].keyframe).toBe(`https://app.example.com/zackd/templates/swallow-gum/keyframes/${id}.png`);
    }
  });

  it('script-only templates bring no media (nothing to pay for until the user generates)', () => {
    expect(templateToProject(getTemplate('mosquito-bite-script')).shots).toEqual({});
    expect(getTemplate('nope')).toBeNull();
  });

  it('every referenced media file is committed to git, not just present on disk (.gitignore excludes *.jpg)', async () => {
    let tracked;
    try { tracked = new Set(execFileSync('git', ['ls-files', 'public/zackd'], { encoding: 'utf8' }).split('\n').filter(Boolean)); } catch { return; } // no git checkout: skip
    const t = getTemplate('swallow-gum-demo');
    const { getHeroThumbnail } = await import('../../thumbnails.js');
    const files = [t.poster, t.demo, getHeroThumbnail('zackd'), ...Object.values(t.assets).flatMap((a) => [a.keyframe, a.clip])];
    for (const f of files) expect(tracked.has(`public${f}`), `${f} is not tracked by git`).toBe(true);
  });

  it('every referenced media file exists in public/', () => {
    const t = getTemplate('swallow-gum-demo');
    const files = [t.poster, t.demo, ...Object.values(t.assets).flatMap((a) => [a.keyframe, a.clip])];
    expect(files).toHaveLength(12);
    for (const f of files) expect(existsSync(publicFile(f)), f).toBe(true);
  });
});
