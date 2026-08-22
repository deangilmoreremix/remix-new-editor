import fs from 'fs';

function parseReadme(filePath, source) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const prompts = [];

  const sections = content.split(/^### No\.\s*\d+:/m);

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const titleMatch = section.match(/^(.+?)(?:\n|$)/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();
    if (!title) continue;

    const descMatch = section.match(/#### 📖 Description\s*\n\n([\s\S]*?)(?:\n####|$)/);
    const description = descMatch ? descMatch[1].trim() : '';

    const promptMatch = section.match(/#### 📝 Prompt\s*\n\n```(?:\w+)?\n([\s\S]*?)```/);
    const prompt = promptMatch ? promptMatch[1].trim() : '';

    const imageMatch = section.match(/<img[^>]+src="([^"]+)"/);
    const thumbnail = imageMatch ? imageMatch[1] : '';

    const authorMatch = section.match(/\*\*Author:\*\* \[([^\]]+)\]/);
    const author = authorMatch ? authorMatch[1] : '';

    const publishedMatch = section.match(/\*\*Published:\*\* (.+?)(?:\n|$)/);
    const published = publishedMatch ? publishedMatch[1].trim() : '';

    const langMatch = section.match(/\*\*Languages:\*\* (\w+)/);
    const language = langMatch ? langMatch[1] : 'en';

    const category = detectCategory(title, description, prompt);
    const tags = generateTags(title, description, prompt, category);

    const id = `${source.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`;

    prompts.push({
      id,
      title,
      description,
      prompt,
      thumbnail,
      category,
      tags,
      source,
      author,
      published,
      language,
    });
  }

  return prompts;
}

function detectCategory(title, description, prompt) {
  const text = `${title} ${description} ${prompt}`.toLowerCase();

  if (text.includes('avatar') || text.includes('profile') || text.includes('selfie') || text.includes('portrait')) {
    return 'Profile / Avatar';
  }
  if (text.includes('social media') || text.includes('instagram') || text.includes('tiktok') || text.includes('post')) {
    return 'Social Media';
  }
  if (text.includes('product') || text.includes('marketing') || text.includes('commercial')) {
    return 'Product Marketing';
  }
  if (text.includes('ecommerce') || text.includes('e-commerce') || text.includes('main image')) {
    return 'E-commerce';
  }
  if (text.includes('poster') || text.includes('flyer')) {
    return 'Poster / Flyer';
  }
  if (text.includes('game') || text.includes('asset') || text.includes('character')) {
    return 'Game Asset';
  }
  if (text.includes('youtube') || text.includes('thumbnail')) {
    return 'YouTube Thumbnail';
  }
  if (text.includes('infographic') || text.includes('edu') || text.includes('education')) {
    return 'Infographic / Edu';
  }
  if (text.includes('comic') || text.includes('storyboard')) {
    return 'Comic / Storyboard';
  }
  if (text.includes('app') || text.includes('web') || text.includes('design') || text.includes('ui')) {
    return 'App / Web Design';
  }
  if (text.includes('photography') || text.includes('photo')) {
    return 'Photography';
  }
  if (text.includes('cinematic') || text.includes('film')) {
    return 'Cinematic';
  }
  if (text.includes('anime') || text.includes('manga')) {
    return 'Anime / Manga';
  }
  if (text.includes('illustration')) {
    return 'Illustration';
  }
  if (text.includes('3d') || text.includes('render')) {
    return '3D Render';
  }
  if (text.includes('oil painting') || text.includes('painting')) {
    return 'Oil Painting';
  }
  if (text.includes('watercolor')) {
    return 'Watercolor';
  }
  if (text.includes('cyberpunk') || text.includes('sci-fi')) {
    return 'Cyberpunk / Sci-Fi';
  }
  if (text.includes('minimalism') || text.includes('minimalist')) {
    return 'Minimalism';
  }
  if (text.includes('product') || text.includes('skincare') || text.includes('perfume')) {
    return 'Product';
  }
  if (text.includes('fashion') || text.includes('clothing') || text.includes('outfit')) {
    return 'Fashion';
  }
  if (text.includes('food') || text.includes('drink') || text.includes('culinary')) {
    return 'Food / Drink';
  }
  if (text.includes('landscape') || text.includes('nature') || text.includes('scenery')) {
    return 'Landscape / Nature';
  }
  if (text.includes('architecture') || text.includes('interior') || text.includes('building')) {
    return 'Architecture / Interior';
  }

  return 'General';
}

function generateTags(title, description, prompt, category) {
  const tags = [category.toLowerCase().replace(/\s+/g, '-')];
  const text = `${title} ${description} ${prompt}`.toLowerCase();

  const keywordMap = {
    'portrait': 'portrait',
    'selfie': 'selfie',
    'photorealistic': 'photorealistic',
    'cinematic': 'cinematic',
    'anime': 'anime',
    'illustration': 'illustration',
    '3d': '3d',
    'render': 'render',
    'watercolor': 'watercolor',
    'oil painting': 'oil-painting',
    'cyberpunk': 'cyberpunk',
    'minimalist': 'minimalist',
    'product': 'product',
    'fashion': 'fashion',
    'food': 'food',
    'landscape': 'landscape',
    'architecture': 'architecture',
    'interior': 'interior',
    'character': 'character',
    'game': 'game',
    'poster': 'poster',
    'flyer': 'flyer',
    'infographic': 'infographic',
    'comic': 'comic',
    'storyboard': 'storyboard',
    'thumbnail': 'thumbnail',
    'social': 'social',
    'marketing': 'marketing',
    'ecommerce': 'ecommerce',
  };

  for (const [keyword, tag] of Object.entries(keywordMap)) {
    if (text.includes(keyword) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags.slice(0, 5);
}

const repos = [
  { path: '/Users/deanellgilmore/Downloads/awesome-nano-banana-pro-prompts/README.md', source: 'Nano Banana Pro' },
  { path: '/Users/deanellgilmore/Downloads/awesome-gpt-image-2/README.md', source: 'GPT Image 2' },
  { path: '/Users/deanellgilmore/Downloads/awesome-seedream-4.5/README.md', source: 'Seedream 4.5' },
];

const allPrompts = [];

for (const repo of repos) {
  if (fs.existsSync(repo.path)) {
    const prompts = parseReadme(repo.path, repo.source);
    allPrompts.push(...prompts);
    console.log(`Parsed ${prompts.length} prompts from ${repo.source}`);
  }
}

console.log(`\nTotal prompts parsed: ${allPrompts.length}`);

const outputPath = '/Users/deanellgilmore/Downloads/remixneweditor/remix-new-editor/src/data/youmindImagePrompts.json';
fs.writeFileSync(outputPath, JSON.stringify(allPrompts, null, 2), 'utf-8');
console.log(`Saved to ${outputPath}`);

const categories = {};
allPrompts.forEach(p => {
  categories[p.category] = (categories[p.category] || 0) + 1;
});
console.log('\nCategory distribution:');
Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, count]) => console.log(`  ${cat}: ${count}`));
