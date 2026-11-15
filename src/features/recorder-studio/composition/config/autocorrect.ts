import { Caption } from "@remotion/captions";

// Recorder Studio: upstream edits this file to add word fixes. Here the user's own list (Captions tab > Word fixes) is applied as well.
export type WordFix = { from: string; to: string };
let userWordFixes: WordFix[] = [];
export const setUserWordFixes = (fixes: WordFix[]) => {
  userWordFixes = fixes.filter((f) => f.from.trim() && f.to.trim());
};

const applyUserWordFixes = (caption: Caption): Caption => {
  if (userWordFixes.length === 0) return caption;
  // " github," -> leading space, the word, trailing punctuation: the fix replaces only the word.
  const m = caption.text.match(/^(\s*)(.*?)([.,!?;:]*)$/);
  if (!m) return caption;
  const [, lead, word, trail] = m;
  const fix = userWordFixes.find((f) => f.from.trim().toLowerCase() === word!.toLowerCase());
  return fix ? { ...caption, text: `${lead}${fix.to.trim()}${trail}` } : caption;
};

const autocorrectWord = (caption: Caption): Caption => {
  // Replace a single word with another one
  if (caption.text === " github") {
    return {
      ...caption,
      text: caption.text.replace("github", " GitHub"),
    };
  }

  // Replace a pattern with a specific word
  if (caption.text.match(/ remotion\.$/)) {
    return {
      ...caption,
      text: caption.text.replace(/ remotion.$/, " Remotion."),
    };
  }
  // Add your own function to remap specific words.

  return applyUserWordFixes(caption);
};

export const autocorrectWords = (captions: Caption[]): Caption[] => {
  return captions.map(autocorrectWord);
};
