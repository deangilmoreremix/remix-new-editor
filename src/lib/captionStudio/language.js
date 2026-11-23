// Core file (no imports).
/**
 * Caption Studio — which language the captions are in when the user chose "Detect".
 * The Whisper engines in use return words only, not the language they picked, so this reads it from the text: a writing system
 * (Japanese, Korean, Arabic, Hindi, Cyrillic …) or, for Latin script, the commonest small words of each language. It is a guess from
 * the words, and the UI says "from the text".
 */
const SCRIPTS = [
  ['ja', /[぀-ヿ]/], ['ko', /[가-힯]/], ['zh', /[一-鿿]/], ['ar', /[؀-ۿ]/], ['hi', /[ऀ-ॿ]/],
  ['ru', /[Ѐ-ӿ]/], ['el', /[Ͱ-Ͽ]/], ['he', /[֐-׿]/], ['th', /[฀-๿]/],
];
const STOP = {
  en: 'the and to of is in that it you for with on are this have be not but we your',
  es: 'el la de que y en los se del las por un para con no una su al es lo como más pero',
  fr: 'le la les de des et en un une est que pour dans qui pas sur au avec vous nous ce',
  de: 'der die das und ist nicht ein eine zu den mit sich auf für von dem sie wir ich',
  pt: 'o a de que e do da em um para com não uma os no se na por mais as dos como mas',
  it: 'il la di che e un una per con non sono del le della in è si da come più ma',
  nl: 'de het een en van is dat op te in voor met niet zijn aan er maar om ook als',
};
const SETS = Object.fromEntries(Object.entries(STOP).map(([k, v]) => [k, new Set(v.split(' '))]));

/** Language code (`'en'`, `'es'`, `'ja'` …) or `''` when there is too little text to tell. */
export function guessLanguage(text) {
  const t = String(text || '');
  if (t.replace(/\s/g, '').length < 12) return '';
  for (const [code, re] of SCRIPTS) {
    const hits = (t.match(new RegExp(re.source, 'g')) || []).length;
    if (hits >= 3 && hits / t.replace(/\s/g, '').length > 0.3) return code;
  }
  const words = t.toLowerCase().match(/\p{L}+/gu) || [];
  if (words.length < 4) return '';
  let best = ''; let top = 0; let second = 0;
  for (const [code, set] of Object.entries(SETS)) {
    const n = words.reduce((c, w) => c + (set.has(w) ? 1 : 0), 0);
    if (n > top) { second = top; top = n; best = code; } else if (n > second) second = n;
  }
  return top >= 2 && top > second ? best : '';
}

/** What to show for a job: the chosen language, or the guess when "Detect" was chosen (`auto · en`). */
export function languageLabel(chosen, text) {
  if (chosen && chosen !== 'auto') return chosen;
  const g = guessLanguage(text);
  return g ? `auto · ${g}` : 'auto';
}
