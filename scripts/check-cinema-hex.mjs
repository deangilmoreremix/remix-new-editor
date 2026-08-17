import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILES = [
  'src/components/CinemaStudio.js',
  'src/components/CinemaTemplateStudio.js',
  'src/components/StoryboardStudio.js',
];

const HEX_UTILITY = /\b(?:bg|text|border)-\[#[0-9a-fA-F]+\]/i;

let found = false;

for (const file of FILES) {
  const abs = resolve(process.cwd(), file);
  const content = readFileSync(abs, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, idx) => {
    if (HEX_UTILITY.test(line)) {
      found = true;
      console.log(`${file}:${idx + 1}  ${line.trim()}`);
    }
  });
}

if (found) {
  console.error('\nCinema studio files contain raw hex Tailwind color utilities.');
  process.exit(1);
}

console.log('OK: no raw hex Tailwind color utilities in cinema studio files.');
process.exit(0);
