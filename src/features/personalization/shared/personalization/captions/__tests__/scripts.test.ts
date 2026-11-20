import { describe, it, expect } from 'vitest';
import { SCRIPTS, LANGUAGES, detectScript, displayScale, isRtl, languageName, layoutFor, inferLanguage, representativeLanguage, scriptFor, scriptOf, withScriptFonts } from '../scripts';

describe('scripts', () => {
  it('knows the script of a language code, with region suffixes', () => {
    expect(scriptOf('en')?.id).toBe('latin');
    expect(scriptOf('pt-BR')?.id).toBe('latin');
    expect(scriptOf('ru')?.id).toBe('cyrillic');
    expect(scriptOf('ja')?.id).toBe('cjk');
    expect(scriptOf('ar')?.id).toBe('arabic');
    expect(scriptOf('hi')?.id).toBe('devanagari');
    expect(scriptOf('th')?.id).toBe('thai');
    expect(scriptOf('he')?.id).toBe('hebrew');
    expect(scriptOf('xx')).toBeUndefined();
    expect(scriptOf(undefined)).toBeUndefined();
  });
  it('marks right-to-left languages', () => {
    for (const l of ['ar', 'he', 'fa', 'ur', 'yi']) expect(isRtl(l), l).toBe(true);
    for (const l of ['en', 'ja', 'hi', undefined]) expect(isRtl(l as string | undefined), String(l)).toBe(false);
  });
  it('detects the script of text with no language known', () => {
    expect(detectScript('Hello there')).toBe('latin');
    expect(detectScript('Привет мир')).toBe('cyrillic');
    expect(detectScript('こんにちは世界')).toBe('cjk');
    expect(detectScript('你好，世界')).toBe('cjk');
    expect(detectScript('안녕하세요')).toBe('cjk');
    expect(detectScript('مرحبا بالعالم')).toBe('arabic');
    expect(detectScript('שלום עולם')).toBe('hebrew');
    expect(detectScript('नमस्ते दुनिया')).toBe('devanagari');
    expect(detectScript('สวัสดีชาวโลก')).toBe('thai');
    expect(detectScript('1234 !!')).toBe('latin'); // nothing script-specific: the default
    expect(detectScript('')).toBe('latin');
  });
  it('gives wider scripts fewer characters per line and a smaller size', () => {
    const latin = layoutFor('en', 105), cjk = layoutFor('ja', 105), arabic = layoutFor('ar', 105);
    expect(latin.fontScale).toBe(1);
    expect(cjk.fontScale).toBeLessThan(1);
    expect(arabic.fontScale).toBeLessThan(1);
    expect(latin.maxChars).toBeGreaterThan(5);
    expect(layoutFor('en', 400).maxChars).toBeGreaterThanOrEqual(5); // never below the floor
  });
  it('lists the Whisper languages with names, unique codes, English first after auto', () => {
    expect(LANGUAGES.length).toBeGreaterThanOrEqual(90);
    expect(new Set(LANGUAGES.map(([c]) => c)).size).toBe(LANGUAGES.length);
    expect(LANGUAGES.find(([c]) => c === 'en')?.[1]).toBe('English');
    expect(languageName('es')).toBe('Spanish');
    expect(languageName('pt-BR')).toBe('Portuguese');
    expect(languageName('zz')).toBe('zz');
    expect(languageName(undefined)).toBe('');
  });
  it('sets wide scripts smaller on screen so a line holds about as many letters as Latin, never below 60 %', () => {
    expect(displayScale('en', 'hello')).toBe(1);
    expect(displayScale(undefined, 'hello')).toBe(1);
    expect(displayScale('ja', '')).toBeLessThan(1);
    expect(displayScale('ja', '')).toBeGreaterThanOrEqual(0.6);
    expect(displayScale('ru', '')).toBeLessThan(1);
    expect(displayScale(undefined, '今日は')).toBe(displayScale('ja', '')); // from the text when no language is known
    for (const l of ['ar', 'he', 'hi', 'th', 'ko', 'zh']) expect(displayScale(l, ''), l).toBeGreaterThanOrEqual(0.6);
  });
  it('picks the script from the language first and the text second', () => {
    expect(scriptFor('ar', 'hello').id).toBe('arabic');
    expect(scriptFor(undefined, 'שלום').id).toBe('hebrew');
    expect(scriptFor('xx', 'Привет').id).toBe('cyrillic'); // an unknown code falls back to the text
    expect(scriptFor(undefined).id).toBe('latin');
  });
  it('gives a representative language for a script, for files that need a language but have none', () => {
    expect(representativeLanguage('cjk')).toBe('zh');
    expect(representativeLanguage('arabic')).toBe('ar');
    expect(representativeLanguage('latin')).toBe('en');
    expect(scriptOf(representativeLanguage('thai'))?.id).toBe('thai');
  });
  it('keeps generic families out of the script font stacks, so the layer can put them AFTER the script\'s own fonts', () => {
    for (const s of SCRIPTS) expect(s.fallbackStack, s.id).not.toMatch(/(^|,\s*)(ui-sans-serif|system-ui|sans-serif|serif|monospace)\s*(,|$)/);
    for (const s of SCRIPTS.filter((x) => x.id !== 'latin')) expect(s.fallbackStack.length, s.id).toBeGreaterThan(0);
  });

  it('sets supported languages that are not in the script table (Bengali, Greek, Tamil) and their text at the wide-script size too', () => {
    for (const l of ['bn', 'el', 'ta', 'te', 'ka', 'hy']) expect(displayScale(l, ''), l).toBeLessThan(1);
    expect(displayScale(undefined, String.fromCodePoint(0x09ac, 0x09be, 0x0982, 0x09b2, 0x09be))).toBeLessThan(1); // Bengali letters, no language
    expect(displayScale(undefined, String.fromCodePoint(0x0395, 0x03bb, 0x03bb, 0x03b7, 0x03bd, 0x03b9, 0x03ba, 0x03ac))).toBeLessThan(1); // Greek
    expect(displayScale('xx', 'hello')).toBe(1); // an unknown code: judged by the text, which is Latin
    expect(displayScale('en', 'hello')).toBe(1);
    expect(displayScale(undefined, 'Cafe\u0301 olé')).toBe(1); // accented Latin is still Latin
  });


  it('adds a script\'s fonts after the named fonts and before the generic ones; Latin and generic-free stacks behave', () => {
    const ar = scriptFor('ar');
    const out = withScriptFonts('"Personalization Sans", Inter, ui-sans-serif, system-ui, sans-serif', ar);
    expect(out.indexOf('Inter')).toBeLessThan(out.indexOf(ar.fallbackStack));
    expect(out.indexOf(ar.fallbackStack)).toBeLessThan(out.indexOf('ui-sans-serif'));
    expect(withScriptFonts('Inter', ar)).toBe(`Inter, ${ar.fallbackStack}`);
    expect(withScriptFonts('Inter, sans-serif', scriptFor('en'))).toBe('Inter, sans-serif');
  });
  it('infers a language for a text: the first language of its script, and a stand-in for scripts the table does not list (so they are not taken for English)', () => {
    expect(inferLanguage('Call us today')).toBe('en');
    expect(inferLanguage('مرحبا')).toBe('ar');
    const greek = inferLanguage('Καλημέρα');
    expect(greek).not.toBe('en');
    expect(scriptOf(greek)).toBeUndefined();
    expect(displayScale(greek)).toBeLessThan(1);
    expect(displayScale(inferLanguage('বাংলা'))).toBeLessThan(1);
  });
});
