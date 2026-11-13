/** Fixture images for two fictional businesses. They are labelled FIXTURE and are not real company assets. */
const svg = (bg, fg, big, small) => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200"><rect width="320" height="200" fill="${bg}"/><text x="160" y="95" font-family="Arial" font-size="34" font-weight="700" text-anchor="middle" fill="${fg}">${big}</text><text x="160" y="135" font-family="Arial" font-size="16" text-anchor="middle" fill="${fg}">${small}</text></svg>`;

export const BUSINESSES = {
  A: { name: 'Smith Roofing', website: 'https://smith-roofing.example/', phone: '+15551230001', first: 'John', company: 'Smith Roofing', color: '#b8421f' },
  B: { name: 'Wilson Plumbing', website: 'https://wilson-plumbing.example/', phone: '+15551230002', first: 'Sarah', company: 'Wilson Plumbing', color: '#1f6fb8' },
};

export const IMAGES = {
  'fixtures/a-logo.svg': svg('#b8421f', '#fff', 'SMITH', 'logo (fixture)'),
  'fixtures/a-service.svg': svg('#f4d6c8', '#7a2a10', 'ROOF REPAIR', 'service photo (fixture)'),
  'fixtures/a-new.svg': svg('#7a2a10', '#fff', 'NEW ROOF', 'new photo (fixture)'),
  'fixtures/b-logo.svg': svg('#1f6fb8', '#fff', 'WILSON', 'logo (fixture)'),
  'fixtures/b-service.svg': svg('#c8def4', '#0f3a66', 'PIPE FIX', 'service photo (fixture)'),
};
export const FIXTURE_PREFIX = 'fixtures/';
