import { describe, it, expect, vi } from 'vitest';
import { caseOf, matchStyle, isCopyField, fieldFormat, fitsFormat, generateFieldCopy } from '../rewrite.js';

vi.mock('../editor/mount.jsx', () => ({}));
const reply = (items) => vi.fn(async () => new Response(JSON.stringify({ ok: true, items }), { status: 200 }));
const KEY = { 'X-OpenAI-Key': 'sk-test0123456789abcdefghijkl' };

describe('matching the design\'s text style', () => {
  it('reads how text is cased', () => {
    expect(caseOf('CUSTOMER LOVE')).toBe('upper');
    expect(caseOf('What Our Users Are Saying')).toBe('title');
    expect(caseOf('Fast plumbing in Reno')).toBe('sentence');
    expect(caseOf('Hi')).toBe('none');
    expect(caseOf('Hi {{firstname|there}}, [[grow]] fast')).toBe('sentence');
  });

  it('ALL CAPS stays ALL CAPS, and {{tokens}} are never changed', () => {
    expect(matchStyle('CUSTOMER LOVE', 'Happy customers')).toBe('HAPPY CUSTOMERS');
    expect(matchStyle('MADE FOR YOU', 'Hello {{firstname|there}}')).toBe('HELLO {{firstname|there}}');
  });

  it('Title Case stays Title Case, small words stay small', () => {
    expect(matchStyle('What Our Users Are Saying', 'why people love working with us')).toBe('Why People Love Working with Us');
    expect(matchStyle('Book a Free Consultation', 'start your free trial today')).toBe('Start Your Free Trial Today');
  });

  it('copies how the old text ended', () => {
    expect(matchStyle('Book a demo', 'Start free today.')).toBe('Start free today');
    expect(matchStyle('Hi there!', 'Welcome back')).toBe('Welcome back!');
    expect(matchStyle('Hi there!', 'Welcome back.')).toBe('Welcome back!');
    expect(matchStyle('We fix leaks.', 'We repair pipes fast')).toBe('We repair pipes fast.');
  });

  it('leaves longer copy and empty fields alone, and tidies spaces', () => {
    expect(matchStyle('One sentence. Two sentences here.', 'First idea.  Second idea.')).toBe('First idea. Second idea.');
    expect(matchStyle('', '  Fast   plumbing  ')).toBe('Fast plumbing');
    expect(matchStyle('', 'Fast plumbing.')).toBe('Fast plumbing.');
  });

  it('keeps line breaks (and the design\'s Title Case)', () => {
    expect(matchStyle('Personalize\nin Minutes', 'Find leads\nclose deals')).toBe('Find Leads\nClose Deals');
    expect(matchStyle('one line\nand another', 'first row\nsecond row')).toBe('first row\nsecond row');
  });

  it('follows the design\'s own habit with small words (With vs with)', () => {
    expect(matchStyle('Turn Cold Contacts Into Hot Leads With Personalized Video', 'grow your business with local video')).toBe('Grow Your Business With Local Video');
    expect(matchStyle('Turn Cold Contacts into Hot Leads with Personalized Video', 'grow your business with local video')).toBe('Grow Your Business with Local Video');
  });

  it('fixes the ending on multi-line headlines too', () => {
    expect(matchStyle('Turn Cold\nContacts Into [[Hot Leads]]', 'Warm up your\nlocal [[customers]] now.')).toBe('Warm Up Your\nLocal [[Customers]] Now');
  });

  it('a short two-word text is not guessed to be Title Case', () => {
    expect(caseOf('Book now')).toBe('sentence');
    expect(matchStyle('Book now', 'Call today')).toBe('Call today');
  });
});

describe('what a field expects, from its real label', () => {
  it('headline fields with [[ ]] allow highlight marks; plain fields do not', () => {
    expect(fieldFormat('Headline (wrap words in [[double brackets]] to highlight)', '').highlight).toBe(true);
    expect(fieldFormat('Button text', '').highlight).toBe(false);
    expect(fieldFormat('Sub-headline', 'Hello [[world]]').highlight).toBe(true);
  });
  it('comma lists carry their item count', () => {
    expect(fieldFormat('Weekday labels, comma separated (7)', '').list).toEqual({ count: 7 });
    expect(fieldFormat('Dropdown choices (comma separated)', 'a, b, c').list).toEqual({ count: 3 });
    expect(fieldFormat('Title', '').list).toBeNull();
  });
  it('rows and numbers', () => {
    expect(fieldFormat('Handwritten note (one line per row)', 'Hi Sarah,\nWelcome').lines).toEqual({ count: 2 });
    expect(fieldFormat('Number', '').numeric).toBe(true);
    expect(fieldFormat('Number (numbers style)', '128,349').numeric).toBe(true);
    expect(fieldFormat('Heading', 'Real results').numeric).toBe(false);
  });
  it('options that break the format are rejected', () => {
    const plain = fieldFormat('Button text', 'Book now');
    expect(fitsFormat('Call today', plain, 'Book now')).toBe(true);
    expect(fitsFormat('Call [[today]]', plain, 'Book now')).toBe(false);                       // raw brackets in a plain field
    const head = fieldFormat('Headline (wrap words in [[double brackets]] to highlight)', '');
    expect(fitsFormat('Grow your [[business]]', head, '')).toBe(true);
    expect(fitsFormat('[[A]] [[B]] [[C]]', head, '')).toBe(false);                              // at most two marks
    expect(fitsFormat('Grow [[your business', head, '')).toBe(false);                           // unbalanced
    const days = fieldFormat('Weekday labels, comma separated (7)', '');
    expect(fitsFormat('M, T, W, T, F, S, S', days, '')).toBe(true);
    expect(fitsFormat('M, T, W', days, '')).toBe(false);
    expect(fitsFormat('M, , W, T, F, S, S', days, '')).toBe(false);
    const num = fieldFormat('Number', '');
    expect(fitsFormat('3.4x', num, '')).toBe(true);
    expect(fitsFormat('A big number', num, '')).toBe(false);
    expect(fitsFormat('Hello {{firstname|there}}', fieldFormat('Headline', 'Hi {{firstname|there}}'), 'Hi {{firstname|there}}')).toBe(true);
    expect(fitsFormat('Hi {{firstname|you}}', fieldFormat('Headline', 'Hi {{firstname|there}}'), 'Hi {{firstname|there}}')).toBe(false);   // the placeholder is kept exactly
    expect(fitsFormat('Hi friend', fieldFormat('Headline', 'Hi {{firstname|there}}'), 'Hi {{firstname|there}}')).toBe(false);
  });
});

describe('which fields get the AI writer', () => {
  it('words yes; links, colours, field names, icon names, pictures no', () => {
    for (const ok of ['Headline', 'Button text', 'Quote', 'Small label above the headline', 'Screen-reader description (alt text)', 'Link text', 'Number', 'Title / name']) expect(isCopyField(ok), ok).toBe(true);
    for (const no of ['Link (https, mailto:, tel: or #lead)', 'Button link (https)', 'Accent colour (#hex)', 'Section background colour (#hex, empty = page)', 'Field name (a-z)', 'Icon name', 'Icon (home, users, video, mail, gear, chart...)', 'Logo (path or https link)', 'Background photo (https link)', 'Picture path (laptop)']) expect(isCopyField(no), no).toBe(false);
  });
});

describe('writing one field fits it', () => {
  it('an ALL-CAPS eyebrow comes back ALL CAPS, flagged as adjusted', async () => {
    const out = await generateFieldCopy({ label: 'Small label', current: 'CUSTOMER LOVE', headers: KEY, fetchImpl: reply([{ id: 'o1', text: 'Happy customers' }]) });
    expect(out).toEqual(['HAPPY CUSTOMERS']);
    expect(out.adjusted).toBe(true);
  });
  it('a headline can get its accent highlight; a plain field cannot', async () => {
    const head = await generateFieldCopy({ label: 'Headline (wrap words in [[double brackets]] to highlight)', headers: KEY, fetchImpl: reply([{ id: 'o1', text: 'Fix leaks [[fast]]' }]) });
    expect(head).toEqual(['Fix leaks [[fast]]']);
    const plain = await generateFieldCopy({ label: 'Button text', headers: KEY, fetchImpl: reply([{ id: 'o1', text: 'Call [[now]]' }, { id: 'o2', text: 'Call now' }]) });
    expect(plain).toEqual(['Call now']);
  });
  it('sends what the field expects to the server', async () => {
    const fetchImpl = reply([{ id: 'o1', text: 'M, T, W, T, F, S, S' }]);
    await generateFieldCopy({ label: 'Weekday labels, comma separated (7)', headers: KEY, fetchImpl });
    const input = JSON.parse(fetchImpl.mock.calls[0][1].body).input;
    expect(input.format).toMatchObject({ highlight: false, list: { count: 7 } });
    expect(input.casing).toBe('none');
  });
  it('nothing was corrected when the text already fit', async () => {
    const out = await generateFieldCopy({ label: 'Button text', current: 'Book now', headers: KEY, fetchImpl: reply([{ id: 'o1', text: 'Call today' }]) });
    expect(out.adjusted).toBe(false);
  });
});
