import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function parseSeedanceReadme(markdown) {
  const items = [];
  const lines = markdown.split('\n');

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('### ')) {
      const title = line.replace(/^###\s+/, '').trim();

      const promptMatch = markdown.slice(markdown.indexOf(line)).match(/#### 📝 Prompt\s+```\s+([\s\S]*?)```/);
      if (!promptMatch) {
        i += 20;
        continue;
      }
      const prompt = promptMatch[1].replace(/^\n+|\n+$/g, '').trim();

      const afterPrompt = markdown.slice(markdown.indexOf(promptMatch[0]) + promptMatch[0].length);

      let thumbnail = '';
      const imgMatch = afterPrompt.match(/<img[^>]+src="([^"]+)"[^>]*>/);
      if (imgMatch) {
        thumbnail = imgMatch[1];
      }

      let videoId = '';
      const watchMatch = afterPrompt.match(/\[🎬 Watch Video →\]\(https:\/\/youmind\.com\/[^)]+\?id=(\d+)\)/);
      if (watchMatch) {
        videoId = watchMatch[1];
      }

      let directVideoUrl = '';
      const directVideoMatch = afterPrompt.match(/<a href="(https:\/\/github\.com\/YouMind-OpenLab\/awesome-seedance-2-prompts\/releases\/download\/videos\/\d+\.mp4)"[^>]*>/);
      if (directVideoMatch) {
        directVideoUrl = directVideoMatch[1];
      }

      const authorMatch = afterPrompt.match(/\*\*Author:\*\* \[([^\]]+)\]\(([^)]+)\)/);
      const authorName = authorMatch ? authorMatch[1] : '';
      const authorLink = authorMatch ? authorMatch[2] : '';

      const sourceMatch = afterPrompt.match(/\*\*Source:\*\* \[([^\]]+)\]\(([^)]+)\)/);
      const sourceLabel = sourceMatch ? sourceMatch[1] : '';
      const sourceUrl = sourceMatch ? sourceMatch[2] : '';

      const publishedMatch = afterPrompt.match(/\*\*Published:\*\* (.+)/);
      const publishedAt = publishedMatch ? publishedMatch[1].trim() : '';

      const engagement = { likes: 0, reposts: 0, replies: 0 };
      const engMatch = afterPrompt.match(/(\d+)\s*likes?.*?(\d+)\s*reposts?.*?(\d+)\s*replies?/i);
      if (engMatch) {
        engagement.likes = parseInt(engMatch[1], 10) || 0;
        engagement.reposts = parseInt(engMatch[2], 10) || 0;
        engagement.replies = parseInt(engMatch[3], 10) || 0;
      }

      const media = [];
      if (thumbnail) {
        media.push({
          type: 'image',
          previewUrl: thumbnail,
          sourceUrl: thumbnail,
          posterUrl: thumbnail,
        });
      }
      if (directVideoUrl || videoId) {
        const videoSourceUrl = directVideoUrl || `https://github.com/YouMind-OpenLab/awesome-seedance-2-prompts/releases/download/videos/${videoId}.mp4`;
        media.push({
          type: 'video',
          previewUrl: thumbnail,
          sourceUrl: videoSourceUrl,
          posterUrl: thumbnail,
        });
      }

      items.push({
        id: `seedance-${videoId || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
        title,
        prompt,
        mediaType: 'video',
        media,
        source: {
          author: { name: authorName, link: authorLink },
          source: { label: sourceLabel, url: sourceUrl },
          publishedAt,
          engagement,
        },
        categories: ['seedance-2.0', 'video'],
        recommendedModel: 'seedance-2.0',
        provenance: {
          repo: 'awesome-seedance-2-prompts',
          videoId,
          directVideoUrl,
          url: videoId ? `https://youmind.com/en-US/seedance-2-0-prompts?id=${videoId}` : '',
        },
      });
    }

    i += 1;
  }

  return items;
}

function main() {
  const readmePath = resolve(ROOT, 'data', 'seedance-readme.md');
  let markdown = '';

  try {
    markdown = readFileSync(readmePath, 'utf-8');
  } catch (err) {
    console.error(`Failed to read README at ${readmePath}: ${err.message}`);
    console.error('Save the awesome-seedance-2-prompts README.md to data/seedance-readme.md first.');
    process.exit(1);
  }

  console.log(`Read ${markdown.length} chars from ${readmePath}`);

  const items = parseSeedanceReadme(markdown);
  console.log(`Parsed ${items.length} README prompts`);

  const withPromptAndVideo = items.filter(item => item.prompt && item.prompt.trim().length > 0 && item.media && item.media.some(m => m.type === 'video' && m.sourceUrl));
  console.log(`Keeping ${withPromptAndVideo.length} items with both prompt text and video URL`);

  const outputPath = resolve(ROOT, 'data', 'seedance-prompts.json');
  writeFileSync(outputPath, JSON.stringify({ items: withPromptAndVideo, total: withPromptAndVideo.length }, null, 2), 'utf-8');
  console.log(`Wrote ${withPromptAndVideo.length} items to ${outputPath}`);
}

main();
