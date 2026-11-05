import { describe, expect, it } from 'vitest';
import { CARDS } from '../cards/registry';
import { cardName, cardSummary, themeLabel, tx, useLocale } from '../i18n';
import { DIRECTOR_THEMES } from '../lib/palette';

const CJK = /[぀-ヿ㐀-鿿]/;

describe('the English interface shows no Chinese', () => {
  it('card names, categories, summaries, field labels and options, theme names', () => {
    useLocale.setState({ locale: 'en' });
    const left: string[] = [];
    const check = (where: string, s: unknown) => {
      if (typeof s === 'string' && CJK.test(s)) left.push(`${where}: ${s}`);
    };
    for (const card of Object.values(CARDS)) {
      if ((card as { hidden?: boolean }).hidden) continue;
      check(`${card.id} name`, cardName(card));
      check(`${card.id} category`, (card as { categoryEn?: string }).categoryEn ?? tx(card.category));
      check(`${card.id} summary`, cardSummary(card));
      for (const f of card.schema ?? []) {
        check(`${card.id} field`, tx(f.label));
        for (const o of ((f as { options?: Array<{ label?: string } | string> }).options ?? [])) check(`${card.id} option`, tx(typeof o === 'string' ? o : o.label));
      }
    }
    for (const t of DIRECTOR_THEMES) check(`theme ${t.id}`, themeLabel(t.label));
    expect(left).toEqual([]);
  });
});
