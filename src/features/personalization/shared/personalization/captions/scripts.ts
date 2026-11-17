/**
 * Languages and writing systems for captions: which script a language uses, how wide its letters are (so a line holds the right number of
 * characters), how much smaller it should be set than the Latin display fonts, whether it reads right to left, and which fonts to fall back
 * to. Pure data and functions (no React, no network, no repo imports), identical in remix-new-editor and OpenHiggsBolt.
 * The script table follows ai-video-captions (https://github.com/nicolaigaina/ai-video-captions, MIT): per-script width ratio and size scale.
 */
export type ScriptId = 'latin' | 'cyrillic' | 'cjk' | 'arabic' | 'devanagari' | 'thai' | 'hebrew'

export interface ScriptConfig {
  id: ScriptId
  /** ISO 639-1 codes (Whisper's own codes). */
  languages: readonly string[]
  /** Average letter width as a fraction of the font size. */
  charWidthRatio: number
  /** Size compared with the Latin display fonts (1 = same). */
  fontScale: number
  rtl: boolean
  /** Named font families for this script, tried after the look's own font and BEFORE the generic families (which the caller adds after). No generic family in it. Empty for Latin. */
  fallbackStack: string
}

export const SCRIPTS: readonly ScriptConfig[] = Object.freeze([
  {
    id: 'latin', charWidthRatio: 0.55, fontScale: 1, rtl: false, fallbackStack: '',
    languages: ['en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ro', 'sv', 'no', 'nn', 'da', 'fi', 'cs', 'sk', 'hu', 'hr', 'sl', 'et', 'lv', 'lt', 'id', 'ms', 'vi', 'tl', 'sw', 'tr', 'az', 'uz', 'ca', 'gl', 'eu', 'cy', 'af', 'is', 'sq', 'bs', 'mt', 'la', 'lb', 'br', 'oc', 'fo', 'ht', 'mi', 'haw', 'ln', 'ha', 'sn', 'so', 'yo', 'mg', 'su', 'jw', 'tk'],
  },
  { id: 'cyrillic', charWidthRatio: 0.85, fontScale: 0.5, rtl: false, fallbackStack: "'IBM Plex Sans', 'Noto Sans', 'Segoe UI'", languages: ['ru', 'uk', 'bg', 'sr', 'mk', 'be', 'kk', 'ky', 'mn', 'tg', 'tt', 'ba'] },
  { id: 'cjk', charWidthRatio: 1.05, fontScale: 0.65, rtl: false, fallbackStack: "'Noto Sans CJK SC', 'Noto Sans JP', 'Noto Sans KR', 'PingFang SC', 'Hiragino Sans', 'Microsoft YaHei', 'Malgun Gothic'", languages: ['zh', 'ja', 'ko'] },
  { id: 'arabic', charWidthRatio: 0.58, fontScale: 0.5, rtl: true, fallbackStack: "'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma", languages: ['ar', 'ur', 'fa', 'ps', 'sd'] },
  { id: 'devanagari', charWidthRatio: 0.7, fontScale: 0.5, rtl: false, fallbackStack: "'IBM Plex Sans Devanagari', 'Noto Sans Devanagari', 'Nirmala UI'", languages: ['hi', 'mr', 'ne', 'sa'] },
  { id: 'thai', charWidthRatio: 0.62, fontScale: 0.5, rtl: false, fallbackStack: "'IBM Plex Sans Thai', 'Noto Sans Thai', 'Leelawadee UI'", languages: ['th', 'lo'] },
  { id: 'hebrew', charWidthRatio: 0.58, fontScale: 0.5, rtl: true, fallbackStack: "'IBM Plex Sans Hebrew', 'Noto Sans Hebrew', 'Segoe UI'", languages: ['he', 'yi'] },
] as ScriptConfig[])

/** For a language the table does not list (Greek, Bengali, Tamil…): a safe wide-script setting. */
const OTHER = { charWidthRatio: 0.7, fontScale: 0.5 }

const baseCode = (language: string | undefined): string => String(language ?? '').toLowerCase().split(/[-_]/)[0]

/** The script a language code uses, or undefined when the code is unknown or missing. */
export function scriptOf(language: string | undefined): ScriptConfig | undefined {
  const code = baseCode(language)
  return code ? SCRIPTS.find((s) => s.languages.includes(code)) : undefined
}

export const isRtl = (language: string | undefined): boolean => scriptOf(language)?.rtl === true

const RANGES: [ScriptId, RegExp][] = [
  ['cjk', /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]/gu],
  ['arabic', /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFC]/gu],
  ['hebrew', /[\u0590-\u05FF\uFB1D-\uFB4F]/gu],
  ['devanagari', /[\u0900-\u097F]/gu],
  ['thai', /[\u0E00-\u0E7F]/gu],
  ['cyrillic', /[\u0400-\u052F]/gu],
]

/** The script of some text, for captions that come with no language (an imported file, a typed line). Latin when nothing else stands out. */
export function detectScript(text: string): ScriptId {
  let best: ScriptId = 'latin', bestCount = 0
  for (const [id, re] of RANGES) {
    const n = (String(text ?? '').match(re) ?? []).length
    if (n > bestCount) { best = id; bestCount = n }
  }
  return best
}

/** The config for text: by language when known, else by what the text looks like. */
export function scriptFor(language: string | undefined, text = ''): ScriptConfig {
  return scriptOf(language) ?? SCRIPTS.find((s) => s.id === detectScript(text)) ?? SCRIPTS[0]
}

/**
 * How much smaller than a Latin caption this text is set on screen, 0.6 to 1. Wide letters (CJK, Cyrillic…) get smaller so a line holds about as
 * many characters as a Latin one. (ai-video-captions halves the font for ASS because its Latin looks use very big, narrow display fonts; these
 * captions are sized for the frame, so the correction here is only for the width of the letters.)
 */
export function displayScale(language: string | undefined, text = ''): number {
  const listed = scriptOf(language)
  const code = baseCode(language)
  // A language Whisper supports that the table does not list (Bengali, Greek, Tamil…), or letters of a script it does not list: wide-script settings.
  const unlistedLanguage = !listed && code !== '' && NAMES.has(code)
  const unlistedLetters = !listed && !unlistedLanguage && detectScript(text) === 'latin' && hasOtherLetters(text)
  const ratio = listed ? listed.charWidthRatio : unlistedLanguage || unlistedLetters ? OTHER.charWidthRatio : scriptFor(language, text).charWidthRatio
  return Math.round(Math.min(1, Math.max(0.6, SCRIPTS[0].charWidthRatio / ratio)) * 100) / 100
}

/** Letters that are not Latin and that the script table has no entry for (Greek, Bengali, Tamil, Armenian, Georgian…). */
const hasOtherLetters = (text: string): boolean => /[^\p{Script=Latin}\P{L}]/u.test(String(text ?? ''))

/** The first language of a script: a stand-in when a file needs a language and has none. */
export function representativeLanguage(id: ScriptId): string {
  return (SCRIPTS.find((s) => s.id === id) ?? SCRIPTS[0]).languages[0]
}

/** Target line width at the 1080-px reference frame, as in ai-video-captions (1000 px usable, about 85 %). */
const TARGET_LINE_WIDTH = 850

/** How many characters fit on a line and how much to scale the font, for a language and a base font size. */
export function layoutFor(language: string | undefined, fontSize = 105): { maxChars: number; fontScale: number } {
  const noLanguage = baseCode(language) === ''
  const cfg = scriptOf(language)
  const { charWidthRatio, fontScale } = cfg ?? (noLanguage ? { charWidthRatio: SCRIPTS[0].charWidthRatio, fontScale: 1 } : OTHER)
  const avg = fontSize * fontScale * charWidthRatio
  return { maxChars: Math.max(5, Math.floor(TARGET_LINE_WIDTH / avg)), fontScale }
}

/** Whisper's languages: [code, English name]. Order: English first, then roughly by how often they are spoken. */
export const LANGUAGES: readonly (readonly [string, string])[] = Object.freeze([
  ['en', 'English'], ['zh', 'Chinese'], ['es', 'Spanish'], ['hi', 'Hindi'], ['ar', 'Arabic'], ['pt', 'Portuguese'], ['bn', 'Bengali'], ['ru', 'Russian'], ['ja', 'Japanese'],
  ['de', 'German'], ['fr', 'French'], ['ko', 'Korean'], ['tr', 'Turkish'], ['it', 'Italian'], ['vi', 'Vietnamese'], ['id', 'Indonesian'], ['pl', 'Polish'], ['uk', 'Ukrainian'],
  ['nl', 'Dutch'], ['th', 'Thai'], ['fa', 'Persian'], ['he', 'Hebrew'], ['ur', 'Urdu'], ['ta', 'Tamil'], ['te', 'Telugu'], ['mr', 'Marathi'], ['sv', 'Swedish'], ['el', 'Greek'],
  ['ro', 'Romanian'], ['cs', 'Czech'], ['hu', 'Hungarian'], ['fi', 'Finnish'], ['da', 'Danish'], ['no', 'Norwegian'], ['ms', 'Malay'], ['tl', 'Tagalog'], ['sw', 'Swahili'],
  ['bg', 'Bulgarian'], ['sr', 'Serbian'], ['hr', 'Croatian'], ['sk', 'Slovak'], ['sl', 'Slovenian'], ['lt', 'Lithuanian'], ['lv', 'Latvian'], ['et', 'Estonian'], ['ca', 'Catalan'],
  ['gl', 'Galician'], ['eu', 'Basque'], ['cy', 'Welsh'], ['af', 'Afrikaans'], ['is', 'Icelandic'], ['sq', 'Albanian'], ['mk', 'Macedonian'], ['bs', 'Bosnian'], ['be', 'Belarusian'],
  ['kk', 'Kazakh'], ['uz', 'Uzbek'], ['az', 'Azerbaijani'], ['hy', 'Armenian'], ['ka', 'Georgian'], ['ne', 'Nepali'], ['gu', 'Gujarati'], ['pa', 'Punjabi'], ['kn', 'Kannada'],
  ['ml', 'Malayalam'], ['si', 'Sinhala'], ['km', 'Khmer'], ['lo', 'Lao'], ['my', 'Myanmar'], ['mn', 'Mongolian'], ['tg', 'Tajik'], ['ps', 'Pashto'], ['sd', 'Sindhi'], ['am', 'Amharic'],
  ['yi', 'Yiddish'], ['so', 'Somali'], ['ha', 'Hausa'], ['yo', 'Yoruba'], ['sn', 'Shona'], ['mg', 'Malagasy'], ['ln', 'Lingala'], ['mt', 'Maltese'], ['lb', 'Luxembourgish'],
  ['br', 'Breton'], ['oc', 'Occitan'], ['fo', 'Faroese'], ['ht', 'Haitian Creole'], ['mi', 'Maori'], ['haw', 'Hawaiian'], ['la', 'Latin'], ['sa', 'Sanskrit'], ['tt', 'Tatar'],
  ['ba', 'Bashkir'], ['tk', 'Turkmen'], ['nn', 'Nynorsk'], ['as', 'Assamese'], ['bo', 'Tibetan'], ['su', 'Sundanese'], ['jw', 'Javanese'],
] as [string, string][])

const NAMES = new Map<string, string>(LANGUAGES)

/** "Spanish" for "es" or "es-MX"; the code itself when unknown; empty when missing. */
export function languageName(language: string | undefined): string {
  const code = baseCode(language)
  return code ? NAMES.get(code) ?? code : ''
}
